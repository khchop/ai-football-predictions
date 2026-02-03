---
phase: 18-match-page-rebuild
plan: 01
subsystem: ui
tags: [react, intersection-observer, hooks, score-deduplication]

# Dependency graph
requires:
  - phase: 17-design-system-foundation
    provides: Design tokens and component patterns
provides:
  - Intersection Observer hook for viewport detection
  - MatchPageHeader combining hero and observer-triggered sticky
  - Score deduplication - visible only in hero + sticky header
affects: [18-match-page-rebuild, ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Intersection Observer for sticky header trigger
    - Client component composition with observer hooks

key-files:
  created:
    - src/hooks/use-intersection-observer.ts
    - src/components/match/match-page-header.tsx
  modified:
    - src/app/leagues/[slug]/[match]/page.tsx

key-decisions:
  - "Intersection Observer triggers sticky only when hero exits viewport"
  - "Score appears exactly twice: large in hero, compact in sticky header"
  - "Removed score from MatchStats predictions panel"

patterns-established:
  - "useIntersectionObserver hook pattern for reusable viewport detection"
  - "Observer-triggered sticky headers instead of always-visible sticky"

# Metrics
duration: 1min
completed: 2026-02-03
---

# Phase 18 Plan 01: Score Deduplication Summary

**Intersection Observer-based sticky header ensures score appears exactly in hero section and compact sticky reference only**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-03T07:08:45Z
- **Completed:** 2026-02-03T07:10:01Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Score now appears exactly twice on page: prominent in hero, compact in sticky header
- Sticky header triggered by Intersection Observer when hero scrolls out of viewport
- Reusable useIntersectionObserver hook created for future viewport detection needs
- MatchPageHeader combines hero and conditional sticky in single component

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Intersection Observer hook** - `169d09c` (feat)
2. **Task 2: Create MatchPageHeader combining hero + observer-triggered sticky** - `eb9d871` (feat)
3. **Task 3: Update match page to use MatchPageHeader and deduplicate scores** - `bd012be` (feat)

## Files Created/Modified
- `src/hooks/use-intersection-observer.ts` - Reusable hook for detecting element visibility with threshold 0 and rootMargin -1px
- `src/components/match/match-page-header.tsx` - Client component wrapping hero with observer ref, conditionally rendering sticky when hero not intersecting
- `src/app/leagues/[slug]/[match]/page.tsx` - Replaced MatchHeaderSticky with MatchPageHeader

## Decisions Made

1. **Intersection Observer trigger point:** Used threshold: 0 and rootMargin: '-1px 0px' to trigger exactly when hero exits viewport (not on scroll direction)
2. **Score placement:** Kept score in two locations only - large display in hero (MatchHeader), compact display in sticky (MatchHeaderSticky shown conditionally)
3. **Component composition:** Created MatchPageHeader as wrapper combining hero + observer logic rather than modifying existing components
4. **Historical scores preserved:** H2H match scores in MatchStats remain (different context - not current match score)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - Intersection Observer API worked as expected, build passed without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Score deduplication complete (MTCH-01 requirement met)
- Ready for MTCH-02 (content visibility improvements)
- Intersection Observer hook available for future phase needs
- No blockers or concerns

---
*Phase: 18-match-page-rebuild*
*Completed: 2026-02-03*
