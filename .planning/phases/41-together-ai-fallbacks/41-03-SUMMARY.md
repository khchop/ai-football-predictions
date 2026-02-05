---
phase: 41-together-ai-fallbacks
plan: 03
subsystem: admin
tags: [admin-dashboard, fallback-tracking, cost-monitoring, metrics]

# Dependency graph
requires:
  - phase: 41-01
    provides: usedFallback boolean column in predictions table
  - phase: 41-02
    provides: callAPIWithFallback method tracking fallback usage
provides:
  - Admin dashboard visibility for fallback usage per model
  - Cost warning system for fallbacks exceeding 2x original cost
  - Real-time fallback metrics with refresh capability
affects: [phase-42-model-tracking, phase-43-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin API endpoints with requireAdminAuth and rate limiting"
    - "Self-contained dashboard components (fetch own data, no props)"
    - "Drizzle ORM db.execute for aggregation queries"

key-files:
  created:
    - src/app/api/admin/fallback-stats/route.ts
    - src/components/admin/fallback-metrics.tsx
  modified:
    - src/components/admin/admin-dashboard.tsx

key-decisions:
  - "Cost warning threshold set at 2x original model cost"
  - "Per-model fallback rate calculation from predictions table"
  - "Amber warning styling for >2x cost multiplier"

patterns-established:
  - "Admin API pattern: rate limit → auth → query → sanitized error"
  - "Dashboard component pattern: self-contained with loading/error states"
  - "Cost estimation using ~500 input, ~50 output tokens per prediction"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 41 Plan 03: Admin Fallback Visibility Summary

**Admin dashboard shows per-model fallback rates and cost warnings for models exceeding 2x original cost**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T16:13:10Z
- **Completed:** 2026-02-05T16:16:34Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Admin can see which models are using fallbacks and how often
- Cost warning system alerts when fallback costs exceed 2x threshold
- Summary metrics show total fallbacks today and models exceeding threshold
- Self-refreshing metrics component with on-demand refresh button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fallback stats API endpoint** - `404f570` (feat)
   - Protected by requireAdminAuth and rate limiting
   - Aggregates per-model fallback rates from predictions table
   - Calculates cost multiplier comparing original vs fallback costs
   - Flags models exceeding 2x cost threshold

2. **Task 2: Create FallbackMetrics dashboard component** - `948820a` (feat)
   - Fetches fallback statistics from admin API on mount
   - Shows summary badges: total fallbacks, models with fallbacks, exceeding 2x
   - Table displays per-model fallback rates and cost multipliers
   - Amber warning styling for models exceeding 2x cost threshold

3. **Task 3: Integrate FallbackMetrics into admin dashboard** - `da5a5df` (feat)
   - Import FallbackMetrics component
   - Render between CostSummary and ModelHealthTable
   - Component self-contained (fetches own data, no props needed)

## Files Created/Modified

- `src/app/api/admin/fallback-stats/route.ts` - Admin API endpoint aggregating fallback statistics by model
- `src/components/admin/fallback-metrics.tsx` - Dashboard component displaying fallback metrics with cost warnings
- `src/components/admin/admin-dashboard.tsx` - Integrated FallbackMetrics component into admin dashboard

## Decisions Made

**Cost warning threshold:** Set at 2x original model cost per user decision in CONTEXT.md. Models exceeding this threshold show amber warning badges.

**Aggregation source:** Fallback statistics aggregated from predictions table using `usedFallback` boolean column (added in 41-01). Each prediction records whether a fallback was used, enabling per-model rate calculations.

**Cost estimation:** Using ~500 input tokens and ~50 output tokens per prediction for cost calculations. This matches the pattern used elsewhere in the codebase (TogetherProvider.estimateCost).

**Drizzle ORM for aggregation:** Used db.execute with sql template tag for GROUP BY aggregation query. This follows the pattern established in existing queries (see queries.ts line 1422).

**Type guard for pricing:** Added instanceof checks for TogetherProvider and SyntheticProvider to safely access pricing property, which exists on provider classes but not the base LLMProvider interface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript pricing property access:** Initial implementation referenced `provider.pricing` which doesn't exist on base LLMProvider interface. Fixed by adding type guard checking `instanceof TogetherProvider || instanceof SyntheticProvider` before accessing pricing property. These are the only provider types with pricing information.

**SQL query library:** Plan showed @vercel/postgres import but project uses Drizzle ORM. Switched to `getDb()` and `db.execute(sql`...`)` pattern following existing query structure in queries.ts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 41 complete:** All three plans shipped (fallback infrastructure, orchestration, admin visibility).

**Ready for Phase 42:** Model tracking improvements can now leverage fallback data. The predictions table tracks `usedFallback` status, enabling analysis of which models need reliability improvements.

**Ready for Phase 43:** Integration testing can validate fallback behavior end-to-end. Admin dashboard provides real-time visibility for verifying fallback chains work correctly.

**Data available for analysis:**
- Per-model fallback rates calculated from predictions table
- Cost multipliers comparing original vs fallback costs
- Warning system for expensive fallbacks (>2x cost)

---
*Phase: 41-together-ai-fallbacks*
*Completed: 2026-02-05*
