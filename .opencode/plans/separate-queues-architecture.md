# Implementation Plan: Separate Queues Architecture

## Problem Statement

Currently all 7 workers listen to a single queue (`match-jobs`) and each worker filters jobs by name:
```typescript
if (job.name !== JOB_TYPES.ANALYZE_MATCH) return;
```

**Bug:** When any worker picks up a job and the filter doesn't match, it returns `undefined` - but BullMQ marks the job as "completed". The correct worker never sees the job.

**Result:** Only ~10% of jobs are processed correctly (when the right worker happens to pick them up first).

---

## Solution: Separate Queues per Job Type

Each job type gets its own queue. Workers listen only to their designated queue. No filtering needed.

### Architecture

```
QUEUES                          WORKERS
------                          -------
analysis-queue      ───────────> AnalysisWorker (concurrency: 3)
predictions-queue   ───────────> PredictionsWorker (concurrency: 1)
lineups-queue       ───────────> LineupsWorker (concurrency: 3)
odds-queue          ───────────> OddsWorker (concurrency: 3) [NEW]
live-queue          ───────────> LiveScoreWorker (concurrency: 10)
settlement-queue    ───────────> SettlementWorker (concurrency: 3)
fixtures-queue      ───────────> FixturesWorker (concurrency: 1)
backfill-queue      ───────────> BackfillWorker (concurrency: 1)
```

### Updated Job Schedule Per Match

```
T-6h:   analysis-queue      → analyze-match
T-2h:   odds-queue          → refresh-odds
T-95m:  odds-queue          → refresh-odds (pre-prediction-1)
T-90m:  predictions-queue   → predict-match (attempt 1)
T-60m:  lineups-queue       → fetch-lineups
T-35m:  odds-queue          → refresh-odds (pre-prediction-2)
T-30m:  predictions-queue   → predict-match (attempt 2)
T-10m:  odds-queue          → refresh-odds (pre-prediction-3)
T-5m:   predictions-queue   → predict-match (attempt 3, force=true)
T-0:    live-queue          → monitor-live
```

**10 jobs per match** (was 7, added 3 strategic odds refreshes)

---

## Files to Modify

### 1. `src/lib/queue/index.ts`

**Changes:**
- Add `QUEUE_NAMES` constant with all 8 queue names
- Create and export 8 separate Queue instances
- Keep `JOB_TYPES` for job naming (verbose names)
- Keep shared Redis connection via `getQueueConnection()`
- Add `getAllQueues()` helper for status endpoint

**New exports:**
```typescript
export const QUEUE_NAMES = {
  ANALYSIS: 'analysis-queue',
  PREDICTIONS: 'predictions-queue',
  LINEUPS: 'lineups-queue',
  ODDS: 'odds-queue',
  LIVE: 'live-queue',
  SETTLEMENT: 'settlement-queue',
  FIXTURES: 'fixtures-queue',
  BACKFILL: 'backfill-queue',
} as const;

export const analysisQueue = new Queue(QUEUE_NAMES.ANALYSIS, { ... });
export const predictionsQueue = new Queue(QUEUE_NAMES.PREDICTIONS, { ... });
export const lineupsQueue = new Queue(QUEUE_NAMES.LINEUPS, { ... });
export const oddsQueue = new Queue(QUEUE_NAMES.ODDS, { ... });
export const liveQueue = new Queue(QUEUE_NAMES.LIVE, { ... });
export const settlementQueue = new Queue(QUEUE_NAMES.SETTLEMENT, { ... });
export const fixturesQueue = new Queue(QUEUE_NAMES.FIXTURES, { ... });
export const backfillQueue = new Queue(QUEUE_NAMES.BACKFILL, { ... });

export function getAllQueues(): Queue[] { ... }
```

---

### 2. `src/lib/queue/scheduler.ts`

**Changes:**
- Import all queue instances instead of single `matchQueue`
- Route each job type to its correct queue
- Add 3 new odds refresh jobs (T-95m, T-35m, T-10m) before prediction attempts
- Update job IDs to include queue context for clarity

**Key changes:**
```typescript
// Before
await matchQueue.add(JOB_TYPES.ANALYZE_MATCH, data, { delay, jobId });

// After  
await analysisQueue.add(JOB_TYPES.ANALYZE_MATCH, data, { delay, jobId });
await oddsQueue.add(JOB_TYPES.REFRESH_ODDS, data, { delay, jobId });
await predictionsQueue.add(JOB_TYPES.PREDICT_MATCH, data, { delay, jobId });
// etc.
```

---

### 3. `src/lib/queue/setup.ts`

**Changes:**
- Import `fixturesQueue` and `backfillQueue` instead of `matchQueue`
- Register `fetch-fixtures` repeatable on `fixtures-queue`
- Register `backfill-missing` repeatable on `backfill-queue`
- Schedule startup backfill on `backfill-queue`

---

