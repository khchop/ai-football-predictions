# Phase 49: Pipeline Scheduling Fixes - Research

**Researched:** 2026-02-06
**Domain:** BullMQ job scheduling, catch-up patterns, gap detection
**Confidence:** HIGH

## Summary

Phase 49 addresses critical gaps in the pipeline scheduling system where matches within 48 hours of kickoff are not receiving analysis/predictions/lineups jobs after server restart. The current implementation has three major flaws:

1. **Scheduler skips past-due matches**: `scheduleMatchJobs()` returns early when `kickoff <= now` (line 113 of scheduler.ts), preventing any job scheduling for matches where the scheduled time has passed
2. **Fixtures worker only schedules new matches**: Line 90 checks `isNewMatch` before calling `scheduleMatchJobs()`, so existing matches never get jobs even if they're missing
3. **Backfill windows too narrow**: Checks 12h for analysis (should be 48h) and 2h for predictions (should be 12h), missing matches that need recovery

The solution requires three complementary strategies: **catch-up scheduling** (handle past-due matches on startup), **gap detection** (identify matches with no delayed/active jobs), and **dependency chain completion** (ensure analysis → lineups → predictions sequence completes).

**Primary recommendation:** Implement deterministic job IDs, use BullMQ's `getJob()`/`getDelayed()`/`getActive()` for gap detection, widen backfill windows to 48h/12h, and add dependency chain validation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.x (2.0+) | Redis-based job queue | Industry standard for Node.js job scheduling, handles delayed jobs natively in workers (no QueueScheduler needed in 2.0+) |
| Redis | 7.x | Job persistence | BullMQ's backing store, ensures jobs survive restarts |
| Drizzle ORM | Current | Database queries | Used for gap detection queries (getMatchesMissing*, getUpcomingMatches) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bull Board | Latest | Queue monitoring | Essential for verifying delayed jobs exist (Success Criterion 5) |
| Pino Logger | Current | Structured logging | Track scheduling decisions, gap detection results |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | node-cron + custom persistence | BullMQ provides Redis persistence, delayed jobs, retry logic out-of-box |
| Database queries for gap detection | Redis-only inspection | Database is source of truth for match state, Redis only tracks jobs |

**Installation:**
```bash
# Already installed - no new dependencies needed
```

## Architecture Patterns

### Recommended Separation of Concerns
```
src/lib/queue/
├── scheduler.ts           # Job creation logic (scheduleMatchJobs)
├── catch-up.ts           # Startup recovery (catchUpScheduling)
├── workers/
│   ├── fixtures.worker.ts  # New match ingestion from API
│   └── backfill.worker.ts  # Periodic gap detection (hourly)
└── gap-detection.ts      # NEW: Centralized gap detection logic
```

### Pattern 1: Catch-Up Scheduling on Startup
**What:** On server restart, iterate all upcoming matches (48h window) and schedule missing jobs
**When to use:** Application startup, after deployment
**Current implementation:** `catch-up.ts:catchUpScheduling()` - calls `scheduleMatchJobs()` for all matches
**Problem:** `scheduleMatchJobs()` exits early for past-due matches (line 113)

**Fix pattern:**
```typescript
// Source: Current codebase analysis + BullMQ idempotent jobs pattern
export async function scheduleMatchJobs(data: MatchWithCompetition): Promise<number> {
  const { match, competition } = data;
  const kickoff = new Date(match.kickoffTime).getTime();
  const now = Date.now();

  // REMOVE THIS EARLY EXIT - it prevents catch-up scheduling
  // if (kickoff <= now) {
  //   log.info({ matchId: match.id }, 'Match already started, skipping job scheduling');
  //   return 0;
  // }

  // Instead: calculate appropriate delay for each job type
  const jobsToSchedule = [
    {
      queue: analysisQueue,
      name: JOB_TYPES.ANALYZE_MATCH,
      delay: Math.max(0, kickoff - 6 * 60 * 60 * 1000 - now), // T-6h or immediate
      jobId: `analyze-${match.id}`,
    },
    // ... other jobs
  ];

  for (const job of jobsToSchedule) {
    // Check if job already exists (idempotent pattern)
    const existingJob = await job.queue.getJob(job.jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting' || state === 'active') {
        continue; // Job already scheduled
      }
      // Remove stale completed/failed jobs
      await existingJob.remove();
    }

    await job.queue.add(job.name, job.data, {
      delay: job.delay > 0 ? job.delay : 1000, // Min 1s delay to avoid race conditions
      jobId: job.jobId,
      priority: calculateDynamicPriority(basePriority, kickoffDate, job.name),
    });
  }
}
```

