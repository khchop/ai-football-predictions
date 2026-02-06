---
phase: 50-settlement-investigation-recovery
plan: 01
subsystem: queue
tags: [bullmq, redis, settlement, scoring, pipeline]

# Dependency graph
requires:
  - phase: 49-pipeline-scheduling-fixes
    provides: Fixed pipeline scheduling and backfill windows
provides:
  - Settlement failure investigation script for root cause analysis
  - Conditional retry logic in scoring worker (analysis exists → retry, no analysis → skip)
  - getFinishedMatchesWithZeroPredictions query for backfill use
affects: [50-02, 50-03, 51-retroactive-backfill]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-retry-pattern, analysis-based-skipping]

key-files:
  created: []
  modified:
    - scripts/investigate-settlement-failures.ts
    - src/lib/queue/workers/scoring.worker.ts
    - src/lib/db/queries.ts

key-decisions:
  - "Use favoriteTeamName field to detect if analysis exists (reliable indicator from API-Football)"
  - "Throw error for retry when analysis exists but predictions don't (upstream pipeline issue)"
  - "Skip gracefully when no analysis exists (expected for old/imported matches)"
  - "Fixed schema error in getFinishedMatchesWithZeroPredictions (removed non-existent referee field)"

patterns-established:
  - "Conditional retry pattern: Check analysis existence before deciding to retry or skip"
  - "BullMQ exponential backoff for upstream pipeline failures (30s, 60s, 120s, 240s, 480s)"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 50-01: Settlement Investigation & Recovery Summary

**Scoring worker now retries zero-prediction matches when analysis exists, skips when expected, with investigation script ready for production root cause analysis**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-06T21:40:43Z
- **Completed:** 2026-02-06T21:44:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Investigation script ready to query 43 failed settlement jobs from Redis DLQ and queue
- Scoring worker distinguishes retriable errors from expected skips using analysis data
- Query available for finding finished matches with zero predictions (backfill foundation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create settlement failure investigation script** - `94f7c7c` (feat)
2. **Task 2: Fix scoring worker zero-prediction handling and add query** - `657108f` (feat)

## Files Created/Modified
- `scripts/investigate-settlement-failures.ts` - Queries DLQ and settlement queue for failed jobs, groups by error pattern, exports to JSON
- `src/lib/queue/workers/scoring.worker.ts` - Conditional retry logic: throws error if analysis exists but predictions don't, skips if no analysis
- `src/lib/db/queries.ts` - Fixed getFinishedMatchesWithZeroPredictions schema error (removed referee, added missing columns)

## Decisions Made

**1. Use favoriteTeamName as analysis existence indicator**
- Rationale: This field is always set when API-Football analysis runs, reliable for detecting analyzed matches

**2. Throw error to trigger BullMQ retry when analysis exists but predictions don't**
- Rationale: This indicates upstream pipeline failure (prediction worker didn't run), retry allows pipeline to complete

**3. Skip gracefully when no analysis exists**
- Rationale: Old/imported matches were never in the pipeline, won't have predictions by design, no point retrying

**4. Fixed schema error in getFinishedMatchesWithZeroPredictions**
- Rationale: Query referenced non-existent referee field, added all missing match columns to groupBy clause

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getFinishedMatchesWithZeroPredictions schema error**
- **Found during:** Task 2 (Build verification)
- **Issue:** Query referenced matches.referee column which doesn't exist in schema, causing TypeScript compilation error
- **Fix:** Removed referee from groupBy clause, added missing columns (homeTeamLogo, awayTeamLogo, round, matchday, isUpset)
- **Files modified:** src/lib/db/queries.ts
- **Verification:** Build passes with webpack compiler
- **Committed in:** 657108f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Schema fix necessary for query to compile. No scope change.

## Issues Encountered

**Schema mismatch in pre-existing query**
- Issue: getFinishedMatchesWithZeroPredictions already existed but had incorrect groupBy columns
- Resolution: Fixed by aligning groupBy with actual match table schema (removed referee, added missing fields)
- Note: Query was created in a previous session but never tested with build

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for SETTLE-02, SETTLE-03, SETTLE-04:**
- Investigation script ready to run against production Redis (`npx tsx scripts/investigate-settlement-failures.ts`)
- Scoring worker fix prevents future silent skips of retriable matches
- Query available for backfill script to identify missed matches
- Build passes, all verification criteria met

**For investigation (SETTLE-01):**
- Run investigation script against production to identify root cause of 43 failures
- Results will inform recovery strategy (SETTLE-02) and backfill scope (SETTLE-03)

---
*Phase: 50-settlement-investigation-recovery*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files and commits verified:
- ✓ scripts/investigate-settlement-failures.ts exists
- ✓ Commit 94f7c7c exists (Task 1)
- ✓ Commit 657108f exists (Task 2)
