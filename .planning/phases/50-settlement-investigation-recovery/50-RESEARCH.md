# Phase 50: Settlement Investigation & Recovery - Research

**Researched:** 2026-02-06
**Domain:** BullMQ job queue failure investigation, settlement scoring pipeline recovery
**Confidence:** HIGH

## Summary

Phase 50 addresses the 43 failed settlement jobs in production and ensures the settlement pipeline handles edge cases gracefully. Research reveals that BullMQ provides comprehensive failure investigation tools (`queue.getFailed()`, DLQ pattern) and the existing codebase already implements a Dead Letter Queue system (`src/lib/queue/dead-letter.ts`). The root cause investigation requires analyzing failed jobs in the settlement queue and DLQ to identify patterns.

The primary edge case is clear: the scoring worker returns `{ skipped: true, reason: 'no_predictions' }` when a finished match has zero predictions (line 64-66 of `scoring.worker.ts`). This is a **skipped job, not a failed job**, meaning it won't retry or reach the DLQ. The real issue is that matches finishing without predictions create permanent gaps in the settlement pipeline.

The settlement backfill pattern already exists in `backfill.worker.ts` (lines 319-371) via `getMatchesNeedingScoring()`, which finds finished matches with pending predictions. However, this doesn't handle the zero-predictions case because the query requires at least one prediction to exist.

**Primary recommendation:** Investigate failed jobs via DLQ API and BullMQ queue methods, handle zero-prediction matches with conditional retry (not permanent skip), and extend backfill coverage to include finished matches with zero predictions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.x | Job queue with Redis backend | Industry standard for Node.js distributed job processing, built-in retry/DLQ patterns |
| Drizzle ORM | Latest | Database transactions with row-level locking | Type-safe SQL with `FOR UPDATE` support for race condition prevention |
| Pino | Latest | Structured logging | Fast, low-overhead JSON logging for production debugging |
| Sentry | Latest | Error tracking and monitoring | Standard for production error aggregation and stack traces |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IORedis | Latest | Redis client for BullMQ | Required for BullMQ connection management |
| PostgreSQL | 15+ | Database with ACID transactions | Settlement scoring requires transactional integrity |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | Bull (v3) | Bull is deprecated, BullMQ is the official successor with better TypeScript support |
| Manual retry logic | BullMQ automatic retry | Automatic retry with exponential backoff is more reliable and battle-tested |

**Installation:**
```bash
npm install bullmq ioredis
# Already installed in codebase
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/queue/
├── workers/           # Worker processors
│   ├── scoring.worker.ts   # Settlement scoring
│   └── backfill.worker.ts  # Backfill missing data
├── dead-letter.ts     # DLQ management
├── index.ts           # Queue configuration
└── types.ts           # Job payload types
```

### Pattern 1: Dead Letter Queue (DLQ) Investigation
**What:** Failed jobs that exhaust retries are moved to a separate Redis-backed store for debugging
**When to use:** Investigating production failures, root cause analysis, manual recovery
**Example:**
```typescript
// Source: src/lib/queue/dead-letter.ts (existing codebase)
// Get failed jobs from DLQ
const failedJobs = await getDeadLetterJobs(50, 0); // limit, offset
const totalFailed = await getDeadLetterCount();

// Each entry contains:
// - jobId, queueName, jobType, data (payload)
// - failedReason, stackTrace, attemptsMade
// - timestamp
```

**Codebase implementation:** The platform already has a DLQ system (`src/lib/queue/dead-letter.ts`) with:
- `addToDeadLetterQueue()` - Workers call this when jobs fail
- `getDeadLetterJobs()` - Retrieve failed jobs for investigation
- `clearDeadLetterQueue()` - Clean up after fixes
- Admin API at `/api/admin/dlq` for web-based investigation

### Pattern 2: BullMQ Failed Jobs Inspection
**What:** Query the settlement queue directly for failed jobs (before they reach DLQ)
**When to use:** Real-time failure investigation, identifying jobs mid-retry
**Example:**
```typescript
// Source: BullMQ official docs
const failedJobs = await settlementQueue.getFailed(0, -1); // all failed jobs
const failedCount = await settlementQueue.getFailedCount();

// Inspect each failed job
for (const job of failedJobs) {
  console.log({
    id: job.id,
    data: job.data,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    attemptsMade: job.attemptsMade,
  });
}
```

