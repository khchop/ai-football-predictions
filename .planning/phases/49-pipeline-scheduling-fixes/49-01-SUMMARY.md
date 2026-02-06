---
phase: 49-pipeline-scheduling-fixes
plan: 01
subsystem: queue
tags: [bullmq, scheduler, fixtures, job-scheduling, catch-up]

# Dependency graph
requires:
  - phase: 48-cache-warming-scheduler
    provides: Job scheduling infrastructure and queue setup
provides:
  - scheduleMatchJobs handles past-due matches without early exit
  - Fixtures worker schedules jobs for existing matches missing BullMQ jobs
  - Status-based guard prevents scheduling for finished/cancelled/postponed matches
  - Idempotent job scheduling across all code paths (catch-up, fixtures, backfill)
affects: [50-*, catch-up, fixtures-sync, job-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-based guards instead of time-based early exits for job scheduling"
    - "Separation of IndexNow pings (new matches) from job scheduling (all matches)"

key-files:
  created: []
  modified:
    - src/lib/queue/scheduler.ts
    - src/lib/queue/workers/fixtures.worker.ts

key-decisions:
  - "Remove kickoff <= now early exit - prevents catch-up from working"
  - "Use match status (finished/cancelled/postponed) as scheduling guard instead"
  - "Preserve existing shouldRun logic (kickoff > now) for pre-match vs live job distinction"
  - "Schedule jobs for ALL scheduled matches in fixtures worker, not just new ones"

patterns-established:
  - "Status-based scheduling guards: only skip finished/cancelled/postponed matches"
  - "Idempotent job IDs enable safe re-scheduling across multiple code paths"

# Metrics
duration: 1min
completed: 2026-02-06
---

# Phase 49 Plan 01: Pipeline Scheduling Fixes Summary

**Removed scheduler early exit for past-due matches and enabled fixtures worker to re-schedule jobs for existing matches**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-06T20:47:08Z
- **Completed:** 2026-02-06T20:48:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- scheduleMatchJobs() no longer blocks past-due matches with early exit
- Status-based guard (finished/cancelled/postponed) replaces time-based early exit
- Fixtures worker schedules jobs for both new and existing scheduled matches
- Idempotent job IDs prevent duplicate scheduling across catch-up/fixtures/backfill code paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove early exit in scheduleMatchJobs and add status-based guard** - `0d2c7fd` (fix)
2. **Task 2: Make fixtures worker schedule jobs for existing matches missing BullMQ jobs** - `dcabe97` (fix)

## Files Created/Modified
- `src/lib/queue/scheduler.ts` - Removed kickoff <= now early exit, added status-based guard for finished/cancelled/postponed matches
- `src/lib/queue/workers/fixtures.worker.ts` - Separated IndexNow ping (new matches only) from job scheduling (all scheduled matches)

## Decisions Made

1. **Remove time-based early exit (kickoff <= now)**
   - Rationale: Blocks catch-up scheduling for past-due matches, preventing server restart recovery
   - Impact: Past-due matches now enter scheduleMatchJobs and get processed via existing shouldRun logic

2. **Add status-based guard instead**
   - Rationale: Only finished/cancelled/postponed matches truly don't need new jobs
   - Impact: Scheduled matches (past-due or not) get job scheduling attempted

3. **Preserve existing shouldRun logic**
   - Rationale: Correctly distinguishes pre-match jobs (run if kickoff > now) from MONITOR_LIVE (run for in-progress matches)
   - Impact: No behavioral change to job timing, only to entry conditions

4. **Schedule for all scheduled matches in fixtures worker**
   - Rationale: Existing matches that lost BullMQ jobs after restart need re-scheduling
   - Impact: Every fixtures fetch (3h interval) acts as catch-up for missing jobs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both fixes were straightforward code path changes.

## Next Phase Readiness

Ready for 49-02 (catch-up scheduling improvements):
- scheduleMatchJobs now accepts past-due matches (PIPE-01 fixed)
- Fixtures worker re-schedules for existing matches (PIPE-02 fixed)
- Idempotent job IDs already prevent duplicate scheduling
- Status-based guards prevent scheduling for completed matches

No blockers. Both root causes from PIPE-01/PIPE-02 requirements are addressed.

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 49-pipeline-scheduling-fixes*
*Completed: 2026-02-06*