### 4. `src/lib/queue/catch-up.ts`

**Changes:**
- No direct changes needed (uses `scheduleMatchJobs` which will be updated)

---

### 5. `src/lib/queue/workers/index.ts`

**Changes:**
- Add new `createOddsWorker()` import
- Update worker list to include odds worker (now 8 workers)
- Keep event logging infrastructure

---

### 6. `src/lib/queue/workers/analysis.worker.ts`

**Changes:**
- Import `QUEUE_NAMES` instead of `JOB_TYPES` for queue name
- Change queue name from `'match-jobs'` to `QUEUE_NAMES.ANALYSIS`
- **Remove** the job name filter (`if (job.name !== ...) return;`)
- Keep all processing logic unchanged

**Before:**
```typescript
return new Worker<AnalyzeMatchPayload>(
  'match-jobs',
  async (job) => {
    if (job.name !== JOB_TYPES.ANALYZE_MATCH) return; // REMOVE THIS
    // ... processing
  },
  { connection, concurrency: 3 }
);
```

**After:**
```typescript
return new Worker<AnalyzeMatchPayload>(
  QUEUE_NAMES.ANALYSIS,
  async (job) => {
    // No filter - every job on this queue is for this worker
    // ... processing
  },
  { connection, concurrency: 3 }
);
```

---

### 7. `src/lib/queue/workers/predictions.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.PREDICTIONS`
- Remove job name filter
- **Remove** inline odds refresh call (scheduler handles this now)
- Keep all other processing logic

**Remove this block:**
```typescript
// REMOVE: Scheduler now handles odds refresh before each prediction
if (match.externalId) {
  console.log(`[Predictions Worker] Refreshing odds for ${match.homeTeam} vs ${match.awayTeam}`);
  try {
    await refreshOddsForMatch(matchId, parseInt(match.externalId, 10));
  } catch (error: any) {
    console.error(`[Predictions Worker] Failed to refresh odds:`, error.message);
  }
}
```

---

### 8. `src/lib/queue/workers/lineups.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.LINEUPS`
- Remove job name filter
- Update immediate prediction queue reference: `matchQueue` → `predictionsQueue`

---

### 9. `src/lib/queue/workers/live-score.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.LIVE`
- Remove job name filter
- Update queue references for self-scheduling: `matchQueue` → `liveQueue`
- Update settlement queue reference: `matchQueue` → `settlementQueue`

---

### 10. `src/lib/queue/workers/settlement.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.SETTLEMENT`
- Remove job name filter
- No other changes needed

---

### 11. `src/lib/queue/workers/fixtures.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.FIXTURES`
- Remove job name filter
- No other changes needed (uses `scheduleMatchJobs` which routes correctly)

---

### 12. `src/lib/queue/workers/backfill.worker.ts`

**Changes:**
- Change queue name to `QUEUE_NAMES.BACKFILL`
- Remove job name filter
- Update all queue references to use correct queues:
  - `matchQueue.add(ANALYZE_MATCH)` → `analysisQueue.add(...)`
  - `matchQueue.add(REFRESH_ODDS)` → `oddsQueue.add(...)`
  - `matchQueue.add(FETCH_LINEUPS)` → `lineupsQueue.add(...)`
  - `matchQueue.add(PREDICT_MATCH)` → `predictionsQueue.add(...)`

---

### 13. `src/lib/queue/workers/odds.worker.ts` [NEW FILE]

**Create new worker:**
- Listen to `QUEUE_NAMES.ODDS`
- Process `refresh-odds` jobs
- Call `refreshOddsForMatch()` from `@/lib/football/match-analysis`
- Concurrency: 3

**Implementation:**
```typescript
export function createOddsWorker() {
  return new Worker<RefreshOddsPayload>(
    QUEUE_NAMES.ODDS,
    async (job) => {
      const { matchId, externalId } = job.data;
      
      console.log(`[Odds Worker] Refreshing odds for match ${matchId}`);
      
      // Verify match exists and is scheduled
      const matchData = await getMatchById(matchId);
      if (!matchData) {
        return { skipped: true, reason: 'match_not_found' };
      }
      
      if (matchData.match.status !== 'scheduled') {
        return { skipped: true, reason: 'match_not_scheduled' };
      }
      
      // Refresh odds
      const fixtureId = parseInt(externalId, 10);
      const success = await refreshOddsForMatch(matchId, fixtureId);
      
      return { success, matchId };
    },
    {
      connection: getQueueConnection(),
      concurrency: 3,
    }
  );
}
```

---

### 14. `src/app/api/admin/queue-status/route.ts`

**Changes:**
- Import `getAllQueues()` helper
- Aggregate status from all 8 queues
- Show per-queue breakdown in response

**Response structure:**
```json
{
  "status": "ok",
  "timestamp": "...",
  "totals": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 0,
    "delayed": 280
  },
  "queues": {
    "analysis-queue": { "waiting": 0, "active": 1, ... },
    "predictions-queue": { "waiting": 2, "active": 0, ... },
    ...
  },
  "recentJobs": [...],
  "repeatable": [...]
}
```