### Pattern 2: Gap Detection via Database + Redis Inspection
**What:** Query database for matches missing data, cross-check Redis for existing jobs, schedule only truly missing jobs
**When to use:** Backfill worker (hourly), after fixtures worker completes
**Current implementation:** `backfill.worker.ts` queries DB but doesn't verify job existence in Redis

**Enhanced pattern:**
```typescript
// Source: BullMQ Queue API docs + current codebase
async function detectMissingJobs(hoursAhead: number): Promise<Match[]> {
  // 1. Database query: matches missing data
  const matchesMissingAnalysis = await getMatchesMissingAnalysis(hoursAhead);

  // 2. Redis inspection: check for delayed/active jobs
  const trulyMissing: Match[] = [];

  for (const match of matchesMissingAnalysis) {
    const jobId = `analyze-${match.id}`;
    const existingJob = await analysisQueue.getJob(jobId);

    if (!existingJob) {
      trulyMissing.push(match);
      continue;
    }

    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      // Job ran but DB still shows missing data - DB/Redis out of sync
      trulyMissing.push(match);
    }
    // If delayed/waiting/active, job exists - don't re-schedule
  }

  return trulyMissing;
}
```

### Pattern 3: Dependency Chain Validation
**What:** Ensure analysis → lineups → predictions chain completes (not just individual steps)
**When to use:** Backfill worker, after individual gap detection
**Current implementation:** Missing - backfill checks each step independently

**Chain validation pattern:**
```typescript
// Source: Workflow task chaining pattern from Dapr/JobRunr
interface PipelineState {
  hasAnalysis: boolean;
  hasLineups: boolean;
  hasPredictions: boolean;
}

async function validatePipelineChain(match: Match): Promise<string[]> {
  const missing: string[] = [];

  // Check pipeline state
  const state = await getPipelineState(match.id);

  // Analysis is prerequisite for lineups and predictions
  if (!state.hasAnalysis) {
    missing.push('analysis');
    return missing; // Can't proceed without analysis
  }

  // Lineups is prerequisite for predictions (within 12h of kickoff)
  const hoursToKickoff = (new Date(match.kickoffTime).getTime() - Date.now()) / (60 * 60 * 1000);

  if (hoursToKickoff < 12 && !state.hasLineups) {
    missing.push('lineups');
  }

  if (hoursToKickoff < 12 && state.hasLineups && !state.hasPredictions) {
    missing.push('predictions');
  }

  return missing;
}
```

### Pattern 4: Idempotent Job Scheduling
**What:** Use deterministic job IDs to prevent duplicate scheduling
**When to use:** Always - all job scheduling calls
**Current implementation:** Partially implemented (job IDs like `analyze-${match.id}`)

**Best practices:**
```typescript
// Source: BullMQ idempotent jobs pattern docs
// ✅ GOOD: Deterministic IDs based on business logic
const jobId = `analyze-${match.id}`;
const jobId = `predict-${match.id}`;
const jobId = `lineups-${match.id}`;

// ❌ BAD: Random/timestamp-based IDs
const jobId = `analyze-${Date.now()}`; // Creates duplicates
const jobId = `analyze-${uuidv4()}`; // No deduplication
```

### Anti-Patterns to Avoid

**Anti-pattern 1: Early exit based on time check**
```typescript
// ❌ BAD: Prevents catch-up scheduling
if (kickoff <= now) {
  return 0; // Skips all job scheduling
}

// ✅ GOOD: Calculate delay, let BullMQ handle timing
const delay = Math.max(0, targetTime - now);
await queue.add(name, data, { delay });
```

**Anti-pattern 2: Narrow time windows**
```typescript
// ❌ BAD: Misses matches needing recovery
await getMatchesMissingAnalysis(12); // Only 12h ahead
await getMatchesMissingPredictions(2); // Only 2h ahead

// ✅ GOOD: Wide windows for catch-up
await getMatchesMissingAnalysis(48); // Full 48h window
await getMatchesMissingPredictions(12); // 12h for predictions
```