### Pattern 3: Conditional Retry for Zero-Prediction Matches
**What:** Distinguish between temporary "no predictions yet" vs permanent "will never have predictions"
**When to use:** Settlement worker encounters finished match with zero predictions
**Example:**
```typescript
// Current behavior (lines 64-66 of scoring.worker.ts):
if (predictions.length === 0) {
  log.info(`No predictions found for match ${matchId}`);
  return { skipped: true, reason: 'no_predictions' };
}

// Recommended pattern:
if (predictions.length === 0) {
  // Check if match SHOULD have predictions (was it scheduled for analysis?)
  const analysis = await getAnalysisForMatch(matchId);

  if (analysis) {
    // Match was analyzed - predictions SHOULD exist but don't
    // This is an error state - throw to trigger retry
    throw new Error(`Match ${matchId} has analysis but zero predictions - pipeline failure`);
  } else {
    // Match was never analyzed - won't ever have predictions
    // This is expected for some old matches - skip gracefully
    log.info(`Match ${matchId} skipped settlement - no analysis/predictions by design`);
    return { skipped: true, reason: 'no_predictions_expected' };
  }
}
```

### Pattern 4: Database Transaction with Row-Level Locking
**What:** Use `SELECT ... FOR UPDATE` to prevent concurrent settlement jobs from scoring the same match
**When to use:** Scoring predictions (already implemented correctly in codebase)
**Example:**
```typescript
// Source: src/lib/db/queries.ts lines 1785-1795
await db.transaction(async (tx) => {
  // Lock all pending predictions for this match
  const pendingPredictions = await tx
    .select()
    .from(predictions)
    .where(and(
      eq(predictions.matchId, matchId),
      eq(predictions.status, 'pending')
    ))
    .for('update'); // <-- Row-level lock prevents race conditions

  // If empty, another job already scored them (idempotent)
  if (pendingPredictions.length === 0) {
    log.info('No pending predictions - already scored');
    return;
  }

  // Score predictions within transaction
  // ...
});
```

**Why this works:** PostgreSQL's `FOR UPDATE` locks rows until transaction commits, ensuring only one worker can score predictions for a given match even if multiple settlement jobs are queued.

### Pattern 5: Backfill Settlement for Unscored Matches
**What:** Periodic job finds finished matches with pending predictions and triggers settlement
**When to use:** Catch-up after pipeline failures, hourly backfill worker
**Example:**
```typescript
// Source: src/lib/queue/workers/backfill.worker.ts lines 319-371
const needingScoring = await getMatchesNeedingScoring();
// Query: finished matches with status='pending' predictions

for (const match of needingScoring) {
  await settlementQueue.add(
    'settle-match',
    {
      matchId: match.id,
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      status: match.status,
    },
    {
      priority: 1, // High priority
      jobId: `settle-${match.id}`, // Idempotent
    }
  );
}
```

**Gap:** Current `getMatchesNeedingScoring()` requires at least one prediction to exist (uses INNER JOIN). Finished matches with zero predictions won't be caught by this query.

### Anti-Patterns to Avoid
- **Skipping without distinction:** Returning `{ skipped: true }` for both temporary (retry-worthy) and permanent (expected) failures hides pipeline issues
- **Clearing failed jobs blindly:** Failed jobs contain valuable debugging data - investigate first, clear after root cause is fixed
- **Manual job deletion without retry:** Use `job.retry()` to re-queue with fresh data, not manual deletion + re-creation
- **Ignoring zero-prediction matches:** These indicate upstream pipeline failures (analysis or prediction worker never ran)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job retry logic | Custom retry counter + setTimeout | BullMQ `attempts` + `backoff` config | BullMQ handles exponential backoff, stalled job detection, and max retry limits automatically |
| Failed job storage | Custom Redis keys/sets | BullMQ built-in failed queue + DLQ pattern | BullMQ tracks failed jobs with metadata (attemptsMade, stacktrace) and provides `getFailed()` API |
| Race condition handling | Application-level locks/flags | PostgreSQL `SELECT FOR UPDATE` | Database row-level locks are atomic and survive worker crashes, application locks are not |
| Job deduplication | Check database before enqueue | BullMQ `jobId` option | BullMQ rejects duplicate jobIds at queue level, preventing race conditions |
| Transaction rollback on error | Manual savepoints/rollback | Drizzle `db.transaction()` auto-rollback | Uncaught errors automatically rollback entire transaction, manual rollback is error-prone |

