---
phase: 05-seo-publication
plan: '03'
subsystem: seo
tags: [seo, sitemap, robots, open-graph, json-ld, nextjs]

# Dependency graph
requires:
  - phase: 05-01
    provides: SEO utility layer with metadata builders and schema builders
  - phase: 05-02
    provides: Match page SEO patterns and OG image template
provides:
  - Stats page with dynamic SEO metadata
  - Stats-specific OG image
  - Sitemap generation with chunking support
  - Robots.txt configuration
affects:
  - phase: 05-04 (remaining SEO work)
  - phase: 05-05 (SEO completion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Next.js 16 MetadataRoute for sitemaps
    - Dynamic OG image generation with ImageResponse
    - JSON-LD schema injection pattern

key-files:
  created:
    - src/app/matches/[id]/stats/page.tsx - Stats page with SEO
    - src/app/matches/[id]/stats/opengraph-image.tsx - Stats OG image
  modified:
    - src/app/sitemap.ts - Added BASE_URL, generateSitemaps
    - src/app/robots.ts - Added BASE_URL import

key-decisions:
  - Used BASE_URL from SEO constants for consistent URL generation
  - Implemented sitemap chunking infrastructure (50K URL limit)
  - Stats page revalidate set to 60 seconds for ISR

patterns-established:
  - Pattern: Stats page SEO with stats-specific title/description
  - Pattern: Stats-focused OG image with analytical styling
  - Pattern: Sitemap with dynamic URL generation and chunking

# Metrics
duration: 2-3 min
completed: 2026-01-27
---

# Phase 5 Plan 3: Stats Page SEO + Sitemap/Robots Summary

**Stats page with dynamic SEO metadata and sitemap/robots configuration for discoverability**

## Performance

- **Duration:** 2-3 min
- **Started:** 2026-01-27T14:44:05Z
- **Completed:** 2026-01-27T14:46:04Z
- **Tasks:** 4/4 complete
- **Files modified:** 5

## Accomplishments

- Created stats page (`/matches/{id}/stats`) with dynamic metadata
- Implemented JSON-LD SportsEvent schema injection for stats page
- Created stats-specific OG image with analytical styling and data visualization
- Updated sitemap to use BASE_URL from SEO constants
- Added generateSitemaps() function for 50,000 URL chunking support
- Updated robots.txt to use BASE_URL from SEO constants
- Preserved AI crawler allowances and proper disallow rules

## Task Commits

1. **Task 1: Add dynamic metadata and JSON-LD to stats page** - `8448e0a` (feat)
2. **Task 2: Create OG image for stats page** - `75c7c36` (feat)
3. **Task 3: Implement sitemap generation with chunking** - `7a7ea4a` (feat)
4. **Task 4: Create robots.txt configuration** - `7a7ea4a` (feat)

**Plan metadata:** `7a7ea4a` (docs)

## Files Created/Modified

- `src/app/matches/[id]/stats/page.tsx` - Stats page with dynamic metadata and JSON-LD
- `src/app/matches/[id]/stats/opengraph-image.tsx` - Stats OG image with analytical styling
- `src/app/sitemap.ts` - Updated with BASE_URL and chunking support
- `src/app/robots.ts` - Updated with BASE_URL import

## Decisions Made

- **BASE_URL consistency:** Used `BASE_URL` from `@/lib/seo/constants` for all URL generation, replacing hardcoded `https://kroam.xyz`
- **Sitemap chunking infrastructure:** Added `generateSitemaps()` function to support up to 50,000 URLs per sitemap file as per Next.js limits
- **Stats page focus:** Stats page includes JSON-LD but uses stats-specific metadata (different from match page Article schema)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stats page SEO complete, ready for any additional stats-specific features
- Sitemap and robots.txt configured with BASE_URL
- All SEO utilities from 05-01 being actively used across pages
- Ready for plan 05-04 and remaining SEO work

---

*Phase: 05-seo-publication*
*Completed: 2026-01-27*