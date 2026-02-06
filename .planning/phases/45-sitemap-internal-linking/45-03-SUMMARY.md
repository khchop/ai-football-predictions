---
phase: 45-sitemap-internal-linking
plan: 03
subsystem: seo
tags: [internal-linking, cross-linking, widgets, drizzle, server-components]

# Dependency graph
requires:
  - phase: 44-foundation
    provides: Match page structure with MatchLayout component
  - phase: 45-02
    provides: Pattern for cross-linking widgets on model pages
provides:
  - PredictingModelsWidget component for match pages
  - Match → Model bidirectional internal linking
  - Cross-link widgets in match pages showing all predicting models
affects: [45-04-verification, seo-optimization, internal-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-linking widgets pattern for SEO internal linking"
    - "Server components with Suspense for independent data fetching"

key-files:
  created:
    - src/components/match/predicting-models-widget.tsx
  modified:
    - src/app/leagues/[slug]/[match]/page.tsx

key-decisions:
  - "Widget queries predictions independently (not reusing page query) for modularity"
  - "Color-code points (green/yellow) for finished matches to highlight top performers"
  - "Use 3-column responsive grid layout for better space utilization"

patterns-established:
  - "Cross-linking widget pattern: Card with header icon, subtitle with count, grid of linked items"
  - "Suspense boundaries for widgets: h-[200px] skeleton fallback"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 45 Plan 03: Match-to-Model Cross-Links Summary

**PredictingModelsWidget integrated into all match pages, showing linked models with predicted scores and points**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T09:40:44Z
- **Completed:** 2026-02-06T09:42:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created PredictingModelsWidget component querying all models that predicted a match
- Integrated widget into match pages after MatchLayout component
- Established bidirectional link network: match pages link to models, model pages link to matches (via 45-02)
- Color-coded points display for finished matches (green for high scores, yellow for medium)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PredictingModelsWidget component** - `175ea88` (feat)
2. **Task 2: Integrate PredictingModelsWidget into match page** - `5f6d47f` (feat)

## Files Created/Modified
- `src/components/match/predicting-models-widget.tsx` - Server component showing all models that predicted a match with links to /models/{id}
- `src/app/leagues/[slug]/[match]/page.tsx` - Added PredictingModelsWidget after MatchLayout, wrapped in Suspense

## Decisions Made

**Widget queries independently:**
- Pattern: Each widget does its own database query (not reusing page query)
- Rationale: Modularity and PPR compatibility - widget can stream independently
- Consistent with RelatedModelsWidget pattern from 45-02

**Responsive grid layout:**
- Desktop: 3 columns
- Tablet: 2 columns
- Mobile: 1 column
- Shows model name, provider, predicted score, and points (if match finished)

**Points color coding:**
- Green (≥5 points): text-green-600/400
- Yellow (≥3 points): text-yellow-600/400
- Default (<3 points): text-foreground
- Helps users quickly identify best-performing models

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Build environment:**
- Local turbopack build fails with WASM bindings error (known issue from project memory)
- Used `npx next build --webpack` for local verification (successful)
- Production builds (Coolify/Nixpacks) use native turbopack successfully

**Database schema:**
- Initial implementation used `predictions.predictedHomeScore` (incorrect)
- Fixed to use correct column names: `predictions.predictedHome`, `predictions.predictedAway`, `predictions.totalPoints`
- Detected during TypeScript compilation (build-time safety)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**LINK-02 complete:** Match pages now link to all predicting models
- Eliminates orphan match pages
- Creates bidirectional link network with model pages
- Improves SEO discoverability through internal linking

**Ready for LINK-03 verification:** League pages already link to related models via CompetitionTopModels (verified in 45-02)

**Remaining for Phase 45:**
- Task: Verify all 3 link types (LINK-01, LINK-02, LINK-03) are working
- Final sitemap verification and deployment

## Self-Check: PASSED

---
*Phase: 45-sitemap-internal-linking*
*Completed: 2026-02-06*
