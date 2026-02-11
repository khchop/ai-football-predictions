---
phase: 69-ui-components-match-display
plan: 02
subsystem: UI Components
tags: [team-pages, match-display, predictions, accuracy-chart, recharts]
dependency-graph:
  requires:
    - phase-67-foundation-data-layer
    - phase-68-routes-seo-basic-pages
    - phase-69-01-team-leaderboard
  provides:
    - team-upcoming-matches-component
    - team-recent-matches-component
    - team-accuracy-trend-chart
    - match-prediction-queries
  affects:
    - team-detail-pages
    - match-prediction-display
tech-stack:
  added: []
  patterns:
    - Recharts LineChart for trend visualization
    - Server component data fetching with parallel queries
    - Prediction distribution stacked bars
    - Per-match accuracy indicators
key-files:
  created:
    - src/components/team/team-upcoming-matches.tsx
    - src/components/team/team-recent-matches.tsx
    - src/components/team/team-accuracy-trend-chart.tsx
  modified:
    - src/lib/db/queries/team-stats.ts
    - src/app/teams/[slug]/page.tsx
decisions:
  - id: prediction-distribution-bar
    summary: Use horizontal stacked bar with green/yellow/blue segments for home/draw/away win percentages
    rationale: Stacked bar provides clear visual proportions of model consensus, consistent color scheme across UI
  - id: accuracy-color-thresholds
    summary: Green for 70%+, yellow for 40-70%, red for <40% accuracy
    rationale: Standard traffic light colors aligned with existing form indicator patterns
  - id: weekly-trend-aggregation
    summary: Aggregate accuracy data by week (last 20 weeks) for trend chart
    rationale: Weekly granularity balances data point density with meaningful patterns, 20 weeks provides sufficient history
  - id: conditional-link-wrapping
    summary: Wrap match cards in Link only when slug exists, otherwise plain div
    rationale: Avoids broken links for matches without slugs, maintains visual consistency
metrics:
  duration: 267s
  completed: 2026-02-11T14:16:39Z
---

# Phase 69 Plan 02: Match Prediction Display & Accuracy Trends Summary

Team pages now show upcoming match predictions with distribution bars, recent results with AI accuracy, and weekly accuracy trend charts.

## Objective

Build match prediction display components and accuracy trend visualization for team pages to fulfill MTCH-01 (upcoming predictions), MTCH-02 (recent results with accuracy), and STAT-04 (accuracy trends).

## What Was Built

### Query Layer Extensions

**getTeamUpcomingWithPredictions()** (`src/lib/db/queries/team-stats.ts`)
- Fetches scheduled matches with LEFT JOIN on predictions table
- Aggregates prediction distribution: counts home/draw/away win predictions per match
- Calculates percentages and average predicted scores
- Returns last 5 upcoming matches ordered by kickoff time (soonest first)
- Handles zero predictions gracefully (all percentages = 0)

**getTeamRecentWithAccuracy()** (`src/lib/db/queries/team-stats.ts`)
- Fetches finished matches with LEFT JOIN on scored predictions
- Aggregates per-match accuracy: counts models with correct tendency (tendencyPoints > 0)
- Counts exact score predictions (exactScoreBonus = 3)
- Returns last 10 finished matches ordered by kickoff time (most recent first)
- Computes W/D/L result from team's perspective

**getTeamAccuracyTrend()** (`src/lib/db/queries/team-stats.ts`)
- Aggregates match accuracy by week using DATE_TRUNC('week', kickoff_time)
- Returns last 20 weeks of data points
- Each point includes: weekStart, matchCount, predictionCount, correctPredictions, accuracyPct
- Data ordered chronologically (oldest → newest) for chart display

### Components Created

**1. TeamUpcomingMatches** (`src/components/team/team-upcoming-matches.tsx`)
- Server component rendering scheduled matches
- Team logos with Image component (fallback to initials in colored circle)
- Kickoff time formatted as "EEE, MMM d, h:mm a"
- Horizontal stacked prediction distribution bar:
  - Green segment: home win %
  - Yellow segment: draw %
  - Blue segment: away win %
- Labels: "Home X% | Draw Y% | Away Z%"
- Average predicted score: "X.X - Y.Y" from models
- Model count: "N AI models"
- Links to match detail page if slug exists
- Empty state: "No upcoming matches scheduled"

**2. TeamRecentMatches** (`src/components/team/team-recent-matches.tsx`)
- Server component rendering finished matches
- W/D/L colored badge: green/yellow/red circle with result letter
- Team logos and scores with bold styling for queried team
- AI accuracy visualization:
  - Thin horizontal bar showing accuracy percentage filled
  - Color-coded: green >70%, yellow 40-70%, red <40%
  - Text: "X/Y models (Z%)"
  - Green "Exact: N" badge if exactScoreCount > 0
- Date formatted as "MMM d"
- Links to match detail if slug exists
- Empty state: "No recent results"

