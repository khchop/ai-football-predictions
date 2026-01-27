---
phase: 02-stats-api-caching
plan: 04
subsystem: api
tags: [stats, filtering, drizzle, postgresql, query-optimization]

# Dependency graph
requires:
  - phase: 02-03
    provides: Cache invalidation integration with match completion
  - phase: 02-02
    provides: Stats API endpoints (overall, competition, club)
  - phase: 02-01
    provides: Redis caching layer for stats
provides:
  - LeaderboardFilters interface for filtering stats queries
  - Competition-specific leaderboard filtering
  - Club-specific leaderboard filtering (with home/away distinction)
  - Conditional JOIN strategy for filtered vs overall queries
affects: [phase-03, stats-ui, filtering-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional JOIN strategy: leftJoin for overall, innerJoin for filtered queries"
    - "Filter interface pattern for optional query parameters"

key-files:
  created: []
  modified:
    - src/lib/db/queries/stats.ts
    - src/app/api/stats/competition/[id]/route.ts
    - src/app/api/stats/club/[id]/route.ts

key-decisions:
  - "Use conditional JOIN strategy to preserve overall leaderboard performance while enabling filtering"
  - "Map correctTendencies to wins temporarily (wins/draws/losses breakdown requires future query enhancement)"
  - "Store dates as strings in LeaderboardFilters to match database text column type"

patterns-established:
  - "Filter interface pattern: optional filters parameter with all-optional fields"
  - "Conditional query building: check hasFilters flag to decide JOIN strategy"

# Metrics
duration: 3m 17s
completed: 2026-01-27
---

# Phase 2 Plan 4: Competition & Club Filtering Summary

**Competition and club endpoints now return filtered model stats using conditional JOIN strategy with LeaderboardFilters interface**

## Performance

- **Duration:** 3m 17s
- **Started:** 2026-01-27T11:23:41Z
- **Completed:** 2026-01-27T11:26:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- LeaderboardFilters interface supports competitionId, clubId, isHome, season, dateFrom, dateTo filtering
- Competition endpoint returns stats filtered by competition ID
- Club endpoint returns stats filtered by club ID with optional home/away distinction
- Overall endpoint preserved - still returns unfiltered leaderboard
- Conditional JOIN strategy optimizes query performance based on filter presence

## Task Commits

Each task was committed atomically:

1. **Task 1: Add filter support to getLeaderboard function** - `9ae27cb` (feat)
2. **Task 2: Wire competition and club endpoints to pass filters** - `0cf8e88` (feat)

## Files Created/Modified
- `src/lib/db/queries/stats.ts` - Added LeaderboardFilters interface, conditional JOIN logic to getLeaderboard
- `src/app/api/stats/competition/[id]/route.ts` - Build filters with competitionId and pass to getLeaderboard
- `src/app/api/stats/club/[id]/route.ts` - Build filters with clubId/isHome and pass to getLeaderboard

## Decisions Made

**1. Conditional JOIN strategy**
- **Decision:** Use leftJoin for overall leaderboard (no filters), innerJoin for filtered queries
- **Rationale:** leftJoin includes models with zero predictions (important for overall view), innerJoin filters to only models with matching predictions (correct for filtered views)

**2. Date filter type**
- **Decision:** Use string type for dateFrom/dateTo in LeaderboardFilters
- **Rationale:** Database kickoffTime column is text type, requires string comparison not Date objects

**3. Wins/draws/losses mapping**
- **Decision:** Map correctTendencies → wins, draws = 0, losses = totalPredictions - correctTendencies
- **Rationale:** LeaderboardEntry type doesn't include wins/draws/losses breakdown. This provides approximate data until query is enhanced to include real breakdown

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. TypeScript errors on initial implementation**
- **Issue:** Date type mismatch (kickoffTime is text), or() condition returning undefined, complex query typing with conditional joins
- **Resolution:** Changed filters to use string dates, added proper type narrowing for or() condition, split query building into hasFilters conditional branches

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Phase 3: UI/frontend stats pages can now filter by competition and club
- Future enhancement: Add real wins/draws/losses breakdown to getLeaderboard query
- Date range filtering ready but not exposed in endpoints yet

**No blockers or concerns**

---
*Phase: 02-stats-api-caching*
*Completed: 2026-01-27*
