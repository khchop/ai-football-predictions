---
phase: 46-content-tags-meta-optimization
plan: 03
subsystem: seo
tags: [schema.org, structured-data, meta-tags, cheerio, build-audit, validation]

# Dependency graph
requires:
  - phase: 46-01
    provides: Updated metadata and H1 tags on /leagues and /models pages
  - phase: 46-02
    provides: OG images wired to all pages
provides:
  - CollectionPage structured data on /leagues and /models index pages
  - Build-time meta tag validation catching title/description/H1 violations before production
  - Cheerio-based HTML parsing for meta tag audit
affects: [future-seo-phases, content-quality-phases]

# Tech tracking
tech-stack:
  added: [cheerio]
  patterns: [CollectionPage schema.org pattern, Three-tier ItemList hierarchy, Build-time HTML validation]

key-files:
  created: []
  modified:
    - src/app/leagues/page.tsx
    - src/app/models/page.tsx
    - scripts/audit-internal-links.ts

key-decisions:
  - "Use SportsOrganization for leagues (more semantic than Thing)"
  - "Use SoftwareApplication for AI models (signals computational tools)"
  - "OG tag completeness warnings (not failures) in Pass 4"
  - "Sample 50 URLs when >50 total for faster audit runs (AUDIT_SAMPLE env var)"

patterns-established:
  - "CollectionPage -> ItemList -> ListItem three-tier hierarchy for index pages"
  - "Build-time HTML validation using cheerio to catch meta tag regressions"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 46 Plan 03: CollectionPage Structured Data & Meta Tag Validation Summary

**CollectionPage structured data on /leagues and /models with build-time meta tag validation using cheerio to prevent SEO regressions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T10:57:49Z
- **Completed:** 2026-02-06T11:00:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CollectionPage structured data on /leagues (17 leagues as SportsOrganization items)
- CollectionPage structured data on /models (all active models as SoftwareApplication items)
- Build-time Pass 4 validates title (<60 chars), description (100-160 chars), H1 count (exactly 1), and OG completeness
- Build fails on meta tag violations preventing production regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CollectionPage structured data to index pages** - `9b826a6` (feat)
2. **Task 2: Extend build-time audit with Pass 4 meta tag validation** - `b49db30` (feat)

## Files Created/Modified
- `src/app/leagues/page.tsx` - Added CollectionPage JSON-LD with 17 leagues as SportsOrganization items
- `src/app/models/page.tsx` - Added CollectionPage JSON-LD with models as SoftwareApplication items
- `scripts/audit-internal-links.ts` - Added Pass 4 meta tag validation using cheerio (title, description, H1, OG tags)
- `package.json` - Added cheerio dependency for HTML parsing

## Decisions Made

**Schema.org types:**
- Used `SportsOrganization` for leagues (more semantic than generic `Thing`, signals sports context)
- Used `SoftwareApplication` for AI models (more semantic than `Thing`, signals computational tools to search engines)

**Validation strategy:**
- OG tag completeness causes warnings (not build failures) since OG is for social sharing, not critical SEO
- Title, description, and H1 violations cause hard build failures (critical for SEO)
- Sample 50 random URLs when >50 total to keep audit fast (controlled by `AUDIT_SAMPLE` env var, default: 50)

**Structured data placement:**
- JSON-LD script tag is first child in return JSX (before visible content)
- Present in both empty state and main content branches on /models page (always included even with 0 models)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward. Cheerio integration worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 46 complete (all 3 plans done):**
- Plans 01-02 (Wave 1): Metadata/H1 standardization + OG images complete
- Plan 03 (Wave 2): Structured data + meta validation complete

**All 8 requirements covered:**
- CTAG-01: H1 tags standardized (Plan 01) + validated (Plan 03)
- CTAG-02: Description length enforced (Plan 01) + validated (Plan 03)
- CTAG-03: Description uniqueness enforced (Plan 01)
- CTAG-04: Title length enforced (Plan 01) + validated (Plan 03)
- CTAG-05: OG images complete (Plan 01-02) + validated (Plan 03)
- CTAG-06: Single H1 per page (Plan 01) + validated (Plan 03)
- INDEX-05: /leagues has CollectionPage structured data (Plan 03)
- INDEX-06: /models has CollectionPage structured data (Plan 03)

**Ready for Phase 47 or next milestone.**

**Blockers/concerns:** None

---
*Phase: 46-content-tags-meta-optimization*
*Completed: 2026-02-06*

## Self-Check: PASSED

All modified files exist:
- src/app/leagues/page.tsx ✓
- src/app/models/page.tsx ✓
- scripts/audit-internal-links.ts ✓

All commits found in git log:
- 9b826a6 (Task 1: CollectionPage structured data) ✓
- b49db30 (Task 2: Pass 4 meta tag validation) ✓
