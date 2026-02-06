---
phase: 51-retroactive-backfill-script
plan: 02
subsystem: pipeline
tags: [bullmq, queue, backfill, retroactive, gap-detection, drizzle]

# Dependency graph
requires:
  - phase: 51-retroactive-backfill-script (plan 01)
    provides: allowRetroactive flag support in analysis and predictions workers
  - phase: 50-settlement-investigation-recovery
    provides: Settlement job patterns and idempotent job ID approach
  - phase: 49-pipeline-scheduling-fixes
    provides: Fixed pipeline scheduling and catch-up mechanisms
provides:
  - One-shot retroactive backfill script for gap detection and prediction generation
  - Sequential job orchestration with wait-for-completion pattern
  - Idempotent job queueing using deterministic job IDs
  - Production-ready script for post-incident recovery
affects: [monitoring-observability, pipeline-reliability, operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap detection query: LEFT JOIN with GROUP BY and HAVING for prediction counts"
    - "Idempotent job queueing: deterministic job IDs with stale job cleanup"
    - "Sequential processing: for-loop instead of Promise.all for rate-limit safety"
    - "Wait-for-completion polling: 2-second interval with configurable timeouts"
    - "Phase-based orchestration: analysis → predictions → settlement pipeline"

key-files:
  created:
    - scripts/backfill-retroactive-predictions.ts
  modified: []

key-decisions:
  - "Use favoriteTeamName IS NOT NULL as hasAnalysis indicator (from Phase 50 - reliable API-Football check)"
  - "Process matches sequentially (for-loop, not Promise.all) to respect API-Football rate limits"
  - "Use separate job ID prefixes: analyze-retro-*, predict-retro-*, settle-retro-* for clear tracking"
  - "Wait for job completion synchronously with 120s/300s/60s timeouts per phase"
  - "Filter cancelled/postponed matches explicitly: status IN ('scheduled', 'live', 'finished')"
  - "Continue on per-match errors to maximize recovery even if some matches fail"

patterns-established:
  - "One-shot recovery script: Idempotent, runnable multiple times, no duplicates"
  - "Gap detection pattern: Query with prediction count aggregation and threshold filtering"
  - "Job orchestration: Queue → wait → next phase, with per-phase timeout configuration"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 51 Plan 02: Retroactive Backfill Script

**One-shot script queues analysis, predictions, and scoring for matches missing predictions from last N days, with sequential processing and idempotent job IDs for safe post-incident recovery**

## Performance

- **Duration:** 2 min 30s
- **Started:** 2026-02-06T22:23:05Z
- **Completed:** 2026-02-06T22:25:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Gap detection query identifies matches with < 42 predictions from last N days
- Sequential orchestration: analysis (if missing) → predictions → settlement (if finished)
- Idempotent job queueing with deterministic IDs and stale job cleanup
- Per-match error handling to maximize recovery coverage
- Production-ready script with --days CLI parameter

## Task Commits

Each task was committed atomically:

1. **Task 1: Create retroactive backfill script with gap detection and job orchestration** - `a84c59b` (feat)

## Files Created/Modified
- `scripts/backfill-retroactive-predictions.ts` - Complete retroactive backfill script (413 lines)

## Decisions Made

**1. Use favoriteTeamName IS NOT NULL as hasAnalysis indicator**
- Rationale: From Phase 50, favoriteTeamName is the reliable indicator that API-Football analysis was actually fetched (not just that a row exists in match_analysis table)
- Implementation: Query uses `${matchAnalysis.favoriteTeamName} IS NOT NULL` in SELECT

**2. Process matches sequentially (for-loop, not Promise.all)**
- Rationale: API-Football has rate limits. Sequential processing is safer for a one-shot recovery script and avoids race conditions in analysis/prediction ordering.
- Implementation: Simple for-loop with await in main orchestration

**3. Use separate job ID prefixes per pipeline phase**
- Rationale: Clear tracking in BullMQ UI and logs, easy to distinguish retroactive jobs from normal pipeline
- Pattern: `analyze-retro-${matchId}`, `predict-retro-${matchId}`, `settle-retro-${matchId}`

**4. Wait for completion with phase-specific timeouts**
- Rationale: Analysis (API calls) needs 120s, predictions (42 LLMs) needs 300s, settlement (scoring) needs 60s
- Implementation: `waitForJobCompletion(queue, jobId, timeoutMs)` polls every 2s

**5. Continue on per-match errors**
- Rationale: One match failure shouldn't prevent recovery of other matches
- Implementation: Try-catch per match iteration, collect errors, continue loop

**6. Filter cancelled/postponed matches explicitly**
- Rationale: Cancelled/postponed matches will never have valid predictions or scores
- Implementation: WHERE clause includes `status IN ('scheduled', 'live', 'finished')`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward implementation following established patterns from `scripts/backfill-settlement.ts`.

## User Setup Required

None - no external service configuration required.

Script usage:
```bash
# Default: last 7 days
npx tsx scripts/backfill-retroactive-predictions.ts

# Custom lookback window
npx tsx scripts/backfill-retroactive-predictions.ts --days 14

# Test edge case
npx tsx scripts/backfill-retroactive-predictions.ts --days 0
```

## Next Phase Readiness

**Ready for Phase 52 (Monitoring & Observability):**
- All RETRO requirements (RETRO-01 through RETRO-06) implemented
- Script tested locally with --days 0 (edge case)
- Gap detection query validated (found 28 matches with < 42 predictions)
- Job orchestration pattern established for future use

**Blockers:** None

**Production usage:**
1. Run script after server restarts or API incidents
2. Check BullMQ dashboard for job progress
3. Monitor worker logs for retroactive processing messages
4. Verify prediction counts in database after completion

**Requirements satisfied:**
- RETRO-01: Gap detection query with COUNT < 42 ✅
- RETRO-02: Analysis queue with allowRetroactive: true ✅
- RETRO-03: Predictions queue with allowRetroactive: true and all 42 models ✅
- RETRO-04: Settlement queue for finished matches after predictions complete ✅
- RETRO-05: Non-finished matches skip scoring (stored for future) ✅
- RETRO-06: Deterministic job IDs + stale job removal = idempotent ✅

## Self-Check: PASSED

Files created:
- scripts/backfill-retroactive-predictions.ts ✅

Commits exist:
- a84c59b ✅

Key patterns verified:
- `allowRetroactive: true` appears 2 times ✅
- `analyze-retro-`, `predict-retro-`, `settle-retro-` job ID prefixes present ✅
- `closeQueueConnection()` called in finally block ✅
- Sequential processing (no Promise.all or p-limit) ✅
- Status filter excludes cancelled/postponed ✅

---
*Phase: 51-retroactive-backfill-script*
*Completed: 2026-02-06*
