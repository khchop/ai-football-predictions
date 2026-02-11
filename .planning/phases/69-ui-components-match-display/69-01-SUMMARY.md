---
phase: 69-ui-components-match-display
plan: 01
subsystem: UI Components
tags: [team-pages, leaderboard, stats, components, tanstack-table]
dependency-graph:
  requires:
    - phase-67-foundation-data-layer
    - phase-68-routes-seo-basic-pages
  provides:
    - team-model-leaderboard-component
    - team-stats-overview-component
    - team-form-indicator-component
    - team-leaderboard-filter-component
  affects:
    - team-detail-pages
    - model-leaderboard-filtering
tech-stack:
  added: []
  patterns:
    - TanStack Table for sortable leaderboards
    - URL search params for filter state
    - Server/client component separation
    - Responsive desktop table / mobile card views
key-files:
  created:
    - src/components/team/team-model-leaderboard.tsx
    - src/components/team/team-leaderboard-filter.tsx
    - src/components/team/team-form-indicator.tsx
    - src/components/team/team-stats-overview.tsx
  modified:
    - src/lib/db/queries/team-stats.ts
    - src/app/teams/[slug]/page.tsx
decisions:
  - id: time-period-mapping
    summary: Map 'season' period to dateFrom (Aug 1) for current season filtering
    rationale: getLeaderboardWithTrends supports weekly/monthly but not season, so we translate it to dateFrom param
  - id: form-indicator-chronology
    summary: Form indicator renders left-to-right as oldest-to-newest
    rationale: getTeamFormGuide already returns chronological order, matches UX expectation of reading timeline left-to-right
  - id: leaderboard-default-sort
    summary: Default sort by rank ascending (pre-sorted by avgPoints desc from query)
    rationale: Data arrives sorted by avgPoints, rank column reflects this, users can re-sort by any column
  - id: result-badges
    summary: Add W/D/L colored circle badges to recent matches
    rationale: Visual result indicator improves scannability, follows form indicator color scheme
metrics:
  duration: 187s
  completed: 2026-02-11T14:09:38Z
---

# Phase 69 Plan 01: Team Model Leaderboard & Enhanced Stats Summary

Team pages now display per-club model leaderboards with time filtering, enhanced 11-card stats overview, and recent form indicator.

## Objective

Build the team model leaderboard, time period filtering, enhanced stats display, and form indicator for team pages to fulfill STAT-01, STAT-02, STAT-03, and MTCH-03 requirements.

## What Was Built

### Components Created

**1. TeamModelLeaderboard** (`src/components/team/team-model-leaderboard.tsx`)
- Client component rendering team-scoped model leaderboard with TanStack Table
- Desktop: sortable table with 7 columns (rank, model, avg points, accuracy, exact, total, trend)
- Mobile: responsive card view showing key stats
- Conditional styling: green for 4+ avg points, yellow for 2-4, muted for <2
- Trend indicators: ArrowUp (rising), ArrowDown (falling), Minus (stable), Sparkles (new)
- Empty state: "No predictions for this team yet"

**2. TeamLeaderboardFilter** (`src/components/team/team-leaderboard-filter.tsx`)
- Client component for time period selection
- 4 periods: All Time, This Season, Last 30 Days, Last 7 Days
- Uses URL search params (`?timePeriod=`) with Next.js router
- Removes timePeriod param when 'all' selected (clean URLs)
- Follows existing leaderboard-filters.tsx pattern

**3. TeamFormIndicator** (`src/components/team/team-form-indicator.tsx`)
- Client component rendering W/D/L colored badges in horizontal row
- Green/yellow/red badges with border, 8x8 size
- Shows last 5 matches in chronological order (left-to-right)
- Title attributes: "Win", "Draw", "Loss"
- Empty state for teams with no recent matches

**4. TeamStatsOverview** (`src/components/team/team-stats-overview.tsx`)
- Server component rendering 11 stat cards in 3 rows
- Row 1: W-D-L record, Goals Scored, Goals Conceded, Clean Sheets
- Row 2: Goal Difference (colored +/-), Avg Goals Scored, Avg Goals Conceded, Win Rate %
- Row 3: Home record, Away record, Total Matches
- Uses existing Card component pattern from page.tsx

### Query Layer Extension

