---
phase: 49-pipeline-scheduling-fixes
plan: 02
subsystem: pipeline
tags: [bullmq, queue, backfill, scheduling, catch-up]

# Dependency graph
requires:
  - phase: 49-01
    provides: Scheduler handles past-due matches, fixtures worker schedules all scheduled matches
provides:
  - Backfill worker uses 48h window for analysis (not 12h)
  - Backfill worker uses 12h windows for lineups and predictions (not 2h)
  - Dependency chain validation via DB query joins (analysis → lineups → predictions)
  - Repeatable backfill job configured with 48h window
affects: [49-03, 51-retroactive-backfill, pipeline-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wider catch-up windows for better server restart recovery (48h analysis, 12h lineups/predictions)"
    - "Chain validation logging makes dependency requirements visible"

key-files:
  created: []
  modified:
    - src/lib/queue/workers/backfill.worker.ts
    - src/lib/queue/setup.ts

key-decisions:
  - "Use 48h minimum for analysis window (was 12h) to catch matches from last 2 days after restart"
  - "Use 12h for lineups/predictions (was 2h) to catch recently missed matches"
  - "Chain enforcement already implemented via DB query joins - no additional validation needed"
  - "Add chain validation logging to make dependency flow visible for debugging"

patterns-established:
  - "Backfill windows: 48h (analysis), 12h (lineups), 12h (predictions)"
  - "Results object includes windows tracking for debugging"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 49 Plan 02: Backfill Time Windows & Chain Validation Summary

**Backfill worker now checks 48h for analysis and 12h for lineups/predictions (previously 12h/2h), with dependency chain validation logging**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T20:53:43Z
- **Completed:** 2026-02-06T20:55:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Widened analysis backfill window from 12h to 48h (catches matches missed in last 2 days)
- Widened lineups backfill window from 2h to 12h (catches recently missed matches)
- Widened predictions backfill window from 2h to 12h (catches recently missed matches)
- Added chain validation logging to show when analysis jobs must complete before lineups/predictions
- Updated repeatable backfill job to use 48h window
- Updated startup backfill job to use 48h window
- Verified dependency chain enforcement is already in place via DB query joins

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen backfill time windows and add dependency chain validation** - `e4196ac` (feat)
2. **Task 2: Production build verification** - No commit (verification only)

## Files Created/Modified
- `src/lib/queue/workers/backfill.worker.ts` - Wider time windows (48h/12h/12h instead of 12h/2h/2h), chain validation logging, windows tracking in results
- `src/lib/queue/setup.ts` - Updated repeatable and startup backfill jobs to use 48h window

## Decisions Made
1. **Analysis window: 48h minimum** - Use `Math.max(hoursAhead, 48)` to always check full 48h window regardless of job parameter. Catches matches that should have been scheduled 24-48h ago but weren't due to server restarts.

2. **Lineups/predictions windows: 12h** - Changed from 2h to 12h to catch matches that missed the narrow window after server restarts or API issues.

3. **Chain validation via DB queries** - Dependency enforcement is already implemented in `getMatchesMissingLineups` (requires `matchAnalysis`) and `getMatchesMissingPredictions` (requires `lineupsAvailable: true`). No additional validation needed.

4. **Chain logging added** - Added explicit logging after analysis section to show when lineups/predictions will be backfilled on next cycle after analysis completes.

5. **Windows tracking** - Added `windows` field to results object for debugging (`{ analysis: 48, lineups: 12, predictions: 12 }`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Type checking and production build both passed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 49-03** (catch-up improvements) with confidence that backfill will catch matches from last 48h.

**Addresses PIPE requirements:**
- PIPE-03: ✓ Backfill uses 48h/12h/12h windows (not 12h/2h/2h)
- PIPE-04: ✓ Chain validation enforced by DB query joins (analysis → lineups → predictions)
- PIPE-05: ✓ Catch-up (48h) + backfill (48h repeatable) + stuck-match check (2min) ensure comprehensive coverage

**Combined with 49-01:**
- PIPE-01: ✓ scheduleMatchJobs handles past-due matches (no early exit on kickoff <= now)
- PIPE-02: ✓ Fixtures worker schedules all scheduled matches (not just new)

**All 5 PIPE requirements now complete.**

---
*Phase: 49-pipeline-scheduling-fixes*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files and commits verified:
- ✓ src/lib/queue/workers/backfill.worker.ts exists
- ✓ src/lib/queue/setup.ts exists
- ✓ Commit e4196ac exists