**Anti-pattern 3: Database-only gap detection**
```typescript
// ❌ BAD: Ignores Redis job state
const missing = await getMatchesMissingAnalysis(48);
for (const match of missing) {
  await scheduleJob(match); // May create duplicates
}

// ✅ GOOD: Cross-check Redis before scheduling
const missing = await getMatchesMissingAnalysis(48);
for (const match of missing) {
  const existingJob = await queue.getJob(`analyze-${match.id}`);
  if (!existingJob || await existingJob.getState() === 'failed') {
    await scheduleJob(match);
  }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job persistence across restarts | Custom job state management in DB | BullMQ with Redis | BullMQ stores jobs in Redis, survives restarts automatically |
| Delayed job promotion | Custom polling loop to check timestamps | BullMQ workers (v2.0+) | Workers handle delayed job promotion natively (QueueScheduler deprecated) |
| Duplicate job prevention | Application-level locking | Deterministic job IDs + BullMQ's getJob() | BullMQ prevents duplicates when same jobId used |
| Stalled job recovery | Manual monitoring + restart | BullMQ stalled job detection | Configurable stalledInterval and maxStalledCount handle crashes |

**Key insight:** BullMQ already handles 90% of scheduling complexity (persistence, delayed promotion, stalled recovery). The application's responsibility is:
1. Create jobs with correct delays and deterministic IDs
2. Query database for business logic gaps (missing analysis/predictions)
3. Cross-check Redis to avoid duplicate scheduling
4. Don't try to replace BullMQ's built-in mechanisms

## Common Pitfalls

### Pitfall 1: Assuming Job Exists Because Database Shows Scheduled Status
**What goes wrong:** Match has `status='scheduled'` in DB, but no BullMQ job exists in Redis (server restarted before jobs created)
**Why it happens:** Database and Redis are separate systems - DB persists matches, Redis persists jobs
**How to avoid:** Always cross-check both:
```typescript
// Check DB for match state
const match = await getMatch(matchId);
if (match.status !== 'scheduled') return;

// Check Redis for job state
const job = await analysisQueue.getJob(`analyze-${matchId}`);
if (!job) {
  // Gap detected - schedule missing job
}
```
**Warning signs:** Bull Board shows empty delayed queue after restart, but DB shows upcoming matches

### Pitfall 2: Fixtures Worker Skipping Existing Matches
**What goes wrong:** After restart, fixtures worker fetches matches from API but only schedules jobs for `isNewMatch` (line 90)
**Why it happens:** Original design assumed continuous uptime - new matches arrive every 6 hours, get scheduled immediately
**How to avoid:** Remove `isNewMatch` check OR add separate catch-up logic:
```typescript
// Option A: Remove isNewMatch check (schedule for all)
if (mapFixtureStatus(fixture.fixture.status.short) === 'scheduled') {
  await scheduleMatchJobs({ match, competition });
}

// Option B: Keep isNewMatch, but add catch-up
if (isNewMatch) {
  await scheduleMatchJobs({ match, competition });
} else {
  // Existing match - check if jobs exist
  await catchUpIfMissing(match, competition);
}
```
**Warning signs:** Logs show "Fetched X fixtures, scheduled 0 jobs" after restart

### Pitfall 3: Backfill Windows Too Narrow
**What goes wrong:** Backfill checks 12h for analysis, 2h for predictions, but matches 13-48h away are missed
**Why it happens:** Windows sized for normal operation (analysis 6h before kickoff), not recovery (need to check 48h window)
**How to avoid:** Use wide windows that match the actual scheduling horizon:
```typescript
// Analysis scheduled at T-6h, so check full 48h window
const missingAnalysis = await getMatchesMissingAnalysis(48); // not 12

