# Phase 51: Retroactive Backfill Script - Research

**Researched:** 2026-02-06
**Domain:** Retroactive prediction generation, idempotent batch processing, BullMQ job scheduling
**Confidence:** HIGH

## Summary

Phase 51 addresses matches from the last 7 days that are missing predictions due to pipeline failures (scheduler restarts, API issues, worker crashes). Unlike Phase 49 (forward-looking catch-up) and Phase 50 (settlement recovery), this phase generates predictions **retroactively** - even for matches that have already finished - using pre-match data available at kickoff time.

The core challenge: generating predictions for finished matches requires using **historical context** (H2H, standings, form as they existed before kickoff) not current state. The platform already has the infrastructure for this - API-Football provides historical data, and the prediction pipeline uses pre-match analysis stored in `match_analysis` table. The key innovation is running predictions AFTER the match finishes but BEFORE accessing final scores, treating it as if the prediction was made pre-match.

Three critical patterns emerge:
1. **Gap Detection**: Query database for matches with `predictions.length < 42` (active model count)
2. **Retroactive Analysis**: For matches missing analysis, fetch historical API-Football data (H2H, standings available at kickoff-1 day)
3. **Immediate Scoring**: Finished match predictions score immediately using Kicktipp quota system, live/upcoming predictions stored for future scoring

**Primary recommendation:** Build one-shot script using existing pipeline workers (analysis → predictions → scoring), leverage deterministic job IDs for idempotency, and handle pre-match vs post-match state carefully.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.x | Job queue for analysis/predictions/scoring | Already integrated, provides idempotent job scheduling with deterministic IDs |
| Drizzle ORM | Latest | Database queries and transactions | Type-safe queries with transaction support for atomic scoring |
| API-Football | v3 | Historical match data | Official data source - H2H, standings, form, lineups all available retroactively |
| Pino | Latest | Structured logging | Fast JSON logging for tracking backfill progress |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit | Latest | Concurrency control | Limit parallel API calls to respect rate limits (300ms between requests) |
| dotenv | Latest | Environment config | Script runs outside Next.js, needs `.env.local` loading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ job queue | Direct worker execution | Queue provides retry logic, priority, progress tracking - essential for large backfills |
| Script-based approach | API endpoint | Script is safer - no HTTP timeout limits, can run for hours, explicit transaction control |
| Batch insert predictions | Individual inserts | Batch is faster but script already limits concurrency via job queue |

**Installation:**
```bash
# All dependencies already installed
npm install bullmq drizzle-orm p-limit dotenv
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── backfill-retroactive-predictions.ts   # Main script
└── output/
    └── backfill-report-[timestamp].json  # Progress logs

src/lib/queue/workers/
├── analysis.worker.ts    # Existing - reuse for retroactive analysis
├── predictions.worker.ts # Existing - reuse for retroactive predictions
└── scoring.worker.ts     # Existing - handles immediate scoring
```

### Pattern 1: Gap Detection via Prediction Count
**What:** Identify matches with fewer than 42 predictions (active model count)
**When to use:** Script startup, identify backfill candidates
**Example:**
```typescript
// Source: Existing codebase pattern + retroactive extension
interface MatchGap {
  matchId: string;
  status: 'scheduled' | 'live' | 'finished';
  kickoffTime: string;
  predictionCount: number;
  hasAnalysis: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

async function findMatchesMissingPredictions(daysBehind: number = 7): Promise<MatchGap[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBehind);

  // Find ALL matches from last N days with prediction count < 42
  const results = await db
    .select({
      matchId: matches.id,
      status: matches.status,
      kickoffTime: matches.kickoffTime,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      hasAnalysis: sql<boolean>`${matchAnalysis.id} IS NOT NULL`,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
    })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        gte(matches.kickoffTime, cutoff.toISOString()),
        isNotNull(matches.externalId), // Must have API-Football ID for data fetching
      )
    )
    .groupBy(matches.id, matchAnalysis.id)
    .having(sql`COUNT(${predictions.id}) < 42`); // Active model count

  return results;
}
```