**Key insight:** BullMQ's retry mechanism is designed for transient failures (API timeouts, temporary DB unavailability). For settlement scoring, the real issue is distinguishing **retriable errors** (no predictions YET) from **expected skips** (no predictions BY DESIGN).

## Common Pitfalls

### Pitfall 1: Treating Skipped Jobs as Non-Issues
**What goes wrong:** Worker returns `{ skipped: true }` for matches with zero predictions, but this masks upstream pipeline failures
**Why it happens:** The current code assumes zero predictions = "nothing to do" when it may actually mean "prediction worker never ran"
**How to avoid:**
1. Check if match has analysis data (indicates pipeline started)
2. If analysis exists but predictions don't, this is an ERROR (throw to trigger retry)
3. If no analysis exists, this is EXPECTED (skip gracefully)
**Warning signs:** Finished matches visible on site with no predictions shown, DLQ contains no settlement failures but users report missing scores

### Pitfall 2: Investigating Queue Instead of DLQ
**What goes wrong:** Checking `settlementQueue.getFailed()` when jobs already moved to DLQ
**Why it happens:** BullMQ's default retention policy removes failed jobs after 7 days
**How to avoid:**
1. Check DLQ first via `/api/admin/dlq` or `getDeadLetterJobs()`
2. Then check queue's failed set for recent failures
3. Cross-reference Sentry errors for full stack traces
**Warning signs:** "No failed jobs found" but STATE.md mentions 43 failures

### Pitfall 3: Clearing Failed Jobs Before Root Cause Analysis
**What goes wrong:** Calling `clearDeadLetterQueue()` or `job.remove()` before understanding WHY jobs failed
**Why it happens:** Desire to "clean up" production queues without investigation
**How to avoid:**
1. Export failed job data to JSON/CSV first
2. Identify patterns (same error? same match? same time range?)
3. Fix root cause in code
4. THEN clear DLQ and re-queue with fixes deployed
**Warning signs:** Failed jobs disappear but underlying issue persists, failures re-accumulate

### Pitfall 4: Race Conditions on Concurrent Settlement
**What goes wrong:** Two settlement jobs for same match run simultaneously, both try to score same predictions
**Why it happens:** Live-score worker triggers settlement when match finishes, backfill worker also triggers settlement for same match
**How to avoid:** Already handled correctly in codebase via:
- Row-level locking (`FOR UPDATE`) in `scorePredictionsTransactional()`
- Idempotent job IDs (`settle-${matchId}`) prevent duplicate jobs
- Transaction checks for `status='pending'` before scoring
**Warning signs:** Database deadlock errors, predictions scored twice, duplicate points awarded

### Pitfall 5: Backfill Missing Zero-Prediction Matches
**What goes wrong:** `getMatchesNeedingScoring()` uses INNER JOIN with predictions table, so finished matches with zero predictions never appear in results
**Why it happens:** SQL query assumes at least one prediction exists
**How to avoid:** Add separate query for finished matches with zero predictions:
```sql
SELECT * FROM matches
WHERE status = 'finished'
  AND NOT EXISTS (
    SELECT 1 FROM predictions
    WHERE predictions.match_id = matches.id
  )
```
**Warning signs:** Manual database query shows finished matches with zero predictions, but backfill worker doesn't trigger settlement

## Code Examples

Verified patterns from official sources:

### Investigating Failed Settlement Jobs
```typescript
// Source: BullMQ API docs + existing codebase pattern
import { getSettlementQueue } from '@/lib/queue';
import { getDeadLetterJobs, getDeadLetterCount } from '@/lib/queue/dead-letter';

// Step 1: Check DLQ (permanent failures)
const dlqJobs = await getDeadLetterJobs(50, 0);
const dlqCount = await getDeadLetterCount();

console.log(`Found ${dlqCount} failed jobs in DLQ`);
for (const entry of dlqJobs) {
  console.log({
    jobId: entry.jobId,
    matchId: entry.data.matchId,
    reason: entry.failedReason,
    attempts: entry.attemptsMade,
    timestamp: entry.timestamp,
  });
}

// Step 2: Check queue failed set (recent failures, still retrying)
const settlementQueue = getSettlementQueue();
const failedJobs = await settlementQueue.getFailed(0, -1);
const failedCount = await settlementQueue.getFailedCount();

console.log(`Found ${failedCount} failed jobs in queue (not yet DLQ)`);
for (const job of failedJobs) {
  console.log({
    id: job.id,
    matchId: job.data.matchId,
    reason: job.failedReason,
    stacktrace: job.stacktrace?.split('\n').slice(0, 3), // First 3 lines
  });
}
```

