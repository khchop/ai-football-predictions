---
phase: 58-observability-monitoring
plan: 02
subsystem: api, ui
tags: [recharts, admin-dashboard, model-health, observability, trend-visualization, next-api]

# Dependency graph
requires:
  - phase: 58-01
    provides: "llm_model_stats table, getAllModelHealthSummary, getModelHealthTrends query functions"
  - phase: 52-monitoring-observability
    provides: "Admin API auth/rate-limit patterns, pipeline-health endpoint pattern"
provides:
  - "GET /api/admin/model-health endpoint (summary + per-model detail modes)"
  - "ModelHealthCards component with color-coded status cards and Recharts trend charts"
  - "Admin dashboard integration with Model Health Trends section"
affects: [58-03-dashboard-visualization]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Recharts ReferenceLine for threshold visualization", "Modal detail expansion for per-model trends", "Multi-window time selector (7d/30d/90d) with shared chart component"]

key-files:
  created:
    - "src/app/api/admin/model-health/route.ts"
    - "src/components/admin/model-health-cards.tsx"
  modified:
    - "src/components/admin/admin-dashboard.tsx"

key-decisions:
  - "Summary mode returns all models by default; detail mode triggered by ?modelId= query param"
  - "Health cards use click-to-expand modal pattern (not inline expansion) to avoid grid reflow"
  - "Component fetches its own data via password prop rather than receiving data from parent"

patterns-established:
  - "Admin component pattern: accept password prop, fetch from own API endpoint, handle loading/error internally"
  - "Recharts ReferenceLine at 90% threshold for visual health baseline"
  - "Status filter with count badges for quick triage (all/healthy/warning/critical)"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 58 Plan 02: Admin Model Health API & Dashboard Cards Summary

**Admin API endpoint for per-model health with Recharts LineChart trend visualization, color-coded status cards, and 7/30/90-day window selector**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T12:31:52Z
- **Completed:** 2026-02-08T12:35:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- GET /api/admin/model-health endpoint with dual-mode (summary all models / detail single model) following admin auth + rate limit pattern
- ModelHealthCards component with 4-stat summary bar, filterable model card grid, and click-to-expand detail modal
- Recharts LineChart with 90% threshold ReferenceLine, 7d/30d/90d time window selector, and tooltip showing date + success rate + attempts
- Color-coded health status throughout: green (>=90%), yellow (>=80%), red (<80%) with trend direction indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/admin/model-health endpoint and model health cards component** - `183a095` (feat)
2. **Task 2: Integrate model health section into admin dashboard** - `87baf87` (feat)

## Files Created/Modified
- `src/app/api/admin/model-health/route.ts` - GET endpoint returning per-model health summary or detailed trends with admin auth + rate limiting
- `src/components/admin/model-health-cards.tsx` - Full health cards UI with summary bar, filterable grid, detail modal with Recharts chart
- `src/components/admin/admin-dashboard.tsx` - Added ModelHealthCards import and "Model Health Trends" section with TrendingUp icon

## Decisions Made
- **Dual-mode endpoint:** Summary mode (no params) returns all models for the overview grid; detail mode (?modelId=x) returns 7/30/90-day trend data for the chart. Single endpoint keeps the API surface minimal.
- **Modal detail expansion:** Clicking a model card opens a centered modal with the Recharts chart rather than expanding inline. This avoids grid reflow issues with variable-height content.
- **Self-fetching component:** ModelHealthCards manages its own data fetching and error handling rather than receiving data from the parent dashboard. This follows the pattern established by FallbackMetrics and keeps the dashboard component lean.
- **ReferenceLine for threshold:** Using Recharts ReferenceLine at y=90 with green dashed stroke provides a persistent visual baseline that makes it immediately obvious which days fell below the health threshold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter type**
- **Found during:** Task 1 (model health cards component)
- **Issue:** Recharts v3 Tooltip formatter expects `(value: number | undefined)` parameter, not strict `(value: number)`
- **Fix:** Changed to untyped parameter with runtime number check
- **Files modified:** src/components/admin/model-health-cards.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors in new files
- **Committed in:** 183a095 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed impossible type comparison in status filter**
- **Found during:** Task 1 (model health cards component)
- **Issue:** TypeScript narrowing made `status === 'all'` comparison unreachable inside a branch where status was already typed as `'healthy' | 'warning' | 'critical'`
- **Fix:** Simplified filter to only check `m.status === status` since the 'all' case is already handled by the outer condition
- **Files modified:** src/components/admin/model-health-cards.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 183a095 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes were TypeScript type errors caught during compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The endpoint uses the existing admin auth mechanism (ADMIN_PASSWORD env var) and the llm_model_stats table from plan 58-01.

## Next Phase Readiness
- Admin API and dashboard visualization complete for per-model health
- Plan 58-03 can build on this foundation for additional observability features
- Dashboard section renders within existing admin page, no new routes needed
- llm_model_stats table migration (from 58-01) must be applied to production database before this endpoint returns meaningful data

## Self-Check: PASSED

- All 3 files exist (route.ts, model-health-cards.tsx, admin-dashboard.tsx modified)
- Both commits verified (183a095, 87baf87)
- API endpoint exports GET function with admin auth + rate limiting
- ModelHealthCards component imported and rendered in admin dashboard
- Recharts LineChart with ReferenceLine at 90% threshold
- Color-coded status: green (>=90%), yellow (>=80%), red (<80%)

---
*Phase: 58-observability-monitoring*
*Completed: 2026-02-08*
