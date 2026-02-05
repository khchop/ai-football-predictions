---
phase: 42-dynamic-model-counts
plan: 01
subsystem: cache
tags: [redis, cache-invalidation, drizzle-orm, model-count]

# Dependency graph
requires:
  - phase: 41-together-ai-fallbacks
    provides: model status tracking infrastructure
provides:
  - getActiveModelCount() single source of truth for UI
  - Cache invalidation on model enable/disable
  - activeModelCount cache key in Redis
affects: [42-02, 42-03, content-generation, faq-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [cache-key-per-entity-type, invalidation-on-mutation]

key-files:
  modified:
    - src/lib/cache/redis.ts
    - src/lib/llm/index.ts
    - src/lib/db/queries.ts

key-decisions:
  - "60s cache TTL for model count (same as overall stats)"
  - "Batch invalidation after recoverDisabledModels(), not per-model"
  - "Invalidation clears activeModelCount, overallStats, and leaderboard pattern"

patterns-established:
  - "Model count queries: Always use getActiveModelCount() not provider array length"
  - "Cache invalidation: Call invalidateModelCountCaches() after any model status mutation"

# Metrics
duration: 5min
completed: 2026-02-05
---

# Phase 42 Plan 01: Cache Infrastructure for Dynamic Model Count Summary

**getActiveModelCount() function with 60s cached database query and cache invalidation on all model status changes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T18:19:17Z
- **Completed:** 2026-02-05T18:24:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Cache key `db:models:count:active` added to cacheKeys registry
- `invalidateModelCountCaches()` exported from redis.ts for model status mutation handlers
- `getActiveModelCount()` queries `COUNT(*)` where `models.active = true` with 60s TTL
- All model status mutation functions now call cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cache key and invalidation function to redis.ts** - `6e5c922` (feat)
2. **Task 2: Add getActiveModelCount() to llm/index.ts** - `34a38c8` (feat)
3. **Task 3: Wire invalidation to model status changes** - `a99aeda` (feat)

## Files Created/Modified
- `src/lib/cache/redis.ts` - Added activeModelCount cache key and invalidateModelCountCaches() function
- `src/lib/llm/index.ts` - Added getActiveModelCount() function with cached database query
- `src/lib/db/queries.ts` - Added invalidation calls to recordModelSuccess, recordModelFailure, reEnableModel, recoverDisabledModels

## Decisions Made
- 60s cache TTL for model count (aligned with CACHE_TTL.STATS for consistency)
- Batch invalidation after recoverDisabledModels() - single invalidation after loop, not per-model
- Invalidation clears three cache targets: activeModelCount, overallStats, and all leaderboard entries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- getActiveModelCount() ready for UI integration
- Cache invalidation wired to all model status mutations
- Plan 02 can now replace hardcoded "35 models" references

---
*Phase: 42-dynamic-model-counts*
*Completed: 2026-02-05*