### Handling Zero-Prediction Matches Gracefully
```typescript
// Source: Recommended pattern based on codebase analysis
// Location: src/lib/queue/workers/scoring.worker.ts (line 64 modification)

// Get all predictions for this match
const predictions = await getPredictionsForMatch(matchId);

if (predictions.length === 0) {
  // Check if match was analyzed (indicates predictions SHOULD exist)
  const analysisData = await getAnalysisForMatch(matchId);

  if (analysisData?.analysis) {
    // Match was analyzed but has no predictions - pipeline failure!
    // Throw error to trigger BullMQ retry (exponential backoff)
    log.warn({ matchId }, 'Match has analysis but zero predictions - upstream pipeline issue');
    throw new Error(
      `Settlement failed: match ${matchId} has analysis but zero predictions. ` +
      `This indicates prediction worker never ran or all predictions failed.`
    );
  } else {
    // Match never analyzed - won't have predictions (expected for old/imported matches)
    log.info({ matchId }, 'Match skipped settlement - no analysis/predictions by design');
    return {
      skipped: true,
      reason: 'no_analysis_or_predictions',
      expected: true, // Flag for monitoring - this is NOT an error
    };
  }
}

// Continue with normal scoring...
log.info(`Found ${predictions.length} predictions`);
```

### Manual Retry of Failed Settlement Jobs
```typescript
// Source: BullMQ manual retry pattern
// Location: Admin script or API endpoint

import { getSettlementQueue } from '@/lib/queue';

const settlementQueue = getSettlementQueue();

// Get failed jobs
const failedJobs = await settlementQueue.getFailed(0, -1);

for (const job of failedJobs) {
  try {
    // Option 1: Retry existing job (preserves original data)
    await job.retry();
    console.log(`Retried job ${job.id}`);

    // Option 2: Remove and re-queue with fresh data (if match state changed)
    await job.remove();
    await settlementQueue.add(
      'settle-match',
      {
        matchId: job.data.matchId,
        // Fetch fresh match data from database
        homeScore: freshMatch.homeScore,
        awayScore: freshMatch.awayScore,
        status: freshMatch.status,
      },
      { jobId: `settle-retry-${job.data.matchId}` }
    );
    console.log(`Re-queued job ${job.id} with fresh data`);
  } catch (error) {
    console.error(`Failed to retry job ${job.id}:`, error);
  }
}
```

