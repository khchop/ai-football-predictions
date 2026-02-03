---
phase: 21-leaderboard-page-rebuild
plan: 01
subsystem: leaderboard
tags: [filters, trends, sql, ui-components]

dependency-graph:
  requires: [17-01] # Design system tokens (--win, --loss colors)
  provides: [time-period-filter, trend-indicators, getLeaderboardWithTrends]
  affects: [21-02, 21-03] # SEO and stats enhancements

tech-stack:
  added: []
  patterns: [DATE_TRUNC-time-filtering, rank-comparison-trends]

key-files:
  created:
    - src/components/leaderboard/trend-indicator.tsx
  modified:
    - src/components/leaderboard-filters.tsx
    - src/lib/db/queries/stats.ts
    - src/components/leaderboard-table.tsx
    - src/lib/table/columns.tsx
    - src/app/leaderboard/page.tsx

decisions:
  - timePeriod param replaces legacy timeRange for semantic clarity
  - ISO week (Monday start) via DATE_TRUNC for weekly comparisons
  - Monthly comparison for 'all' time period trend calculation
  - Trend column placed after Accuracy, before Streak

metrics:
  duration: 4m14s
  completed: 2026-02-03
---

# Phase 21 Plan 01: Time Period Filtering and Trend Indicators Summary

**One-liner:** Time period filter (weekly/monthly/all) with SQL-based rank change trends and visual TrendIndicator component using design system colors.

## What Was Built

### 1. Time Period Filter (LeaderboardFilters)
- Replaced TIME_RANGE_OPTIONS (90d/30d/7d) with TIME_PERIOD_OPTIONS (all/monthly/weekly)
- Renamed `timeRange` URL param to `timePeriod` for semantic clarity
- Added pagination reset when timePeriod changes to prevent empty page errors

### 2. Trend Query (getLeaderboardWithTrends)
- New interface `LeaderboardEntryWithTrend` with trendDirection, rankChange, previousRank
- Added `timePeriod` to LeaderboardFilters interface
- Calculates current vs previous period rankings using DATE_TRUNC
- Uses ISO week standard (Monday start) for weekly comparisons
- For 'all' time period, compares current month vs previous month

### 3. TrendIndicator Component
- Visual component showing rank change with semantic colors
- States: rising (green up arrow), falling (red down arrow), stable (gray dash), new (blue badge)
- Uses design system colors (--win, --loss) for accessibility and consistency
- Shows absolute rank change number next to arrows

### 4. Table Integration
- Added Trend column to LeaderboardTable after Accuracy column
- TrendIndicator renders in both desktop table and mobile card view
- Column not sortable (derived metric, not primary data)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b2a906c | feat | Add time period filter and trend query |
| b695799 | feat | Create TrendIndicator component and add to table |
| 603e265 | feat | Wire time period filter to page and use trends query |

## Files Changed

### Created
- `src/components/leaderboard/trend-indicator.tsx` - Visual trend indicator component

### Modified
- `src/components/leaderboard-filters.tsx` - TIME_PERIOD_OPTIONS, timePeriod param, pagination reset
- `src/lib/db/queries/stats.ts` - LeaderboardEntryWithTrend interface, getLeaderboardWithTrends()
- `src/components/leaderboard-table.tsx` - Trend column, mobile TrendIndicator
- `src/lib/table/columns.tsx` - trendDirection/rankChange fields in LeaderboardEntry
- `src/app/leaderboard/page.tsx` - Parse timePeriod, use getLeaderboardWithTrends

## Decisions Made

1. **timePeriod over timeRange**: Renamed parameter for semantic clarity - "period" implies discrete chunks (week, month) rather than rolling ranges (30d, 90d)

2. **ISO week for weekly**: DATE_TRUNC('week') uses ISO 8601 (Monday start), consistent with European football conventions

3. **Monthly comparison for 'all'**: When viewing all-time rankings, trend shows current month vs previous month performance to keep trends meaningful

4. **Trend column placement**: After Accuracy (important metric), before Streak (similar derived indicator) - logical flow from core stats to trend indicators

## Verification Checklist

- [x] TypeScript compilation succeeds
- [x] Time period dropdown shows All Time / This Month / This Week
- [x] LeaderboardFilters has timePeriod param (not timeRange)
- [x] getLeaderboardWithTrends exported from stats.ts
- [x] TrendIndicator component created with all states
- [x] LeaderboardTable has Trend column
- [x] Mobile card view shows trend indicator
- [x] Filter changes reset pagination

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 21-02 (SEO Enhancement):
- Leaderboard now has time period filtering for richer content
- Trend data available for potential schema enhancement
- Filter state in URL enables indexable filtered views
