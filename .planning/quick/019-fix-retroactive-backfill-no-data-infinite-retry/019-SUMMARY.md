---
phase: quick-019
plan: 01
subsystem: queue-workers
tags:
  - bullmq
  - retry-logic
  - backfill
  - cup-matches
  - UnrecoverableError

requires:
  - quick-017 # Automated retroactive backfill

provides:
  - Permanent failure classification for retroactive jobs with no API data
  - Elimination of infinite retries for cup matches without API-Football coverage

affects:
  - future-monitoring # Should see reduced failed job noise in BullMQ dashboard

tech-stack:
  added: []
  patterns:
    - BullMQ UnrecoverableError for permanent failures
    - Conditional retry behavior based on job context (allowRetroactive flag)

key-files:
  created: []
  modified:
    - src/lib/queue/workers/analysis.worker.ts
    - src/lib/queue/workers/predictions.worker.ts

decisions:
  - id: RETRY-01
    decision: Use BullMQ's UnrecoverableError for retroactive no-data cases
    context: Retroactive backfill discovers cup matches (Copa del Rey, DFB-Pokal, KNVB Cup) where API-Football has no data
    alternatives:
      - Custom job metadata to skip retries (more complex, requires queue config changes)
      - Return success with skip flag (masks real failures, harder to debug)
    chosen: UnrecoverableError
    rationale: Idiomatic BullMQ pattern, clear distinction between permanent and transient failures, no Sentry noise

  - id: RETRY-02
    decision: Keep retry behavior for normal pre-match pipeline
    context: Pre-match analysis/prediction jobs should retry if data is temporarily unavailable
    alternatives:
      - Apply permanent failure to all jobs (breaks normal pipeline for transient issues)
    chosen: Conditional check on allowRetroactive flag
    rationale: Retroactive jobs run on past matches (data won't appear later), pre-match jobs run before kickoff (data may arrive)

metrics:
  duration: 2 minutes
  completed: 2026-02-07
---

# Quick Task 019: Fix Retroactive Backfill Infinite Retry on No Data

**One-liner:** Stop retroactive backfill from infinitely retrying cup matches where API-Football has no data using BullMQ's UnrecoverableError.

## Objective

Eliminate infinite retries in the retroactive backfill pipeline when API-Football returns no data for past matches (common for cup competitions like Copa del Rey, DFB-Pokal, KNVB Cup).

**Problem:** Quick-017 automated retroactive backfill, but discovered that many cup matches have no API data. These jobs would retry up to 5 times (analysis) and 5 times (predictions), wasting API quota and creating queue noise.

**Solution:** Distinguish between "no data available (permanent)" and "data not yet available (transient)" based on the `allowRetroactive` flag:
- **Retroactive jobs:** Throw `UnrecoverableError` → no retry (data won't appear for past matches)
- **Pre-match jobs:** Throw regular `Error` → retry up to 5 times (data may arrive before kickoff)

## What Was Built

### Modified Workers

**1. Analysis Worker (`src/lib/queue/workers/analysis.worker.ts`)**
- Import `UnrecoverableError` from bullmq
- When `fetchAndStoreAnalysis()` returns null:
  - Check `allowRetroactive` flag
  - If retroactive: throw `UnrecoverableError` (log at INFO, not WARN)
  - If normal: throw regular `Error` (existing retry behavior)
- In catch block: early exit for `UnrecoverableError` to skip Sentry capture

**2. Predictions Worker (`src/lib/queue/workers/predictions.worker.ts`)**
- Import `UnrecoverableError` from bullmq
- When no analysis data found in DB:
  - Check `allowRetroactive` flag
  - If retroactive: throw `UnrecoverableError` (analysis never existed due to no API data)
  - If normal: throw regular `Error` (analysis may still be processing)
- In catch block: early exit for `UnrecoverableError` before `isRetryable()` check
  - Prevents wrapping `UnrecoverableError` in "Retryable:" prefix

### Behavior Change

**Before:**
```
[Retroactive Job] Match 12345 (Cup Match) - No API data
Attempt 1: Failed → Retry in 1s
Attempt 2: Failed → Retry in 2s
Attempt 3: Failed → Retry in 4s
Attempt 4: Failed → Retry in 8s
Attempt 5: Failed → Job failed
[5 attempts × 2 workers = 10 wasted API calls]
```

**After:**
```
[Retroactive Job] Match 12345 (Cup Match) - No API data
Attempt 1: UnrecoverableError → Permanent failure, no retry
[1 attempt × 2 workers = 2 API calls total]
```

**Pre-match pipeline unchanged:**
```
[Pre-match Job] Match 67890 - Data not ready yet
Attempt 1: Failed → Retry in 1s
Attempt 2: Failed → Retry in 2s
... data arrives ...
Attempt 3: Success
```

## Task Commits

| Task | Description | Commit | Files Modified |
|------|-------------|--------|----------------|
| 1 | Analysis worker permanent failure for retroactive no-data | `54894f2` | analysis.worker.ts |
| 2 | Predictions worker permanent failure for retroactive missing-analysis | `aad2d4e` | predictions.worker.ts |
| 3 | Verify production build compiles | `1f85524` | (verification only) |

## Verification Results

✅ TypeScript compilation passes (`npx tsc --noEmit`)
✅ Production build passes (webpack fallback due to local turbopack WASM issue)
✅ `UnrecoverableError` imported and used in both workers
✅ Regular `Error` still thrown for non-retroactive paths
✅ Catch block early-exit prevents wrapping `UnrecoverableError`

**Grep confirmations:**
- analysis.worker.ts: `UnrecoverableError` on lines 8, 57, 79, 85
- predictions.worker.ts: `UnrecoverableError` on lines 9, 123, 312, 317
- Regular `Error` paths preserved in both workers

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Deployment:**
- Ready to deploy immediately
- No database migrations required
- No environment variable changes
- Workers will automatically use new logic on next job execution

**Monitoring:**
- BullMQ dashboard should show fewer failed jobs after deployment
- Retroactive cup match jobs will appear as "failed" with reason "UnrecoverableError" (expected)
- Log level is INFO for expected failures, not WARN/ERROR
- Sentry will not capture these expected failures

**Follow-up items:**
- Monitor BullMQ dashboard after deployment to confirm retry reduction
- Check logs for "permanent failure" messages to identify affected matches
- Consider adding admin endpoint to list matches skipped due to no API data

## Production Impact

**Positive:**
- ↓ 80% reduction in retry attempts for cup matches (10 → 2 attempts per match)
- ↓ Reduced API quota consumption
- ↓ Reduced BullMQ queue noise
- ↓ Reduced Sentry noise (no captures for expected failures)

**Risk:** Low
- Pre-match pipeline behavior unchanged (retries preserved)
- BullMQ's `UnrecoverableError` is standard, well-tested pattern
- Early catch block exit prevents accidental retry wrapping

**Rollback:** Simple
- Revert commits and redeploy if issues arise
- Jobs will resume old retry behavior immediately

---

## Self-Check: PASSED

All files created:
✓ .planning/quick/019-fix-retroactive-backfill-no-data-infinite-retry/019-SUMMARY.md

All commits exist:
✓ 54894f2 (analysis worker)
✓ aad2d4e (predictions worker)
✓ 1f85524 (build verification)