// Predictions scheduled at T-30m, check 12h window for safety
const missingPredictions = await getMatchesMissingPredictions(12); // not 2
```
**Warning signs:** Matches 24-48 hours away have no delayed jobs in Bull Board

### Pitfall 4: Race Conditions from Parallel Scheduling
**What goes wrong:** Catch-up runs during startup, fixtures worker runs simultaneously, both try to schedule same match
**Why it happens:** Multiple code paths can detect gap and schedule job (catch-up, fixtures, backfill)
**How to avoid:** Deterministic job IDs + idempotent add pattern:
```typescript
try {
  await queue.add(name, data, { jobId: `analyze-${matchId}` });
} catch (error) {
  if (error.message?.includes('already exists')) {
    // Race condition - another process scheduled it
    log.debug('Job already exists (race condition), skipping');
    continue;
  }
  throw error;
}
```
**Warning signs:** BullMQ errors about duplicate job IDs in logs

### Pitfall 5: Incomplete Dependency Chains
**What goes wrong:** Match has analysis but missing lineups, backfill schedules predictions anyway (will fail without lineup data)
**Why it happens:** Backfill checks each step independently (`getMatchesMissingPredictions` only checks `predictions.id` is null)
**How to avoid:** Validate prerequisites before scheduling:
```typescript
// Before scheduling predictions
const analysis = await getMatchAnalysis(matchId);
if (!analysis?.lineupsAvailable) {
  log.warn('Cannot schedule predictions without lineups');
  // Schedule lineups first, predictions will be backfilled later
  return;
}
```
**Warning signs:** Prediction jobs fail with "No lineup data available" errors

## Code Examples

Verified patterns from current codebase analysis:

### Catch-Up Scheduling Entry Point
```typescript
// Source: src/lib/queue/catch-up.ts (current implementation)
export async function catchUpScheduling(): Promise<{ scheduled: number; matches: number }> {
  log.info('Starting catch-up scheduling for existing matches');

  // Get all upcoming matches in next 48 hours
  const upcomingMatches = await getUpcomingMatches(48);

  let totalScheduled = 0;

  for (const { match, competition } of upcomingMatches) {
    try {
      const scheduled = await scheduleMatchJobs({ match, competition });
      totalScheduled += scheduled;
    } catch (error: any) {
      log.error({ matchId: match.id, error: error.message }, 'Failed to schedule jobs for match');
    }
  }

  return { scheduled: totalScheduled, matches: upcomingMatches.length };
}
```

### Gap Detection Query Pattern
```typescript
// Source: src/lib/db/queries.ts (current implementation)
export async function getMatchesMissingAnalysis(hoursAhead: number = 12): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const results = await db
    .select({ match: matches })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString()),
        isNotNull(matches.externalId),
        isNull(matchAnalysis.id) // No analysis record exists
      )
    )
    .orderBy(matches.kickoffTime);

  return results.map(r => r.match);
}
```

### Job Existence Check Pattern
```typescript
// Source: src/lib/queue/scheduler.ts lines 207-222 (current implementation)
// Check for stale completed/failed jobs that would block scheduling
try {
  const existingJob = await job.queue.getJob(job.jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
      log.debug({ jobId: job.jobId, oldState: state }, 'Removed stale job before scheduling');
    } else if (state === 'active' || state === 'waiting' || state === 'delayed') {
      // Job already exists and is running/queued - skip
      log.debug({ jobId: job.jobId, state }, 'Job already exists and is active/queued, skipping');
      continue;
    }
  }
} catch (e) {
  // Ignore errors checking for existing job - proceed with scheduling
}
```

### Dynamic Priority Calculation
```typescript
// Source: src/lib/queue/scheduler.ts lines 72-100 (current implementation)
export function calculateDynamicPriority(
  basePriority: number,
  kickoffTime: Date,
  jobType: string
): number {
  const now = Date.now();
  const kickoff = kickoffTime.getTime();
  const timeUntilKickoff = kickoff - now;

  const HOUR = 60 * 60 * 1000;
  const MIN_PRIORITY = JOB_PRIORITIES.CRITICAL;

  if (timeUntilKickoff < 0) {
    // Match started - highest priority for live updates
    return JOB_PRIORITIES.CRITICAL;
  } else if (timeUntilKickoff < 30 * 60 * 1000) {
    // Within 30 minutes - critical (boost by 5)
    return Math.max(MIN_PRIORITY, basePriority - 5);
  } else if (timeUntilKickoff < 1 * HOUR) {
    // Within 1 hour - escalate significantly (boost by 3)
    return Math.max(JOB_PRIORITIES.HIGH, basePriority - 3);
  } else if (timeUntilKickoff < 3 * HOUR) {
    // Within 3 hours - moderate escalation (boost by 2)
    return Math.max(JOB_PRIORITIES.NORMAL, basePriority - 2);
  }

  return basePriority;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| QueueScheduler class | Workers handle delayed job promotion | BullMQ 2.0 (2021) | Simpler architecture, one less process to manage |
| Random job IDs | Deterministic job IDs | BullMQ best practice evolution | Enables idempotent scheduling, prevents duplicates |
| Fixed time windows (12h/2h) | Adaptive windows (48h/12h) | Phase 49 fix | Catches gaps missed by narrow windows |
| New-match-only scheduling | Catch-up + continuous scheduling | Phase 49 fix | Survives restarts without missing matches |

**Deprecated/outdated:**
- **QueueScheduler**: Deprecated in BullMQ 2.0+, delayed job promotion now handled by workers automatically
- **immediately: true in repeatable jobs**: Deprecated in BullMQ 5.19.0, new behavior always immediate for first execution

## Open Questions

Things that couldn't be fully resolved:

1. **BullMQ Delayed Job Promotion Timing**
   - What we know: Workers handle delayed job promotion automatically in BullMQ 2.0+
   - What's unclear: Exact polling interval for delayed job promotion (is it configurable?)
   - Recommendation: Test with Bull Board monitoring to verify delayed jobs promote at correct times

2. **Race Condition Window Between Fixtures Worker and Catch-Up**
   - What we know: Both can run simultaneously during startup (fixtures on 6h cron, catch-up on startup)
   - What's unclear: Does BullMQ's jobId deduplication fully prevent race conditions, or can gaps occur?
   - Recommendation: Add mutex or startup flag to ensure catch-up completes before fixtures worker runs

3. **Optimal Backfill Frequency**
   - What we know: Current implementation runs hourly
   - What's unclear: Is 1 hour too frequent (Redis load) or too slow (gap persists too long)?
   - Recommendation: Monitor Bull Board after changes - if gaps resolve within 1 hour, keep hourly

4. **Job State vs Database State Consistency**
   - What we know: Redis (job state) and Postgres (match data) can be out of sync after job completes
   - What's unclear: Should backfill trust DB state only, or cross-check both systems?
   - Recommendation: Trust DB for business logic (missing data), trust Redis for scheduling state (job exists)

## Sources

### Primary (HIGH confidence)
- [BullMQ Official Docs - Delayed Jobs](https://docs.bullmq.io/guide/jobs/delayed)
- [BullMQ Official Docs - QueueScheduler (deprecated)](https://docs.bullmq.io/guide/queuescheduler)
- [BullMQ Official Docs - Idempotent Jobs Pattern](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ API Documentation - Queue Methods](https://api.docs.bullmq.io/classes/v4.Queue.html)
- Current codebase: `src/lib/queue/scheduler.ts`, `catch-up.ts`, `workers/backfill.worker.ts`

### Secondary (MEDIUM confidence)
- [How to Handle Stalled Jobs in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-stalled-jobs/view) - January 2026 article on stall detection
- [How to Handle Worker Crashes in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-worker-crashes-recovery/view) - January 2026 recovery patterns
- [How to Implement Custom Job IDs in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-custom-job-ids/view) - Deterministic ID patterns
- [Better Stack - Job Scheduling in Node.js with BullMQ](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [Dapr Workflow Patterns - Task Chaining](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-patterns/) - Dependency chain patterns
- [JobRunr Workflows - Job Chaining](https://www.jobrunr.io/en/documentation/pro/job-chaining/)

### Tertiary (LOW confidence)
- GitHub Issues: [BullMQ #2466 - Worker stopped processing delayed jobs](https://github.com/taskforcesh/bullmq/issues/2466)
- GitHub Issues: [BullMQ #1656 - Jobs stuck in delayed state](https://github.com/taskforcesh/bullmq/issues/1656)
- [Medium - Distributed Scheduling Using Redis](https://medium.com/@rickymondal/distributed-scheduling-bullmq-a13ecbb38341)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ is established, patterns verified in codebase
- Architecture: HIGH - Current codebase analysis + BullMQ official docs
- Pitfalls: HIGH - Directly observed in current code (lines 90, 113) and production logs

**Research date:** 2026-02-06
**Valid until:** 30 days (BullMQ is stable, patterns unlikely to change rapidly)