**Key insight:** Unlike forward-looking backfill (Phase 49), this queries **backwards in time** and includes finished matches.

### Pattern 2: Retroactive Analysis Generation
**What:** Generate analysis data using historical API-Football endpoints (H2H, standings, form)
**When to use:** Match has no analysis but needs predictions retroactively
**Example:**
```typescript
// Source: Existing analysis.worker.ts + API-Football historical data pattern
async function generateRetroactiveAnalysis(matchId: string): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match || !match.externalId) {
    throw new Error(`Match ${matchId} missing or no externalId`);
  }

  const log = loggers.backfillScript.child({ matchId });

  // Check if analysis already exists (idempotent)
  const existing = await getMatchAnalysisByMatchId(matchId);
  if (existing?.analysis) {
    log.info('Analysis already exists, skipping');
    return;
  }

  // Queue analysis job with deterministic ID
  const jobId = `analyze-retro-${matchId}`;
  const existingJob = await analysisQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (['delayed', 'waiting', 'active'].includes(state)) {
      log.info({ state }, 'Analysis job already queued');
      return;
    }
    // Remove failed/completed jobs
    await existingJob.remove();
  }

  // Add analysis job with IMMEDIATE execution (no delay for retroactive)
  await analysisQueue.add(
    JOB_TYPES.ANALYZE_MATCH,
    {
      matchId: match.id,
      externalId: match.externalId,
      homeTeamId: match.homeTeamApiId,
      awayTeamId: match.awayTeamApiId,
      competitionId: match.competitionId,
      // CRITICAL: Analysis worker uses API-Football's /fixtures/{id} endpoint
      // which returns historical data (H2H, standings, form) as they were pre-match
    },
    {
      jobId,
      delay: 1000, // Minimal delay for queue processing
      priority: 3, // Lower priority - retroactive, not time-sensitive
      attempts: 5,
      backoff: { type: 'exponential', delay: 30000 },
    }
  );

  log.info('Queued retroactive analysis job');
}
```

**Important:** API-Football's `/fixtures/{id}` endpoint returns **snapshot data from kickoff time**, not current data. H2H shows matches played before kickoff, standings reflect table position at that date.

### Pattern 3: Retroactive Prediction Generation
**What:** Generate predictions using pre-match context (analysis, standings, H2H) for matches that may have already finished
**When to use:** After analysis exists or already existed
**Example:**
```typescript
// Source: Existing predictions.worker.ts with retroactive safety checks
async function generateRetroactivePredictions(matchId: string): Promise<void> {
  const log = loggers.backfillScript.child({ matchId });

  // 1. Verify analysis exists (prerequisite)
  const analysis = await getMatchAnalysisByMatchId(matchId);
  if (!analysis?.analysis) {
    throw new Error(`Match ${matchId} missing analysis - must run analysis first`);
  }

  // 2. Check prediction count (idempotent - allow partial prediction sets)
  const existing = await getPredictionsForMatch(matchId);
  if (existing.length >= 42) {
    log.info({ predictionCount: existing.length }, 'Already has 42+ predictions');
    return;
  }

  // 3. Queue prediction job with deterministic ID
  const jobId = `predict-retro-${matchId}`;
  const existingJob = await predictionsQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (['delayed', 'waiting', 'active'].includes(state)) {
      log.info({ state }, 'Prediction job already queued');
      return;
    }
    await existingJob.remove();
  }

  // 4. Add prediction job
  // NOTE: Predictions worker checks match.status and skips if not 'scheduled'
  // For retroactive backfill, we need to OVERRIDE this check OR temporarily change status
  await predictionsQueue.add(
    JOB_TYPES.PREDICT_MATCH,
    {
      matchId,
      skipIfDone: true, // Skip if predictions already exist (handles partial backfills)
    },
    {
      jobId,
      delay: 1000,
      priority: 3,
      attempts: 5,
      backoff: { type: 'exponential', delay: 30000 },
    }
  );

  log.info('Queued retroactive prediction job');
}
```

