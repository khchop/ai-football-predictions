---
phase: 20-league-page-rebuild
plan: 03
subsystem: ui
tags: [css-charts, data-visualization, accuracy, trends, drizzle]

# Dependency graph
requires:
  - phase: 17-design-system-foundation
    provides: Design tokens (--win, --draw, --loss), OKLCH color system
provides:
  - CSS-only trend chart component for accuracy visualization
  - Historical accuracy trend data query grouped by week
affects:
  - 20-04: League stats dashboard integration
  - 20-05: League page composition with trends

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS-only data visualization using design tokens
    - ISO week grouping for time-series accuracy data

key-files:
  created:
    - src/lib/league/get-league-trends.ts
    - src/components/league/league-trend-chart.tsx
  modified: []

key-decisions:
  - "CSS-only chart implementation (no Chart.js/D3.js) for minimal bundle size"
  - "Weekly grouping (ISO week) for trend granularity"
  - "Chronological order (oldest to newest) for left-to-right chart display"

patterns-established:
  - "Pattern: Use existing design tokens (bg-win, bg-draw, bg-loss) for accuracy color coding"
  - "Pattern: Return null from components for empty data (graceful handling)"
  - "Pattern: formatPeriod() for compact time period display"

# Metrics
duration: 2min
completed: 2026-02-03
---

# Phase 20 Plan 03: Trend Visualization Summary

**CSS-only trend chart with weekly accuracy grouping using existing design tokens (bg-win/draw/loss)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-03T08:46:19Z
- **Completed:** 2026-02-03T08:48:33Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `getLeagueTrends()` query returning weekly accuracy data
- Built `LeagueTrendChart` CSS-only bar chart component
- Color coding matches AccuracyBadge thresholds (<40% red, 40-70% amber, >70% green)
- Empty data handled gracefully (empty array for query, null for component)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create trend data query** - `14c6143` (feat)
2. **Task 2: Create CSS-only trend chart component** - `6297e49` (feat)

## Files Created

- `src/lib/league/get-league-trends.ts` - Query for historical accuracy trends grouped by ISO week
- `src/components/league/league-trend-chart.tsx` - CSS-only bar chart using design tokens

## Decisions Made

None - followed plan as specified

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

None - no external service configuration required

## Next Phase Readiness

- Trend visualization components ready for integration into league stats dashboard
- LeagueTrendChart accepts TrendData[] from getLeagueTrends()
- Follows existing color patterns from AccuracyBadge

---
*Phase: 20-league-page-rebuild*
*Completed: 2026-02-03*
