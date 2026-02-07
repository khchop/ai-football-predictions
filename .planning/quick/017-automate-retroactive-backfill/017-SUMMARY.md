---
quick: 017
type: execute
status: complete
completed: 2026-02-07
duration: ~2.5 minutes
subsystem: pipeline
tags: [backfill, retroactive, worker, predictions, queue]
key-files:
  modified:
    - src/lib/db/queries.ts
    - src/lib/queue/workers/backfill.worker.ts
decisions:
  - Used BOOL_OR aggregate for hasAnalysis instead of returning full Match[] (worker needs both match data and analysis status)
  - Wrapped entire step in try/catch as non-critical (failure does not block forward-looking steps)
  - Used priority 3 for retro jobs (lower than normal pipeline and settlement)
  - Added slight delay offsets (1s analysis, 2s predictions, 3s settlement) to respect dependency ordering
---

# Quick 017: Automate Retroactive Backfill Summary

Automated retroactive prediction backfill as step 7 in the hourly backfill worker, eliminating the need for manual script runs.

## What Changed

### 1. New Query: `getMatchesMissingRetroactivePredictions(days)`

**File:** `src/lib/db/queries.ts`

Returns matches from the last N days with fewer than 42 predictions, including:
- `match`: Full Match object (consistent with other query functions)
- `hasAnalysis`: boolean (BOOL_OR aggregate on matchAnalysis.favoriteTeamName)
- `predictionCount`: integer (COUNT DISTINCT predictions)

Query filters:
- `kickoffTime >= (now - days)` (backward-looking, unlike forward-looking queries)
- `externalId IS NOT NULL` (required for API-Football)
- `status IN ('scheduled', 'live', 'finished')` (excludes cancelled/postponed)
- `HAVING COUNT(DISTINCT predictions.id) < 42`

### 2. Worker Step 7: Retroactive Backfill

**File:** `src/lib/queue/workers/backfill.worker.ts`

New step inserted between zero-prediction settlement (step 6) and pipeline health check (renumbered to step 8).

For each match with < 42 predictions:
- **If no analysis:** Queue `retro-analyze-{matchId}` with `allowRetroactive: true`
- **Always:** Queue `retro-predict-{matchId}` with `allowRetroactive: true`
- **If finished with scores:** Queue `retro-settle-{matchId}`

Job characteristics:
- Idempotent job IDs (`retro-*` prefix) prevent duplicate processing
- Failed retro jobs are removed and re-queued on next cycle
- Priority 3 (lower than normal pipeline operations)
- Staggered delays: 1s (analysis), 2s (predictions), 3s (settlement)
- Non-critical: wrapped in try/catch, failure logged as warning

### Results Tracking

Three new counters added to worker results:
- `retroAnalysisTriggered`
- `retroPredictionsTriggered`
- `retroSettlementsTriggered`

All included in the summary log line.

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add retroactive predictions query | c5fcf0a | src/lib/db/queries.ts |
| 2 | Add retroactive backfill step to worker | 7bb27e9 | src/lib/queue/workers/backfill.worker.ts |

## Verification

- TypeScript compiles without errors
- Full Next.js build passes (webpack)
- Query function exported correctly
- Worker step 7 runs after step 6 (zero-prediction settlement)
- Jobs queued with `retro-*` prefix and `allowRetroactive: true` flag
- Manual script (`scripts/backfill-retroactive-predictions.ts`) still exists as fallback

## Testing Notes

To verify the retroactive step works in production:

1. Trigger manual backfill: `curl -X POST http://localhost:3000/api/admin/queue/backfill`
2. Check worker logs for "Retroactive backfill: found N match(es)" message
3. Verify `retro-*` jobs appear in queue dashboards
4. Check that `allowRetroactive: true` is present in job payloads

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