**CRITICAL ISSUE:** The existing `predictions.worker.ts` line 104-107 exits early if `match.status !== 'scheduled'`. Retroactive backfill needs predictions for finished matches. Two solutions:

**Option A:** Add `allowRetroactive` flag to `PredictMatchPayload`:
```typescript
interface PredictMatchPayload {
  matchId: string;
  skipIfDone?: boolean;
  allowRetroactive?: boolean; // NEW: Skip status check for backfill
}

// In predictions.worker.ts line 104:
if (match.status !== 'scheduled' && !allowRetroactive) {
  return { skipped: true, reason: 'match_not_scheduled' };
}
```

**Option B:** Use separate prediction generation function that bypasses worker status check (safer for production).

### Pattern 4: Immediate Scoring for Finished Matches
**What:** Finished matches with new predictions score immediately using Kicktipp quota system
**When to use:** After retroactive predictions generated for finished match
**Example:**
```typescript
// Source: Existing scoring.worker.ts with immediate settlement pattern
async function scoreFinishedMatch(matchId: string): Promise<void> {
  const match = await getMatchById(matchId);
  if (!match || match.status !== 'finished') {
    log.info({ matchId, status: match?.status }, 'Match not finished, skipping scoring');
    return;
  }

  const log = loggers.backfillScript.child({ matchId });

  // Check if predictions exist
  const predictions = await getPredictionsForMatch(matchId);
  if (predictions.length === 0) {
    log.warn('No predictions to score');
    return;
  }

  // Check if already scored
  const pendingCount = predictions.filter(p => p.status === 'pending').length;
  if (pendingCount === 0) {
    log.info('All predictions already scored');
    return;
  }

  // Queue settlement job with deterministic ID
  const jobId = `settle-retro-${matchId}`;
  const existingJob = await settlementQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (['delayed', 'waiting', 'active'].includes(state)) {
      log.info({ state }, 'Settlement job already queued');
      return;
    }
    await existingJob.remove();
  }

  await settlementQueue.add(
    JOB_TYPES.SETTLE_MATCH,
    {
      matchId: match.id,
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      status: match.status,
    },
    {
      jobId,
      delay: 1000,
      priority: 2, // Medium priority
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    }
  );

  log.info({ pendingCount }, 'Queued settlement for finished match');
}
```

**Key insight:** Scoring worker (Phase 50 fix) already handles zero-prediction case gracefully. This pattern triggers scoring only when predictions exist and are pending.

