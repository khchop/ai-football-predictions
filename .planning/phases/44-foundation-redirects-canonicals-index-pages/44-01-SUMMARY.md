---
phase: 44-foundation-redirects-canonicals-index-pages
plan: 01
subsystem: seo
tags: [canonical-urls, seo, metadata, next.js, hreflang]

# Dependency graph
requires:
  - phase: v2.5
    provides: Stable match page routes and metadata generation
provides:
  - Removed cascading canonical from root layout preventing duplicate content detection
  - Self-referential canonical URLs on match pages matching actual route structure
  - Eliminated broken hreflang tags pointing to non-existent subdomains
affects: [45-redirects-middleware, 46-index-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [self-referential canonicals, no cascading metadata from root layout]

key-files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/app/leagues/[slug]/[match]/page.tsx
    - src/lib/seo/metadata.ts

key-decisions:
  - "Removed all hreflang tags - no i18n subdomain support"
  - "Match pages use /leagues/{slug}/{match} as canonical (not /matches/{id})"
  - "Root layout provides only metadataBase, no canonical or language alternates"

patterns-established:
  - "Each page defines its own canonical URL independently"
  - "buildMatchMetadata accepts optional canonicalPath parameter for flexibility"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 44 Plan 01: Foundation (Redirects, Canonicals & Index Pages) Summary

**Removed cascading canonical and hreflang tags from root layout; match pages now use self-referential canonical URLs matching /leagues/{slug}/{match} route structure**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T08:40:22Z
- **Completed:** 2026-02-06T08:42:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Removed cascading canonical URL from root layout that caused Google to see all pages as duplicates of homepage
- Eliminated broken hreflang tags pointing to non-existent subdomains (de.kroam.xyz, es.kroam.xyz, fr.kroam.xyz, it.kroam.xyz)
- Match pages now have self-referential canonical URLs using actual route path /leagues/{slug}/{match} instead of incorrect /matches/{id}
- Preserved metadataBase for relative URL resolution and html lang="en" for accessibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove cascading canonical and hreflang from root layout** - `0886a22` (fix)
2. **Task 2: Verify and fix match page self-referential canonicals** - `86d5105` (fix)

## Files Created/Modified
- `src/app/layout.tsx` - Removed alternates.canonical and alternates.languages from root metadata
- `src/lib/seo/metadata.ts` - Added canonicalPath parameter to buildMatchMetadata function
- `src/app/leagues/[slug]/[match]/page.tsx` - Construct and pass self-referential canonical path to metadata builder

## Decisions Made

1. **Complete hreflang removal**: Removed all language alternate tags since subdomains don't exist and there's no i18n implementation
2. **Self-referential canonicals**: Match pages use their actual URL path as canonical (/leagues/{slug}/{match}) instead of the old /matches/{id} pattern
3. **Short-form league slugs**: Canonical URLs use competition ID (short form like "epl") not long-form aliases
4. **Root layout minimal metadata**: Root layout only provides metadataBase and lang attribute, each page defines own canonical

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward metadata removal and canonical path updates. Build verification successful with webpack (turbopack fails locally due to missing SWC binary per known issue in MEMORY.md).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 44 Plan 02 (redirect middleware implementation). Current changes:
- Root layout no longer cascades canonical or hreflang to child pages
- Match pages have correct self-referential canonicals
- No broken hreflang tags in HTML output

Blockers/Concerns: None

## Self-Check: PASSED

All modified files verified:
- src/app/layout.tsx exists and contains no alternates block
- src/app/leagues/[slug]/[match]/page.tsx exists with canonicalPath construction
- src/lib/seo/metadata.ts exists with canonicalPath parameter

All commits verified:
- 0886a22 exists (Task 1)
- 86d5105 exists (Task 2)

---
*Phase: 44-foundation-redirects-canonicals-index-pages*
*Completed: 2026-02-06*