**3. TeamAccuracyTrendChart** (`src/components/team/team-accuracy-trend-chart.tsx`)
- Client component with 'use client' directive
- Recharts LineChart with ResponsiveContainer (100% width, 300px height)
- Week labels on X-axis: "MMM dd" format, angled -45°
- Y-axis: 0-100 domain with "Accuracy (%)" label
- Blue line (#3b82f6) with strokeWidth 2, dot radius 3
- Custom themed tooltip:
  - Shows date, accuracy %, match count, prediction count
  - Background: hsl(var(--background))
  - Border: hsl(var(--border))
- Minimum 3 data points required, otherwise shows message: "Insufficient data for trend chart (need at least 3 weeks of predictions)"

### Page Integration

**Team Detail Page** (`src/app/teams/[slug]/page.tsx`)
- Extended imports: added 3 new components and 3 new query functions
- Updated Promise.all with 6 parallel queries:
  - getTeamStats
  - getTeamFormGuide
  - getTeamModelLeaderboard
  - getTeamUpcomingWithPredictions ← new
  - getTeamRecentWithAccuracy ← new
  - getTeamAccuracyTrend ← new
- Section ordering: Header > Stats Overview > Form > Model Leaderboard > **Accuracy Trend** > **Upcoming Matches** > **Recent Matches**
- Removed old inline recent matches rendering (replaced with TeamRecentMatches component)

## Task Breakdown

### Task 1: Prediction and accuracy queries for team matches
**Commit:** `2a9f7b2`

- Added 3 new query functions to team-stats.ts
- getTeamUpcomingWithPredictions: scheduled matches with prediction distribution
- getTeamRecentWithAccuracy: finished matches with per-match accuracy
- getTeamAccuracyTrend: weekly accuracy data points
- Fixed TeamMatch interface to allow nullable status field
- All queries handle zero predictions gracefully

**Files:**
- `src/lib/db/queries/team-stats.ts`

### Task 2: Match display components, accuracy chart, and page integration
**Commit:** `e7891c0`

- Created TeamUpcomingMatches with prediction distribution stacked bars
- Created TeamRecentMatches with W/D/L badges and accuracy bars
- Created TeamAccuracyTrendChart with Recharts line chart
- Integrated all 3 components into team detail page
- Updated page with parallel data fetching for 6 queries
- Proper section ordering: leaderboard → accuracy trend → upcoming → recent

**Files:**
- `src/components/team/team-upcoming-matches.tsx` (new)
- `src/components/team/team-recent-matches.tsx` (new)
- `src/components/team/team-accuracy-trend-chart.tsx` (new)
- `src/app/teams/[slug]/page.tsx`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### TypeScript Compilation
```bash
npx tsc --noEmit 2>&1 | grep -E "team-upcoming|team-recent|team-accuracy|teams/\[slug\]"
# No errors - all components type-check correctly
```

### Component Exports
```bash
ls src/components/team/team-{upcoming-matches,recent-matches,accuracy-trend-chart}.tsx
# All 3 files present
```

### Page Integration
```bash
grep -c "from.*@/components/team" src/app/teams/[slug]/page.tsx
# Returns 7 (4 from plan 69-01 + 3 new from 69-02)
```

### Query Functions
```bash
grep -c "^export async function getTeam" src/lib/db/queries/team-stats.ts
# Returns 7 (4 existing + 3 new)
```

### Recharts Usage
```bash
grep "recharts" src/components/team/team-accuracy-trend-chart.tsx
# Confirmed: LineChart, ResponsiveContainer, etc.
```

## Success Criteria

- [x] MTCH-01: Upcoming matches display prediction distribution (home/draw/away percentages) from all AI models
- [x] MTCH-02: Recent matches display actual scores with W/D/L badge and AI accuracy percentage per match
- [x] STAT-04: Line chart shows weekly model accuracy trend for the team over last 20 weeks
- [x] Prediction distribution uses horizontal stacked bar with green/yellow/blue segments
- [x] Accuracy trend chart uses Recharts LineChart with themed tooltip
- [x] All data fetched server-side via parallel Promise.all (no client-side useEffect data fetching)
- [x] Zero new dependencies added (Recharts already in package.json)

## Self-Check

### Created Files
```bash
[ -f "src/components/team/team-upcoming-matches.tsx" ] && echo "FOUND: team-upcoming-matches.tsx" || echo "MISSING"
# FOUND: team-upcoming-matches.tsx

[ -f "src/components/team/team-recent-matches.tsx" ] && echo "FOUND: team-recent-matches.tsx" || echo "MISSING"
# FOUND: team-recent-matches.tsx

[ -f "src/components/team/team-accuracy-trend-chart.tsx" ] && echo "FOUND: team-accuracy-trend-chart.tsx" || echo "MISSING"
# FOUND: team-accuracy-trend-chart.tsx
```

### Commits
```bash
git log --oneline | grep -E "2a9f7b2|e7891c0"
# 2a9f7b2 feat(69-02): add team match prediction queries
# e7891c0 feat(69-02): add match display components and accuracy chart
```

## Self-Check: PASSED

All files created, both commits exist, TypeScript compiles without errors, all success criteria met.

---

**Duration:** 267 seconds (4 minutes 27 seconds)
**Completed:** 2026-02-11T14:16:39Z
**Commits:** 2 (2a9f7b2, e7891c0)