### Pattern 5: Idempotent Script Execution
**What:** Running script multiple times against same matches produces no duplicates
**When to use:** Always - script may fail mid-execution and need restart
**Example:**
```typescript
// Source: BullMQ idempotent jobs pattern + existing backfill-settlement.ts
async function backfillRetroactivePredictions(daysBehind: number = 7) {
  console.log(`🔍 Finding matches missing predictions (last ${daysBehind} days)...`);

  const stats = {
    matchesFound: 0,
    analysisQueued: 0,
    predictionsQueued: 0,
    scoringQueued: 0,
    duplicatesSkipped: 0,
    errors: [] as string[],
  };

  try {
    // 1. Find gaps
    const gaps = await findMatchesMissingPredictions(daysBehind);
    stats.matchesFound = gaps.length;

    console.log(`\n📊 Found ${gaps.length} matches with < 42 predictions`);
    console.log(`  - Finished: ${gaps.filter(g => g.status === 'finished').length}`);
    console.log(`  - Live: ${gaps.filter(g => g.status === 'live').length}`);
    console.log(`  - Scheduled: ${gaps.filter(g => g.status === 'scheduled').length}`);

    // 2. Process each gap
    for (const gap of gaps) {
      try {
        console.log(`\n🔄 Processing: ${gap.matchId} (${gap.status}, ${gap.predictionCount} predictions)`);

        // Step 1: Ensure analysis exists
        if (!gap.hasAnalysis) {
          await generateRetroactiveAnalysis(gap.matchId);
          stats.analysisQueued++;
          console.log('  ✓ Queued analysis');
          // Wait for analysis to complete before predictions
          await waitForJobCompletion(`analyze-retro-${gap.matchId}`, analysisQueue, 120000);
        } else {
          console.log('  ✓ Analysis exists');
        }

        // Step 2: Generate predictions
        await generateRetroactivePredictions(gap.matchId);
        stats.predictionsQueued++;
        console.log('  ✓ Queued predictions');

        // Wait for predictions to complete
        await waitForJobCompletion(`predict-retro-${gap.matchId}`, predictionsQueue, 300000);

        // Step 3: Score if finished
        if (gap.status === 'finished' && gap.homeScore !== null && gap.awayScore !== null) {
          await scoreFinishedMatch(gap.matchId);
          stats.scoringQueued++;
          console.log('  ✓ Queued scoring');
        } else {
          console.log('  ⏳ Match not finished - scoring will happen when match completes');
        }
      } catch (error: any) {
        const errorMsg = `Match ${gap.matchId}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }

    // 3. Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Matches found:        ${stats.matchesFound}`);
    console.log(`Analysis queued:      ${stats.analysisQueued}`);
    console.log(`Predictions queued:   ${stats.predictionsQueued}`);
    console.log(`Scoring queued:       ${stats.scoringQueued}`);
    console.log(`Duplicates skipped:   ${stats.duplicatesSkipped}`);
    console.log(`Errors:               ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    throw error;
  } finally {
    await closeQueueConnection();
  }
}
```

**Helper: Wait for job completion**
```typescript
async function waitForJobCompletion(
  jobId: string,
  queue: Queue,
  timeoutMs: number = 120000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    const state = await job.getState();

    if (state === 'completed') {
      return;
    }

    if (state === 'failed') {
      throw new Error(`Job ${jobId} failed: ${job.failedReason}`);
    }

    // Still processing
    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}
```

### Anti-Patterns to Avoid

**Anti-pattern 1: Using current state instead of historical state**
```typescript
// ❌ BAD: Fetches current standings, not standings at kickoff time
const standings = await getStandingsForLeagues([leagueId], CURRENT_SEASON);

// ✅ GOOD: API-Football's /fixtures/{id} endpoint returns historical context
// Analysis worker already uses this correctly - just queue analysis job
await analysisQueue.add(JOB_TYPES.ANALYZE_MATCH, { matchId, externalId });
```

**Anti-pattern 2: Running predictions before analysis completes**
```typescript
// ❌ BAD: Predictions job fails because analysis doesn't exist yet
await generateRetroactiveAnalysis(matchId);
await generateRetroactivePredictions(matchId); // Immediate - analysis not done

// ✅ GOOD: Wait for analysis job to complete
await generateRetroactiveAnalysis(matchId);
await waitForJobCompletion(`analyze-retro-${matchId}`, analysisQueue);
await generateRetroactivePredictions(matchId); // Safe now
```

**Anti-pattern 3: Modifying match status to bypass checks**
```typescript
// ❌ BAD: Temporarily changes status to trick predictions worker
await updateMatchStatus(matchId, 'scheduled'); // DANGEROUS
await generatePredictions(matchId);
await updateMatchStatus(matchId, 'finished'); // Race conditions, cache issues

// ✅ GOOD: Add allowRetroactive flag or use separate generation logic
await predictionsQueue.add(JOB_TYPES.PREDICT_MATCH, {
  matchId,
  allowRetroactive: true, // Explicit opt-in
});
```

**Anti-pattern 4: Scoring before predictions complete**
```typescript
// ❌ BAD: Settlement job finds zero predictions, marks as skipped
await generateRetroactivePredictions(matchId);
await scoreFinishedMatch(matchId); // Immediate - predictions not inserted yet

// ✅ GOOD: Wait for prediction job completion
await generateRetroactivePredictions(matchId);
await waitForJobCompletion(`predict-retro-${matchId}`, predictionsQueue);
await scoreFinishedMatch(matchId); // Now predictions exist
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue management | Custom async Promise.all() loop | BullMQ with deterministic job IDs | BullMQ provides retry logic, progress tracking, stalled job detection, and idempotency |
| Historical match data fetching | Web scraping or alternative APIs | API-Football `/fixtures/{id}` endpoint | Official data source, returns pre-match context (H2H, standings, form) accurately |
| Prediction scoring logic | Custom point calculation | Existing `calculateQuotas()` and `scorePredictionsTransactional()` | Kicktipp quota system is complex (tendency distribution, bonuses) - reuse tested code |
| Idempotency tracking | Custom "processed" flags in database | BullMQ deterministic job IDs + queue.getJob() | BullMQ prevents duplicate jobs at queue level, race-condition safe |
| Job polling/waiting | Manual setTimeout loops | BullMQ job events or queue.getJob() polling | Events are cleaner but polling works for scripts without event listeners |

**Key insight:** The platform already has a complete prediction pipeline (analysis → predictions → scoring). The backfill script's job is to **trigger** this pipeline retroactively, not reimplement it.

## Common Pitfalls

### Pitfall 1: Predictions Worker Rejects Finished Matches
**What goes wrong:** Script queues prediction job for finished match, worker checks `match.status !== 'scheduled'` and exits with `{ skipped: true }`
**Why it happens:** Predictions worker (line 104-107) designed for pre-match predictions only
**How to avoid:**
1. Add `allowRetroactive?: boolean` flag to `PredictMatchPayload` type
2. Modify predictions worker line 104 to check flag: `if (match.status !== 'scheduled' && !allowRetroactive)`
3. Script passes `allowRetroactive: true` for retroactive predictions
**Warning signs:** Script logs show "prediction job completed" but database still has < 42 predictions

### Pitfall 2: Using Current Standings Instead of Historical
**What goes wrong:** Backfill generates predictions using current league table, not table as it was at kickoff
**Why it happens:** Misunderstanding of API-Football's data model
**How to avoid:** API-Football's `/fixtures/{id}` endpoint returns **snapshot data from match time**. The analysis worker already uses this correctly via `fetchPrediction(fixtureId)` which calls `/fixtures?id={id}`. Don't try to fetch standings separately.
**Warning signs:** Predictions for 6-day-old matches reference teams' current league positions which changed after match

### Pitfall 3: Race Condition Between Analysis and Predictions
**What goes wrong:** Script queues analysis job, immediately queues prediction job, prediction job runs before analysis completes and fails with "No analysis data found"
**Why it happens:** BullMQ jobs execute asynchronously - queueing doesn't guarantee order
**How to avoid:** Use `waitForJobCompletion()` helper to poll analysis job until state is 'completed' before queueing prediction job
**Warning signs:** Prediction jobs fail with "No analysis data found" but analysis jobs show completed in Bull Board

### Pitfall 4: Forgetting to Score Finished Matches
**What goes wrong:** Script generates predictions for finished matches but never scores them - predictions stay in 'pending' status forever
**Why it happens:** Normal flow is live-score worker triggers scoring when match finishes, but retroactive predictions added AFTER finish
**How to avoid:** Script explicitly calls `scoreFinishedMatch()` after predictions complete for finished matches
**Warning signs:** Finished matches show 42 predictions but all have `status='pending'`, no points calculated

### Pitfall 5: API Rate Limiting from Parallel Requests
**What goes wrong:** Script processes 50 matches in parallel, makes 150 API-Football requests (3 per match), hits rate limit (30 req/min), jobs fail
**Why it happens:** API-Football free tier limits 30 requests/minute with 300ms minimum delay
**How to avoid:**
1. Use `p-limit` to control concurrency: `const limit = pLimit(5)` - max 5 matches in parallel
2. BullMQ already handles rate limiting in analysis worker via `RATE_LIMIT_DELAY_MS = 300`
3. Monitor API-Football usage in logs, reduce concurrency if hitting limits
**Warning signs:** Analysis jobs fail with "429 Too Many Requests", script slows down dramatically

### Pitfall 6: Running Script Without Cleaning Up Old Failed Jobs
**What goes wrong:** Script finds match with 10 predictions, queues job, but job ID `predict-retro-{id}` already exists in failed state, new job never runs
**Why it happens:** Previous backfill attempt failed mid-execution, left failed jobs in queue
**How to avoid:** Script checks for existing job and removes if state is 'failed' or 'completed':
```typescript
const existingJob = await queue.getJob(jobId);
if (existingJob) {
  const state = await existingJob.getState();
  if (['failed', 'completed'].includes(state)) {
    await existingJob.remove(); // Clean up stale jobs
  }
}
```
**Warning signs:** Script logs show "Job already queued" but Bull Board shows job in failed state from hours ago

## Code Examples

Verified patterns from official sources:

### Main Script Structure
```typescript
// Source: Existing backfill-settlement.ts + BullMQ patterns
/**
 * Retroactive Backfill Script
 *
 * Generates predictions and scores for matches from the last N days that are missing predictions.
 * Handles finished, live, and scheduled matches by using pre-match context from API-Football.
 *
 * Usage: npx tsx scripts/backfill-retroactive-predictions.ts [--days N]
 */

import 'dotenv/config';
import {
  getDb,
  getMatchById,
  getMatchAnalysisByMatchId,
  getPredictionsForMatch,
} from '@/lib/db/queries';
import {
  analysisQueue,
  predictionsQueue,
  settlementQueue,
  closeQueueConnection,
  JOB_TYPES,
} from '@/lib/queue';
import { matches, matchAnalysis, predictions } from '@/lib/db/schema';
import { eq, and, gte, isNotNull, sql } from 'drizzle-orm';
import pLimit from 'p-limit';

// Limit concurrency to respect API rate limits
const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

async function main() {
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 && args[daysIndex + 1]
    ? parseInt(args[daysIndex + 1], 10)
    : 7;

  if (isNaN(days) || days < 1) {
    console.error('❌ Invalid --days argument. Must be a positive integer.');
    process.exit(1);
  }

  console.log(`\n🔍 Retroactive Prediction Backfill (last ${days} days)`);
  console.log('='.repeat(60));

  const stats = {
    matchesFound: 0,
    analysisQueued: 0,
    predictionsQueued: 0,
    scoringQueued: 0,
    duplicatesSkipped: 0,
    errors: [] as string[],
  };

  try {
    // Find all matches with < 42 predictions
    const gaps = await findMatchesMissingPredictions(days);
    stats.matchesFound = gaps.length;

    console.log(`\nFound ${gaps.length} matches with incomplete predictions:`);
    console.log(`  - Finished: ${gaps.filter(g => g.status === 'finished').length}`);
    console.log(`  - Live: ${gaps.filter(g => g.status === 'live').length}`);
    console.log(`  - Scheduled: ${gaps.filter(g => g.status === 'scheduled').length}`);

    if (gaps.length === 0) {
      console.log('\n✅ No matches need backfilling.');
      return;
    }

    console.log('\n🚀 Starting backfill...\n');

    // Process matches with concurrency limit
    await Promise.all(
      gaps.map(gap =>
        limit(async () => {
          try {
            console.log(`📝 ${gap.matchId}: ${gap.predictionCount}/42 predictions (${gap.status})`);

            // Step 1: Ensure analysis exists
            if (!gap.hasAnalysis) {
              await generateRetroactiveAnalysis(gap.matchId);
              stats.analysisQueued++;
              console.log(`   ✓ Queued analysis`);
              await waitForJobCompletion(`analyze-retro-${gap.matchId}`, analysisQueue, 120000);
            }

            // Step 2: Generate predictions
            await generateRetroactivePredictions(gap.matchId);
            stats.predictionsQueued++;
            console.log(`   ✓ Queued predictions`);
            await waitForJobCompletion(`predict-retro-${gap.matchId}`, predictionsQueue, 300000);

            // Step 3: Score if finished
            if (gap.status === 'finished' && gap.homeScore !== null && gap.awayScore !== null) {
              await scoreFinishedMatch(gap.matchId);
              stats.scoringQueued++;
              console.log(`   ✓ Queued scoring`);
            }

            console.log(`   ✅ Complete`);
          } catch (error: any) {
            stats.errors.push(`${gap.matchId}: ${error.message}`);
            console.error(`   ❌ Error: ${error.message}`);
          }
        })
      )
    );

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Matches processed:    ${stats.matchesFound}`);
    console.log(`Analysis queued:      ${stats.analysisQueued}`);
    console.log(`Predictions queued:   ${stats.predictionsQueued}`);
    console.log(`Scoring queued:       ${stats.scoringQueued}`);
    console.log(`Errors:               ${stats.errors.length}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await closeQueueConnection();
    process.exit(0);
  }
}

main();
```

### Gap Detection Query
```typescript
// Source: Drizzle ORM aggregation pattern
interface MatchGap {
  matchId: string;
  status: 'scheduled' | 'live' | 'finished';
  kickoffTime: string;
  predictionCount: number;
  hasAnalysis: boolean;
  homeScore: number | null;
  awayScore: number | null;
  externalId: string | null;
}

async function findMatchesMissingPredictions(daysBehind: number = 7): Promise<MatchGap[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBehind);

  // Aggregation query: count predictions per match, filter < 42
  const results = await db
    .select({
      matchId: matches.id,
      status: matches.status,
      kickoffTime: matches.kickoffTime,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      externalId: matches.externalId,
      hasAnalysis: sql<boolean>`${matchAnalysis.id} IS NOT NULL`,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
    })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        gte(matches.kickoffTime, cutoff.toISOString()),
        isNotNull(matches.externalId), // Required for API-Football data
      )
    )
    .groupBy(
      matches.id,
      matches.status,
      matches.kickoffTime,
      matches.homeScore,
      matches.awayScore,
      matches.externalId,
      matchAnalysis.id
    )
    .having(sql`COUNT(${predictions.id}) < 42`) // Active model count
    .orderBy(matches.kickoffTime);

  return results;
}
```

### Retroactive Worker Modification
```typescript
// Source: Existing predictions.worker.ts with retroactive extension
// Location: src/lib/queue/types.ts
export interface PredictMatchPayload {
  matchId: string;
  skipIfDone?: boolean;
  allowRetroactive?: boolean; // NEW: Allow predictions for finished matches
}