---

## Implementation Order

Execute in this order to minimize breakage:

### Phase 1: Infrastructure (no behavior change yet)
1. **`src/lib/queue/index.ts`** - Add new queues alongside existing `matchQueue`
2. **`src/lib/queue/workers/odds.worker.ts`** - Create new odds worker

### Phase 2: Update Workers (one at a time)
3. **`src/lib/queue/workers/index.ts`** - Add odds worker to startup
4. **`src/lib/queue/workers/analysis.worker.ts`** - Switch to analysis-queue
5. **`src/lib/queue/workers/predictions.worker.ts`** - Switch to predictions-queue, remove inline odds
6. **`src/lib/queue/workers/lineups.worker.ts`** - Switch to lineups-queue
7. **`src/lib/queue/workers/live-score.worker.ts`** - Switch to live-queue
8. **`src/lib/queue/workers/settlement.worker.ts`** - Switch to settlement-queue
9. **`src/lib/queue/workers/fixtures.worker.ts`** - Switch to fixtures-queue
10. **`src/lib/queue/workers/backfill.worker.ts`** - Switch to backfill-queue, update queue refs

### Phase 3: Update Job Scheduling
11. **`src/lib/queue/scheduler.ts`** - Route jobs to correct queues, add new odds jobs
12. **`src/lib/queue/setup.ts`** - Use correct queues for repeatables

### Phase 4: Cleanup and Monitoring
13. **`src/app/api/admin/queue-status/route.ts`** - Show all queues
14. **`src/lib/queue/index.ts`** - Remove old `matchQueue` export (optional, can deprecate)

---

## Testing Plan

### Pre-deployment Verification
1. Build passes: `npm run build`
2. TypeScript compiles: `npx tsc --noEmit`

### Post-deployment Verification
1. Check logs for worker ready events:
   ```
   [Worker:analysis] ✓ Ready and listening for jobs
   [Worker:predictions] ✓ Ready and listening for jobs
   [Worker:odds] ✓ Ready and listening for jobs
   ...
   ```

2. Check queue-status API shows all 8 queues:
   ```bash
   curl https://your-domain.com/api/admin/queue-status | jq '.queues | keys'
   ```

3. Verify jobs are processed:
   ```
   [Worker:analysis] ▶ Processing job: analyze-match (id: analyze-xxx)
   [Worker:analysis] ✓ Completed job: analyze-match
   ```

4. Check database has analysis data:
   ```sql
   SELECT COUNT(*) FROM match_analysis 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

---

## Rollback Plan

If issues occur:

1. **Immediate:** Revert commit and redeploy
2. **Data:** No data loss - jobs may need re-scheduling via:
   ```bash
   curl -X POST https://your-domain.com/api/admin/trigger-backfill
   ```

---

## Migration Notes

### Existing Jobs in Old Queue
After deployment, any jobs in the old `match-jobs` queue will be orphaned (no workers listening). 

**Mitigation:** 
- The backfill worker runs every hour and will re-schedule missing analysis/odds/lineups
- Matches close to kickoff should be manually checked

### Redis Keys
New queues create new Redis keys:
- `bull:analysis-queue:*`
- `bull:predictions-queue:*`
- etc.

Old keys (`bull:match-jobs:*`) can be cleaned up after verification:
```bash
redis-cli KEYS "bull:match-jobs:*" | xargs redis-cli DEL
```

---

## Summary

| Component | Change Type | Complexity |
|-----------|-------------|------------|
| `src/lib/queue/index.ts` | Modify | Medium |
| `src/lib/queue/scheduler.ts` | Modify | High |
| `src/lib/queue/setup.ts` | Modify | Low |
| `src/lib/queue/catch-up.ts` | None | - |
| `src/lib/queue/types.ts` | None | - |
| `src/lib/queue/workers/index.ts` | Modify | Low |
| `src/lib/queue/workers/analysis.worker.ts` | Modify | Low |
| `src/lib/queue/workers/predictions.worker.ts` | Modify | Medium |
| `src/lib/queue/workers/lineups.worker.ts` | Modify | Low |
| `src/lib/queue/workers/live-score.worker.ts` | Modify | Medium |
| `src/lib/queue/workers/settlement.worker.ts` | Modify | Low |
| `src/lib/queue/workers/fixtures.worker.ts` | Modify | Low |
| `src/lib/queue/workers/backfill.worker.ts` | Modify | Medium |
| `src/lib/queue/workers/odds.worker.ts` | **New** | Medium |
| `src/app/api/admin/queue-status/route.ts` | Modify | Medium |

**Total: 14 files (1 new, 13 modified)**

---

## Estimated Time

- Implementation: ~45-60 minutes
- Testing: ~15 minutes
- Total: ~1 hour
