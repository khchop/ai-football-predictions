---
phase: 16-ai-search-optimization
plan: 02
subsystem: seo
tags: [schema-org, json-ld, structured-data, ai-search, rich-results]

# Dependency graph
requires:
  - phase: 16-01
    provides: AI crawler access (robots.txt, llms.txt)
provides:
  - Consolidated JSON-LD @graph component for match pages
  - WebPage schema builder with @id cross-references
  - 5-entity schema graph (Organization, WebSite, SportsEvent, WebPage, BreadcrumbList)
affects: [match-pages, seo, ai-search-engines]

# Tech tracking
tech-stack:
  added: []
  patterns: [@graph consolidation for JSON-LD, @id cross-references between entities]

key-files:
  created:
    - src/components/MatchPageSchema.tsx
    - src/lib/seo/schema/webpage.ts
  modified: []

key-decisions:
  - "@id pattern uses URL fragments (url#webpage, url#organization) for entity cross-references"
  - "Single @graph array instead of multiple script tags eliminates validation warnings"
  - "kroam.xyz as canonical domain for all Organization/WebSite entities"

patterns-established:
  - "@graph consolidation: combine related JSON-LD entities into single script tag"
  - "@id cross-references: entities reference each other via @id URL fragments"

# Metrics
duration: 1min
completed: 2026-02-02
---

# Phase 16 Plan 02: Consolidated JSON-LD Graph Summary

**Single @graph JSON-LD component combining Organization, WebSite, SportsEvent, WebPage, and BreadcrumbList with @id cross-references for AI search engine entity understanding**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-02T19:01:21Z
- **Completed:** 2026-02-02T19:02:46Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `buildWebPageSchema()` function with @id cross-references for @graph integration
- Created `MatchPageSchema` component producing single consolidated JSON-LD script tag
- Established @id cross-reference pattern linking WebPage -> Website -> Organization
- Conditional rendering for scores (finished matches) and team logos (when present)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WebPage schema builder function** - `cb6fe4c` (feat)
2. **Task 2: Create consolidated MatchPageSchema component** - `db842cd` (feat)

## Files Created/Modified

- `src/lib/seo/schema/webpage.ts` - WebPage schema builder with @id cross-references for @graph arrays
- `src/components/MatchPageSchema.tsx` - Consolidated 5-entity JSON-LD @graph component for match pages

## Decisions Made

- **@id URL fragment pattern:** Using `url#webpage`, `url#organization`, `url#website` for entity cross-references - standard Schema.org practice for entity disambiguation
- **Single @graph consolidation:** Combining all entities into one script tag eliminates multiple JSON-LD validation warnings and improves entity relationship understanding
- **kroam.xyz canonical domain:** Consistent with existing WebPageSchema.tsx using kroam.xyz (not bettingsoccer.com from older code)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MatchPageSchema component ready for integration into match page layout
- WebPage schema builder available for other page types if needed
- Next plan should integrate MatchPageSchema into actual match pages

---
*Phase: 16-ai-search-optimization*
*Completed: 2026-02-02*