// Location: src/lib/queue/workers/predictions.worker.ts line 104
// BEFORE (rejects finished matches):
if (match.status !== 'scheduled') {
  log.info(`Match ${matchId} is ${match.status}, skipping`);
  return { skipped: true, reason: 'match_not_scheduled', status: match.status };
}

// AFTER (allows retroactive with explicit opt-in):
if (match.status !== 'scheduled' && !allowRetroactive) {
  log.info(`Match ${matchId} is ${match.status}, skipping`);
  return { skipped: true, reason: 'match_not_scheduled', status: match.status };
}

// If allowRetroactive=true, worker continues with prediction generation
// using existing analysis data (which contains pre-match context)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual database updates for missing predictions | Automated backfill via job queue | Phase 51 | Safer, auditable, respects rate limits |
| Generating predictions using current data | Using historical API-Football snapshots | Always (API-Football design) | Predictions reflect pre-match context accurately |
| Separate scoring scripts | Reuse settlement worker with immediate scoring | Phase 50 | Consistent scoring logic, quota calculation tested |
| Script runs predictions synchronously | Script queues BullMQ jobs and waits | Phase 51 | Retry logic, stalled job detection, progress tracking |

**Deprecated/outdated:**
- **Direct prediction generation without analysis**: Old scripts called LLMs directly. New approach ensures analysis exists first (dependency chain).
- **Modifying match status for backfill**: Dangerous pattern that caused cache invalidation issues. Use `allowRetroactive` flag instead.

