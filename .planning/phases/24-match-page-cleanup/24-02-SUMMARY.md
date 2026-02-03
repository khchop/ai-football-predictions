---
phase: 24
plan: 02
subsystem: match-page
tags: [layout, ux, cleanup, performance]
dependency_graph:
  requires: [24-01]
  provides: [unified-layout-order, hidden-sections-removed]
  affects: [25]
tech-stack:
  patterns: [conditional-rendering, early-return]
key-files:
  modified:
    - src/components/match/MatchStats.tsx
    - src/app/leagues/[slug]/[match]/page.tsx
decisions:
  - key: h2h-removal
    choice: Complete removal
    rationale: Not valuable to users, clutters interface
  - key: standings-removal
    choice: Complete removal
    rationale: Redundant with league page, reduces API calls
metrics:
  duration: 2m 43s
  completed: 2026-02-03
---

# Phase 24 Plan 02: Unify Layout Order and Hide Unused Sections Summary

**One-liner:** Unified match page layout with correct section order (Score -> Events -> Odds -> Content -> Predictions -> FAQ) and complete removal of H2H/standings sections with intelligent empty-state hiding.

## What Was Done

### Task 1: Remove H2H and standings from MatchStats
- Removed "League Context" Card entirely (standings and form display)
- Removed "Head-to-Head" Card entirely (h2hResults display)
- Removed unused imports: `Trophy`, `History`, `H2HMatch` type, `LeagueStanding`
- Removed `homeStanding` and `awayStanding` props from interface
- Updated grid layout from dynamic 3-4 columns to fixed 2-column layout
- Added early return when no predictions AND no match stats (FILT-03)
- Wrapped Predictions card in conditional render for data presence

### Task 2: Update page layout order and fix MatchStats props
- Removed `getStandingsForTeams` import (no longer needed)
- Removed standings fetch from Promise.all (performance improvement)
- Removed `homeStanding` and `awayStanding` variable declarations
- Updated MatchStats component call to remove standings props
- Verified layout order matches spec:
  1. Score (MatchPageHeader)
  2. Scorers/Goals (MatchEvents - conditional)
  3. Odds/Predictions (MatchStats)
  4. Pre-match/Prediction/Post-match (MatchContentSection)
  5. Predictions Table (PredictionTable)
  6. FAQ (MatchFAQ)

### Task 3: Ensure empty sections hidden without placeholders
- Verified no placeholder text exists ("no data", "unavailable", "N/A", etc.)
- Component returns null when no meaningful data
- Each card renders conditionally based on data presence
- Requirements FILT-03 and FILT-04 satisfied

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `ea56cfe` | refactor | Remove H2H and standings from MatchStats |
| `0d3aad8` | feat | Update page layout order and remove standings |

## Files Changed

| File | Change |
|------|--------|
| `src/components/match/MatchStats.tsx` | Removed H2H/standings cards, simplified to 2-column grid, added early return |
| `src/app/leagues/[slug]/[match]/page.tsx` | Removed standings fetch, updated MatchStats props |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| H2H removal | Complete removal | Not valuable to users, clutters interface |
| Standings removal | Complete removal | Redundant with league page, reduces API calls |
| Empty state handling | Return null | Cleaner UX than showing "no data" placeholders |

## Verification Results

- `npm run build` succeeds
- No "League Context" text in MatchStats (count: 0)
- No "Head-to-Head" text in MatchStats (count: 0)
- No "H2HMatch" type in MatchStats (count: 0)
- No "homeStanding" in MatchStats or page.tsx (count: 0)
- No "getStandingsForTeams" in page.tsx (count: 0)
- No placeholder text ("no data", "unavailable", etc.) in MatchStats (count: 0)

## Requirements Satisfied

| Requirement | Status |
|-------------|--------|
| FILT-01: Remove H2H section | Done |
| FILT-02: Remove league standings | Done |
| FILT-03: Hide empty sections | Done |
| FILT-04: No placeholder messages | Done |
| Layout order spec | Done |

## Performance Improvement

Removed `getStandingsForTeams` API call from Promise.all, eliminating unnecessary data fetch for every match page load.

## Next Phase Readiness

**Ready for Phase 25:** Content rendering fix (strip HTML tags from narratives) can proceed independently. Match page layout is now clean and unified.

## Technical Notes

- MatchStats component now shows only 2 cards maximum (Predictions + Match Stats)
- Early return pattern ensures component renders nothing when no data
- Grid layout simplified to responsive 1-2 column design
- Unused components (MatchHeaderSticky, H2H-related) still exist in codebase but are not imported
