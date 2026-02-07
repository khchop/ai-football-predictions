---
phase: quick-027
plan: 01
subsystem: ui
tags: [content, match-detail, narrative, roundup, preview, seo]

# Dependency graph
requires:
  - phase: quick-026
    provides: roundup narrative and preview data in database
provides:
  - Finished match pages display 1500-2000+ words (preview + roundup narrative)
  - Content API exposes roundupNarrative as separate field
affects: [seo-content-quality, match-detail-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderPreviewSections() shared helper for preview markup reuse"
    - "roundupNarrative separate from postMatchContent for content flexibility"

key-files:
  created: []
  modified:
    - src/lib/db/queries.ts
    - src/app/api/matches/[id]/content/route.ts
    - src/components/match/match-narrative.tsx

key-decisions:
  - "Expose roundupNarrative as separate field alongside existing postMatchContent for backward compatibility"
  - "Extract renderPreviewSections() helper to share markup between finished and upcoming/live branches"

patterns-established:
  - "Content API returns both short-form (postMatchContent) and long-form (roundupNarrative) for flexible rendering"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Quick 027: Improve Match Detail Text Summary

**Finished match pages now show preview + full roundup narrative (1500-2000+ words) instead of just short postMatchContent (~200 words)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T17:04:08Z
- **Completed:** 2026-02-07T17:06:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Content API now returns `roundupNarrative` (full 1000+ word HTML) as separate field alongside `postMatchContent`
- Finished match pages display two sections: "Match Preview" (structured preview data) + "Match Report" (roundup narrative)
- Extracted `renderPreviewSections()` helper to eliminate duplicate preview markup between finished and upcoming/live code paths
- Upcoming/live match behavior completely unchanged (no regression)

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose roundup narrative in Content API response** - `503aa24` (feat)
2. **Task 2: Show preview + roundup narrative for finished matches** - `53ed692` (feat)

## Files Created/Modified
- `src/lib/db/queries.ts` - Added `roundupNarrative` field to UnifiedMatchContent interface and getMatchContentUnified query
- `src/app/api/matches/[id]/content/route.ts` - Added `roundupNarrative` to API JSON response
- `src/components/match/match-narrative.tsx` - Rewrote finished match rendering to show preview + roundup; extracted renderPreviewSections() helper

## Decisions Made
- **Separate field over replacement:** Exposed `roundupNarrative` as a new field rather than replacing `postMatchContent`. This preserves backward compatibility -- existing consumers of `postMatchContent` (the short model-performance-focused text) continue to work unchanged.
- **Shared helper function:** Extracted `renderPreviewSections()` instead of duplicating the 7-section preview markup. Both finished and upcoming/live code paths now use the same function.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Finished match pages now have rich content for SEO (1500-2000+ words)
- Content structure supports future enhancements (e.g., separate styling for preview vs report)
- No blockers

## Self-Check: PASSED

---
*Phase: quick-027*
*Completed: 2026-02-07*