## Open Questions

Things that couldn't be fully resolved:

1. **Should script wait for ALL jobs to complete or fire-and-forget?**
   - What we know: Script needs to track success for reporting
   - What's unclear: If script exits before jobs complete, do jobs still run? (Yes - BullMQ workers are separate processes)
   - Recommendation: Script waits for completion to report accurate stats, but add `--async` flag for fire-and-forget mode

2. **How to handle partial prediction sets (e.g., 30/42)?**
   - What we know: Script queues prediction job with `skipIfDone: true` to avoid regenerating existing predictions
   - What's unclear: Will predictions worker generate only missing 12 predictions or all 42?
   - Recommendation: Test predictions worker behavior - if it regenerates all, modify to check `getActiveProviders()` and filter out models with existing predictions

3. **Should script backfill older than 7 days?**
   - What we know: Requirements say "last 7 days", Phase 49 focused on 48h window
   - What's unclear: Are there matches >7 days old missing predictions that need backfill?
   - Recommendation: Start with 7 days, add `--days` CLI argument for flexibility

4. **How to handle matches with changed status (cancelled/postponed)?**
   - What we know: Predictions worker classifies these as 'unrecoverable' errors
   - What's unclear: Should script skip these entirely or attempt predictions anyway?
   - Recommendation: Skip cancelled/postponed matches - no value in generating predictions for matches that didn't happen

