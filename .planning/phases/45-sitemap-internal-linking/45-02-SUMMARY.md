---
phase: 45-sitemap-internal-linking
plan: 02
subsystem: seo
tags: [internal-linking, cross-linking, widgets, model-pages, seo, drizzle-orm, react, suspense]

# Dependency graph
requires:
  - phase: 44-foundation
    provides: Index pages and canonical URL structure for models
provides:
  - RecentPredictionsWidget component showing 10 most recent match predictions per model
  - LeaguesCoveredWidget component showing all leagues a model has predicted in
  - Cross-linking from model pages to match pages (via recent predictions)
  - Cross-linking from model pages to league pages (via leagues covered)
  - Model pages now have 3+ outbound internal links plus existing inbound links
affects: [46-match-cross-linking, 47-league-cross-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Widget components with null return for empty data
    - HoverPrefetchLink for SEO-optimized link prefetching
    - Suspense boundaries with Skeleton fallbacks for PPR compatibility

key-files:
  created:
    - src/components/model/recent-predictions-widget.tsx
    - src/components/model/leagues-covered-widget.tsx
  modified:
    - src/app/models/[id]/page.tsx

key-decisions:
  - "Place cross-linking widgets after 'Performance by League' section, before 'Related Models'"
  - "Show 10 most recent predictions ordered by kickoff time DESC"
  - "Display prediction score, actual score (if finished), and points earned"
  - "Group leagues by prediction count (most active first)"
  - "Return null from widgets when no data exists (graceful degradation)"

patterns-established:
  - "Cross-linking widgets follow Card/CardHeader/CardContent pattern from existing widgets"
  - "Use HoverPrefetchLink for all internal navigation links in widgets"
  - "Wrap async widgets in Suspense with Skeleton fallbacks for PPR"

# Metrics
duration: 1min
completed: 2026-02-06
---

# Phase 45 Plan 02: Model Cross-Linking Widgets Summary

**Model detail pages now link to recent match predictions and leagues covered via two new widgets, establishing rich internal link graph for SEO**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-06T09:40:09Z
- **Completed:** 2026-02-06T09:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created RecentPredictionsWidget showing 10 most recent match predictions with links to match pages
- Created LeaguesCoveredWidget showing all leagues a model has covered with links to league pages
- Integrated both widgets into model detail page with Suspense boundaries for PPR
- Model pages now have 3+ internal links (existing: leaderboard, /models index, league top-5; new: recent predictions, leagues covered)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RecentPredictionsWidget and LeaguesCoveredWidget components** - `236d1f0` (feat)
2. **Task 2: Integrate cross-linking widgets into model detail page** - `48bff35` (feat)

## Files Created/Modified
- `src/components/model/recent-predictions-widget.tsx` - Async widget showing 10 most recent match predictions with links to `/leagues/{slug}/{match}`
- `src/components/model/leagues-covered-widget.tsx` - Async widget showing leagues covered by model with prediction counts, links to `/leagues/{slug}`
- `src/app/models/[id]/page.tsx` - Added two new cross-linking sections between "Performance by League" and "Related Models"

## Decisions Made

1. **Widget placement:** Positioned cross-linking widgets after "Performance by League" section, before "Related Models" section. This provides natural content flow (stats → predictions → leagues → related models).

2. **Recent predictions limit:** Show 10 most recent predictions ordered by kickoff time DESC. This provides sufficient recent activity without overwhelming the page.

3. **Prediction display:** Show predicted score, actual score (if finished), and points earned. Color-code points (green for high, blue for medium, muted for zero) for visual scanning.

4. **League ordering:** Order leagues by prediction count DESC to highlight most active competitions first.

5. **Graceful degradation:** Both widgets return null when no data exists (brand new model or model with no predictions yet).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Model pages now have rich internal linking to match pages and league pages
- Ready for Phase 45 Plan 03 (match cross-linking widgets)
- Widgets follow established patterns (Card/HoverPrefetchLink/Suspense) for consistency across phases
- Database queries use proper joins and indexing for performance

---
*Phase: 45-sitemap-internal-linking*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files and commits verified:
- src/components/model/recent-predictions-widget.tsx: FOUND
- src/components/model/leagues-covered-widget.tsx: FOUND
- Commit 236d1f0: FOUND
- Commit 48bff35: FOUND
