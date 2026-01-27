---
phase: 04-content-pipeline
plan: 05
subsystem: api
tags: [bullmq, content-pipeline, stats]

# Dependency graph
requires:
  - phase: 04-content-pipeline
    provides: [roundup generation infrastructure]
provides:
  - Roundup generation triggered after stats calculation
affects: [content quality, model performance reporting]

# Tech tracking
tech-stack:
  added: []
  patterns: [delayed job triggering]

key-files:
  created: []
  modified: [src/lib/queue/jobs/calculate-stats.ts, src/lib/queue/workers/scoring.worker.ts]

key-decisions:
  - "Moved roundup trigger from scoring worker to stats worker to ensure model performance data is complete before generation."

patterns-established:
  - "Triggering secondary content generation after data aggregation is complete."

# Metrics
duration: 1 min
completed: 2026-01-27
---

# Phase 04 Plan 05: Roundup Trigger Optimization Summary

**Triggered roundup generation AFTER stats calculation completes, ensuring roundups include complete model performance data.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-27T15:55:25Z
- **Completed:** 2026-01-27T15:57:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Optimized the content pipeline trigger sequence.
- Ensured model accuracy data is fully processed before roundup generation starts.
- Prevented race conditions between stats calculation and narrative generation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add roundup trigger after stats calculation** - `d259a04` (feat)
2. **Task 2: Remove roundup trigger from scoring worker** - `1cf2e50` (fix)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `src/lib/queue/jobs/calculate-stats.ts` - Added roundup trigger with 30s delay after stats cache invalidation.
- `src/lib/queue/workers/scoring.worker.ts` - Removed duplicate roundup trigger to avoid premature generation.

## Decisions Made
- Used a 30-second delay in the roundup schedule to allow database changes from stats calculation to settle and become queryable.
- Chose dynamic import for the worker in the jobs file to prevent circular dependencies between the stats queue and scoring worker.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Roundup quality is improved with accurate model stats.
- Content pipeline is more robust against race conditions.
- Milestone 1.0 gap INT-02 is closed.

---
*Phase: 04-content-pipeline*
*Completed: 2026-01-27*