## Sources

### Primary (HIGH confidence)
- [BullMQ Official Documentation - Idempotent Jobs Pattern](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ Official Documentation - Job IDs](https://docs.bullmq.io/guide/jobs/job-ids)
- [OneUpTime Blog - How to Implement Custom Job IDs in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-custom-job-ids/view) (2026)
- [OneUpTime Blog - How to Implement Job Deduplication in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-job-deduplication/view) (2026)
- Existing Codebase - `scripts/backfill-settlement.ts` (settlement backfill pattern)
- Existing Codebase - `scripts/investigate-settlement-failures.ts` (job inspection pattern)
- Existing Codebase - `src/lib/queue/workers/predictions.worker.ts` (prediction generation)
- Existing Codebase - `src/lib/queue/workers/scoring.worker.ts` (Kicktipp quota scoring)
- Phase 49 Research - `49-RESEARCH.md` (catch-up scheduling patterns)
- Phase 50 Research - `50-RESEARCH.md` (settlement recovery patterns)

### Secondary (MEDIUM confidence)
- [Airbyte - Understanding Idempotency: A Key to Reliable and Scalable Data Pipelines](https://airbyte.com/data-engineering-resources/idempotency-in-data-pipelines)
- [Medium - Backfilling Data Pipelines: Concepts, Examples, and Best Practices](https://medium.com/@andymadson/backfilling-data-pipelines-concepts-examples-and-best-practices-19f7a6b20c82)
- [Databricks - Backfilling historical data with pipelines](https://docs.databricks.com/aws/en/ldp/flows-backfill)
- [Gunnar Morling - On Idempotency Keys](https://www.morling.dev/blog/on-idempotency-keys/)
- [Microservices.io - Pattern: Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html)
- [LakeFS - Backfilling Data: A Foolproof Guide to Managing Historical Data](https://lakefs.io/blog/backfilling-data-foolproof-guide/)

### Tertiary (LOW confidence)
- [Dagster - Backfills in Data & ML: A Quick Primer](https://dagster.io/blog/backfills-in-ml)
- [StartTree - Backfilling a Real-Time Analytics Data Pipeline](https://startree.ai/resources/backfilling-a-real-time-analytics-data-pipeline/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ and API-Football already integrated, patterns verified in codebase
- Architecture: HIGH - Existing backfill patterns in `backfill-settlement.ts`, worker structure established
- Pitfalls: HIGH - Status check issue identified in predictions.worker.ts line 104, race conditions documented
- Idempotency: HIGH - BullMQ job ID patterns verified in official docs and Phase 49/50 implementations
- Historical data access: MEDIUM - API-Football documentation confirms snapshot data, but not explicitly tested for retroactive use case

**Research date:** 2026-02-06
**Valid until:** 30 days (2026-03-08) - BullMQ and API-Football are stable, patterns unlikely to change