### Backfill Settlement for Zero-Prediction Matches
```typescript
// Source: Extension of existing backfill.worker.ts pattern
// Location: src/lib/queue/workers/backfill.worker.ts (new section)

// NEW: Find finished matches with zero predictions
const finishedWithZeroPredictions = await db
  .select()
  .from(matches)
  .where(
    and(
      eq(matches.status, 'finished'),
      // Only matches from last 7 days (don't backfill entire history)
      gte(matches.kickoffTime, sevenDaysAgo.toISOString()),
      // Must have final score to settle
      isNotNull(matches.homeScore),
      isNotNull(matches.awayScore)
    )
  )
  .leftJoin(predictions, eq(matches.id, predictions.matchId))
  .having(sql`COUNT(${predictions.id}) = 0`) // Zero predictions
  .groupBy(matches.id);

for (const match of finishedWithZeroPredictions) {
  // Check if match has analysis (indicates pipeline failure)
  const analysis = await getAnalysisForMatch(match.id);

  if (analysis?.analysis) {
    // Pipeline failure - trigger settlement (will retry/fail appropriately)
    await settlementQueue.add(
      'settle-match',
      {
        matchId: match.id,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
      },
      {
        jobId: `settle-backfill-zero-${match.id}`,
        priority: 2, // Lower priority than normal settlement
      }
    );
    log.info({ matchId: match.id }, 'Queued settlement for match with analysis but zero predictions');
  } else {
    // No analysis - expected skip, don't queue
    log.debug({ matchId: match.id }, 'Skipped match with no analysis/predictions (by design)');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skip zero-prediction matches silently | Distinguish temporary vs permanent zero-predictions | Phase 50 | Reveals upstream pipeline failures instead of hiding them |
| Manual failed job inspection via Redis CLI | DLQ web UI + API (`/api/admin/dlq`) | v2.3 (PIPE-04) | Faster root cause analysis, non-technical admins can investigate |
| Queue failed jobs indefinitely | 7-day retention + DLQ for permanent failures | BullMQ default + v2.3 | Prevents Redis memory exhaustion while preserving debug data |
| Application-level retry counters | BullMQ automatic retry with exponential backoff | BullMQ design | Simpler code, battle-tested retry logic |

**Deprecated/outdated:**
- **Manual transaction rollback:** Drizzle auto-rollback on error is safer
- **Bull (v3):** Superseded by BullMQ with better TypeScript and performance
- **Custom job deduplication logic:** BullMQ `jobId` handles this at queue level

## Open Questions

Things that couldn't be fully resolved:

1. **What is the actual distribution of the 43 failed settlement jobs?**
   - What we know: STATE.md mentions 43 failed jobs in production
   - What's unclear: Are these in DLQ or queue failed set? What time range? Same error or different?
   - Recommendation: Run investigation script to query DLQ and settlement queue, export data for pattern analysis

2. **How many finished matches from last 7 days have zero predictions?**
   - What we know: STATE.md says "Last 7 days of matches may be missing predictions entirely"
   - What's unclear: Is this ALL matches or specific leagues/dates?
   - Recommendation: SQL query to count finished matches with zero predictions, grouped by date and league

3. **Did Phase 49 fixes prevent new zero-prediction matches?**
   - What we know: Phase 49 fixed scheduling (PIPE-01 to PIPE-05) and widened backfill windows
   - What's unclear: Are new matches (after Phase 49 deploy) getting predictions consistently?
   - Recommendation: Compare prediction coverage rate before/after Phase 49 deploy timestamp

4. **Should old matches (>7 days) be backfilled retroactively?**
   - What we know: Phase 51 plans retroactive backfill script (RETRO-01 to RETRO-06)
   - What's unclear: Is Phase 50 scope limited to fixing pipeline + settling recent matches, or does it include historical backfill?
   - Recommendation: Phase 50 = fix pipeline + settle last 7 days, Phase 51 = full historical backfill

## Sources

### Primary (HIGH confidence)
- BullMQ Official Documentation - [Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- BullMQ Official Documentation - [Job Getters API](https://docs.bullmq.io/guide/jobs/getters)
- BullMQ API Reference - [Queue.getFailed()](https://api.docs.bullmq.io/classes/v4.Queue.html)
- Existing Codebase - `src/lib/queue/dead-letter.ts` (DLQ implementation)
- Existing Codebase - `src/lib/queue/workers/scoring.worker.ts` (settlement worker)
- Existing Codebase - `src/lib/queue/workers/backfill.worker.ts` (backfill pattern)
- Existing Codebase - `src/lib/db/queries.ts` (transaction + locking pattern)

### Secondary (MEDIUM confidence)
- OneUpTime Blog - [How to Handle Stalled Jobs in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-stalled-jobs/view) (2026 article)
- OneUpTime Blog - [How to Handle Worker Crashes in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-worker-crashes-recovery/view) (2026 article)
- UpQueue Blog - [Fixing Stalled Jobs in BullMQ: A Practical Debugging Guide](https://upqueue.io/blog/bullmq-stalled-jobs-debug-guide/)
- PostgreSQL Best Practices - [Preventing Race Conditions with SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/)
- SQL for Devs - [Transactional Locking to Prevent Race Conditions](https://sqlfordevs.com/transaction-locking-prevent-race-condition)

### Tertiary (LOW confidence)
- Medium Article - [Why Transactions Don't Eliminate Race Conditions](https://medium.com/codetodeploy/why-transactions-dont-eliminate-race-conditions-a-guide-to-database-isolation-levels-fa4a7d43cf60)
- DEV Community - [Winning Race Conditions With PostgreSQL](https://dev.to/mistval/winning-race-conditions-with-postgresql-54gn)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ is industry standard, already integrated in codebase
- Architecture: HIGH - DLQ pattern exists in codebase, transaction pattern verified in queries.ts
- Pitfalls: HIGH - Zero-prediction edge case identified in scoring.worker.ts line 64-66
- Backfill pattern: MEDIUM - Pattern exists but needs extension for zero-prediction case
- Failed job count: LOW - Need production investigation to confirm "43 failed jobs" claim

**Research date:** 2026-02-06
**Valid until:** 30 days (2026-03-08) - BullMQ is stable, patterns unlikely to change
