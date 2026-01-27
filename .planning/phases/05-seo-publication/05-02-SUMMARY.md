---
phase: 05-seo-publication
plan: '02'
subsystem: seo
tags: [seo, metadata, open-graph, json-ld, structured-data, nextjs]

# Dependency graph
requires:
  - phase: 05-01
    provides: SEO utility layer with metadata builders, JSON-LD schemas, and OG templates
provides:
  - Dynamic metadata for /matches/{id} with state-specific titles/descriptions
  - OG image generation with team logos, score, and status-based theming
  - JSON-LD structured data (SportsEvent + Article) for Google Rich Results
affects:
  - phase: 05-03 (Leaderboard SEO)
  - phase: 05-04 (Sitemap generation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Next.js Metadata API for dynamic SEO tags
    - Next.js ImageResponse for OG image generation
    - JSON-LD @graph pattern for combining multiple schemas
    - Template-based OG image styling (upcoming/live/finished)

key-files:
  created:
    - src/app/matches/[id]/opengraph-image.tsx - Dynamic OG image generation
  modified:
    - src/app/matches/[id]/page.tsx - Metadata, OG image URL, JSON-LD injection

key-decisions:
  - Used existing SEO utilities from plan 05-01 instead of creating inline implementations
  - Imported mapMatchToSeoData to adapt database Match to SEO MatchSeoData format

patterns-established:
  - Pattern: Match page SEO integration using utility layer
  - Pattern: OG image generation with team data and template-based theming

# Metrics
duration: 2 min
completed: 2026-01-27
---

# Phase 5 Plan 2: Match Page SEO Integration Summary

**Dynamic metadata, OG images, and JSON-LD structured data for the /matches/{id} match detail page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T14:40:09Z
- **Completed:** 2026-01-27T14:41:50Z
- **Tasks:** 3/3 complete
- **Files modified:** 2

## Accomplishments

- Integrated buildMatchMetadata for dynamic SEO titles/descriptions based on match state (upcoming/live/finished)
- Created opengraph-image.tsx with dynamic OG image generation showing team logos, competition, and score
- Added JSON-LD structured data injection (SportsEvent + Article) for Google Rich Results
- Match page now has unique meta tags per match, improving search visibility

## Task Commits

1. **Task 1: Add dynamic metadata to match page** - `f0901fc` (feat)
2. **Task 2: Create OG image for match page** - `3571e60` (feat)

**Plan metadata:** `b5f8c9d` (docs: complete plan)

## Files Created/Modified

- `src/app/matches/[id]/opengraph-image.tsx` - Dynamic OG image generation (300 lines)
- `src/app/matches/[id]/page.tsx` - Updated with metadata, OG URL, JSON-LD injection (22 insertions, 13 deletions)

## Decisions Made

- **SEO utility reuse:** Leveraged buildMatchMetadata from plan 05-01 instead of creating inline metadata, ensuring consistency with the SEO utility layer design
- **Data mapping:** Used mapMatchToSeoData helper to adapt database Match type to SEO MatchSeoData interface, keeping the page component clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEO utility layer (05-01) and match page integration (05-02) complete
- Ready for leaderboard SEO integration in plan 05-03
- OG image infrastructure in place for other pages to follow same pattern

---

*Phase: 05-seo-publication*
*Completed: 2026-01-27*