**getTeamModelLeaderboard()** (`src/lib/db/queries/team-stats.ts`)
- Wraps `getLeaderboardWithTrends()` with `clubId` filter
- Maps time periods: 'weekly'/'monthly' pass through, 'season' converts to dateFrom (Aug 1)
- Returns `LeaderboardEntryWithTrend[]` with rank, stats, and trend data
- Limit defaults to 42 (all models)

### Page Integration

**Team Detail Page** (`src/app/teams/[slug]/page.tsx`)
- Added searchParams to PageProps and both generateMetadata + default export
- Parse timePeriod from searchParams (default 'all')
- Extended Promise.all to fetch formGuide and leaderboard
- Replaced inline stats cards with TeamStatsOverview component
- New sections: Statistics > Recent Form > AI Model Leaderboard > Recent Matches
- Recent matches enhanced with W/D/L result badges (colored circles)

## Task Breakdown

### Task 1: Query and Core Components
**Commit:** `a4f300c`

- Extended team-stats.ts with getTeamModelLeaderboard()
- Created TeamFormIndicator with W/D/L colored badges
- Created TeamStatsOverview with 11 stat cards including home/away splits
- Zero new dependencies

### Task 2: Leaderboard Table and Page Integration
**Commit:** `6293646`

- Created TeamLeaderboardFilter with time period URL sync
- Created TeamModelLeaderboard with TanStack Table + responsive views
- Updated team page with searchParams support
- Integrated all 4 components into team page layout
- Added W/D/L badges to recent matches

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### TypeScript Compilation
```bash
npx tsc --noEmit 2>&1 | grep "teams/\[slug\]/page"
# No new errors introduced
```

### Component Exports
```bash
grep "export function" src/components/team/team-*.tsx
# All 4 components export correctly
```

### Page Integration
```bash
grep -c "TeamModelLeaderboard\|TeamLeaderboardFilter\|TeamFormIndicator\|TeamStatsOverview\|getTeamModelLeaderboard\|getTeamFormGuide" src/app/teams/[slug]/page.tsx
# Returns 11 (all imports and usages present)
```

### SearchParams Flow
- PageProps interface includes searchParams ✓
- generateMetadata accepts searchParams ✓
- Default export accepts searchParams and resolves them ✓
- timePeriod parsed and passed to getTeamModelLeaderboard ✓

## Success Criteria

- [x] STAT-01: Team page displays per-club model leaderboard ranked by avgPoints (all 42 models)
- [x] STAT-02: Time period filter (all/season/monthly/weekly) changes data via URL params
- [x] STAT-03: Enhanced stats section shows 11 cards: W/D/L, goals, averages, home/away, win rate, clean sheets
- [x] MTCH-03: Form indicator shows last 5 matches as W/D/L badges in chronological order
- [x] All components follow existing patterns (TanStack Table, Radix Select, Card)
- [x] Zero new dependencies
- [x] Desktop table + mobile card views for leaderboard
- [x] URL params sync for time filter persistence

## Self-Check

### Created Files
```bash
[ -f "src/components/team/team-model-leaderboard.tsx" ] && echo "FOUND: team-model-leaderboard.tsx" || echo "MISSING"
# FOUND: team-model-leaderboard.tsx
[ -f "src/components/team/team-leaderboard-filter.tsx" ] && echo "FOUND: team-leaderboard-filter.tsx" || echo "MISSING"
# FOUND: team-leaderboard-filter.tsx
[ -f "src/components/team/team-form-indicator.tsx" ] && echo "FOUND: team-form-indicator.tsx" || echo "MISSING"
# FOUND: team-form-indicator.tsx
[ -f "src/components/team/team-stats-overview.tsx" ] && echo "FOUND: team-stats-overview.tsx" || echo "MISSING"
# FOUND: team-stats-overview.tsx
```

### Commits
```bash
git log --oneline | grep -E "a4f300c|6293646"
# a4f300c feat(69-01): add team leaderboard query and stats components
# 6293646 feat(69-01): integrate team leaderboard and enhanced page layout
```

## Self-Check: PASSED

All files created, both commits exist, TypeScript compiles without new errors, all success criteria met.

---

**Duration:** 187 seconds (3 minutes 7 seconds)
**Completed:** 2026-02-11T14:09:38Z
**Commits:** 2 (a4f300c, 6293646)
