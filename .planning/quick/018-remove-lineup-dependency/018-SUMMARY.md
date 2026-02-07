---
phase: quick-018
plan: 01
subsystem: pipeline
tags: [queue, scheduler, prediction-pipeline, database-migration]

# Dependency graph
requires:
  - phase: quick-017
    provides: Retroactive backfill automation
provides:
  - Simplified prediction pipeline (4 jobs vs 5)
  - Removed lineup dependency from predictions
  - Database migration to drop 9 lineup columns
  - Predictions generated at T-30m (no longer waiting for T-60m lineups)
affects: [prediction-pipeline, scheduler, database-schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prediction pipeline no longer gates on lineup availability"

key-files:
  created:
    - drizzle/0013_drop_lineup_columns.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/db/queries.ts
    - src/lib/queue/index.ts
    - src/lib/queue/types.ts
    - src/lib/queue/scheduler.ts
    - src/lib/queue/workers/index.ts
    - src/lib/queue/workers/backfill.worker.ts
    - src/lib/football/prompt-builder.ts
    - src/lib/football/api-client.ts

key-decisions:
  - "Removed lineup data from schema and prediction pipeline - LLM models don't use this information"
  - "Predictions now generated at T-30m instead of waiting for T-60m lineups to be available"

patterns-established:
  - "Prediction pipeline: analysis → predictions (lineups step removed)"
  - "Scheduler creates 4 jobs per match (was 5): analysis, odds, predictions, live"

# Metrics
duration: 9min
completed: 2026-02-07
---

# Quick Task 018: Remove Lineup Dependency Summary

**Simplified prediction pipeline from 5 to 4 scheduled jobs by removing lineup dependency - predictions now generate at T-30m without waiting for T-60m lineup availability**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-07T02:55:48Z
- **Completed:** 2026-02-07T03:04:56Z
- **Tasks:** 3
- **Files modified:** 19 (9 modified, 2 deleted, 1 created)

## Accomplishments
- Removed all lineup-related code from the codebase
- Simplified prediction pipeline: analysis → predictions (no lineups gate)
- Created database migration to drop 9 lineup columns
- Updated all UI text and documentation to reflect T-30m prediction timing
- Production build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove lineup schema columns and create migration** - `dd706b4` (refactor)
   - Removed 9 lineup columns from match_analysis schema
   - Created drizzle/0013_drop_lineup_columns.sql migration
   - Removed updateMatchAnalysisLineups and getMatchesMissingLineups queries
   - Updated getMatchesMissingPredictions to not require lineupsAvailable
   - Removed lineup preservation logic from match-analysis.ts
   - Removed lineup fields from match API response

2. **Task 2: Remove lineups queue, worker, scheduler job, and backfill step** - `ff73e3a` (refactor)
   - Deleted lineups.ts and lineups.worker.ts files
   - Removed FETCH_LINEUPS job type and LINEUPS queue
   - Removed FetchLineupsPayload type
   - Updated scheduler: 4 jobs per match (was 5), removed T-60m lineups job
   - Removed lineups from lateRunnableJobs and cancelMatchJobs
   - Removed lineups worker from worker configs
   - Removed lineups backfill step from backfill worker

3. **Task 3: Clean up prompts, API client, types, content, and UI text** - `cccd0e7` (refactor)
   - Removed lineup sections from prompts (DATA FORMAT, LINEUPS blocks)
   - Removed fetchLineups function from API client
   - Removed APIFootballLineupsResponse type
   - Removed lineupsWorker and lineups loggers
   - Removed LINEUPS cache TTL and cache key
   - Updated about page: predictions at T-30m (was T-60m)
   - Updated prediction table and league FAQs: ~30 min before kickoff

## Files Created/Modified
- `drizzle/0013_drop_lineup_columns.sql` - Migration to drop 9 lineup columns (CREATED)
- `src/lib/football/lineups.ts` - Deleted (fetched and stored lineup data)
- `src/lib/queue/workers/lineups.worker.ts` - Deleted (processed lineup jobs)
- `src/lib/db/schema.ts` - Removed 9 lineup column definitions
- `src/lib/db/queries.ts` - Removed lineup queries, updated predictions query
- `src/lib/queue/index.ts` - Removed lineups queue and job type
- `src/lib/queue/types.ts` - Removed FetchLineupsPayload type
- `src/lib/queue/scheduler.ts` - Updated to schedule 4 jobs per match
- `src/lib/queue/workers/backfill.worker.ts` - Removed lineups backfill step
- `src/lib/football/prompt-builder.ts` - Removed lineup sections from prompts
- `src/lib/football/api-client.ts` - Removed fetchLineups function
- `src/types/index.ts` - Removed APIFootballLineupsResponse interface
- `src/lib/logger/modules.ts` - Removed lineup loggers
- `src/lib/cache/redis.ts` - Removed lineup cache configuration
- `src/app/about/page.tsx` - Updated timing from T-60m to T-30m
- `src/components/prediction-table.tsx` - Updated empty state text
- `src/lib/league/generate-league-faqs.ts` - Removed lineup references

## Decisions Made

1. **Removed lineup data from prediction pipeline** - Analysis showed LLM models were not using lineup/formation data in their predictions. Removing this dependency simplifies the pipeline and eliminates a source of prediction delays when lineups are unavailable.

2. **Predictions now at T-30m instead of T-60m** - With lineups removed, predictions can be generated as soon as analysis completes (T-30m) rather than waiting for the T-60m lineups fetch.

3. **Created migration but did not run it** - Migration file ready for manual execution on production database to drop the 9 lineup columns.

4. **Kept formation usage stats in team statistics** - The `lineups` field in `APIFootballTeamStatisticsResponse` refers to formation usage statistics (e.g., "4-3-3 played 20 times"), not match lineups, so it was preserved.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added API route lineup field removal**
- **Found during:** Task 1
- **Issue:** src/app/api/matches/[id]/route.ts was returning lineup fields (homeFormation, awayFormation, homeStartingXI, awayStartingXI, homeCoach, awayCoach) in the API response. TypeScript would fail after schema changes.
- **Fix:** Removed the 6 lineup fields from the match API response object
- **Files modified:** src/app/api/matches/[id]/route.ts
- **Verification:** TypeScript compilation passed
- **Committed in:** dd706b4 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed stale comment in queries.ts**
- **Found during:** Task 3 verification
- **Issue:** Comment said "Get matches missing bets (has lineups, < X hours to kickoff, no bets)" but lineups are no longer a requirement
- **Fix:** Updated comment to "Get matches missing bets (has analysis, < X hours to kickoff, no predictions)"
- **Files modified:** src/lib/db/queries.ts
- **Verification:** Grep for "lineup" found only the fixed comment and formation stats
- **Committed in:** cccd0e7 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for correctness. The API route change was blocking (TypeScript would fail). The comment fix improved code clarity. No scope creep.

## Issues Encountered
None - plan executed smoothly with only minor auto-fixes for blocking issues.

## Verification

All success criteria met:

1. ✅ Zero lineup-related code remains (except formation usage stats in team statistics)
2. ✅ Prediction pipeline: analysis → predictions (no lineups gate)
3. ✅ Scheduler creates 4 jobs per match (was 5): analysis, odds, predictions, live
4. ✅ Backfill worker checks 6 things (was 7, no lineups step)
5. ✅ Migration file created (drizzle/0013_drop_lineup_columns.sql) with 9 DROP COLUMN statements
6. ✅ Production build passes (`npx next build --webpack` successful)
7. ✅ TypeScript compilation clean (no lineup-related errors)
8. ✅ Deleted files verified: lineups.ts and lineups.worker.ts do not exist

## Next Steps

1. **Run migration on production database:**
   ```bash
   # Review migration first
   cat drizzle/0013_drop_lineup_columns.sql

   # Run against production
   psql $DATABASE_URL -f drizzle/0013_drop_lineup_columns.sql
   ```

2. **Monitor prediction pipeline** after deployment to verify predictions generate successfully at T-30m without waiting for lineups

3. **Verify no regression** in prediction quality after removing lineup data from prompts

---
*Quick Task: 018-remove-lineup-dependency*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files verified:
- ✓ Migration file exists: drizzle/0013_drop_lineup_columns.sql
- ✓ Deleted files confirmed missing: lineups.ts, lineups.worker.ts
- ✓ All commits exist: dd706b4, ff73e3a, cccd0e7
