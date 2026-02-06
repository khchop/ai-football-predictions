---
phase: 46-content-tags-meta-optimization
plan: 01
subsystem: seo
tags: [seo, metadata, opengraph, titles, descriptions, h1, nextjs]

# Dependency graph
requires:
  - phase: 45-sitemap-internal-linking
    provides: Complete sitemap and internal linking infrastructure
provides:
  - Centralized title/description builder functions enforcing 60/100-160 char limits
  - Compliant metadata on all page types (homepage, leagues, models, matches, blog, static)
  - Standardized H1 formulas ("{League} Predictions", "{Model} Football Predictions")
  - og:image URLs wired to all pages pointing to /api/og/* routes
  - Updated branding from 'BettingSoccer' to 'Kroam' across all metadata
affects: [46-02-og-image-routes, future SEO audits, future page additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized metadata builder pattern with enforceDescriptionLength() padding"
    - "Title suffix dropping pattern: drop ' | Kroam' if >60 chars"
    - "og:image URL pattern: /api/og/{generic|league|model} with query params"

key-files:
  created: []
  modified:
    - src/lib/seo/constants.ts
    - src/lib/seo/metadata.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/leagues/page.tsx
    - src/app/leagues/[slug]/page.tsx
    - src/components/competition/competition-header.tsx
    - src/app/models/page.tsx
    - src/app/models/[id]/page.tsx
    - src/app/leaderboard/page.tsx
    - src/app/matches/page.tsx
    - src/app/about/page.tsx
    - src/app/methodology/page.tsx
    - src/app/blog/page.tsx
    - src/app/blog/[slug]/page.tsx

key-decisions:
  - "MAX_META_DESCRIPTION_LENGTH changed from 155 to 160 (Google's actual limit)"
  - "Added MIN_DESCRIPTION_LENGTH = 100 to enforce Ahrefs best practice"
  - "Branding updated from 'BettingSoccer'/'kroam.xyz' to 'Kroam' throughout"
  - "Model count updated from 29/35 to 42 across all metadata"
  - "Title suffix drops ' | Kroam' if >60 chars instead of abbreviating team/league names"
  - "All og:image URLs point to /api/og/* routes (Plan 02 creates them in parallel)"

patterns-established:
  - "Pattern: Title builders (buildMatchTitle, buildLeagueTitle, buildModelTitle, buildGenericTitle) all follow drop-suffix-if-long logic"
  - "Pattern: Description builders use enforceDescriptionLength() for 100-160 char range with padding"
  - "Pattern: Every page has og:image URL wired, even if route doesn't exist yet (runtime resolution)"

# Metrics
duration: 68min
completed: 2026-02-06
---

# Phase 46 Plan 01: Content Tags & Meta Optimization Summary

**Centralized metadata builders enforcing 60-char titles, 100-160 char descriptions, standardized H1 formulas, and og:image URLs wired to all 13+ page types**

## Performance

- **Duration:** 68 min (1h 8m)
- **Started:** 2026-02-06T10:45:56Z
- **Completed:** 2026-02-06T11:53:47Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created 8 centralized metadata builder functions (buildMatchTitle, buildLeagueTitle, buildModelTitle, buildGenericTitle + 4 description builders)
- Updated all 13+ page types with compliant metadata (titles <60 chars, descriptions 100-160 chars)
- Standardized H1 tags following locked formulas ("{League} Predictions", "{Model} Football Predictions", etc.)
- Wired og:image URLs to all pages pointing to /api/og/* routes
- Updated branding from 'BettingSoccer'/'kroam.xyz' to 'Kroam' across site metadata
- Updated model count from 29/35 to 42 in all metadata strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SEO constants and create centralized metadata builder functions** - `cb1dfee` (feat)
2. **Task 2: Update all page metadata, H1 tags, and og:image URLs across all page types** - `f8fdd64` (feat)

## Files Created/Modified

**SEO libraries:**
- `src/lib/seo/constants.ts` - Updated SITE_NAME to 'Kroam', added MIN_DESCRIPTION_LENGTH, updated MAX_META_DESCRIPTION_LENGTH to 160
- `src/lib/seo/metadata.ts` - Added 8 centralized builder functions (4 title, 4 description) with enforceDescriptionLength() helper

**Layouts:**
- `src/app/layout.tsx` - Root layout with updated branding, model count, og:image default, template structure

**Pages:**
- `src/app/page.tsx` - Homepage with explicit metadata and og:image
- `src/app/leagues/page.tsx` - Leagues index with updated title/H1/og:image
- `src/app/leagues/[slug]/page.tsx` - League detail using buildLeagueTitle/Description
- `src/app/models/page.tsx` - Models index with updated title/H1/og:image
- `src/app/models/[id]/page.tsx` - Model detail using buildModelTitle/Description
- `src/app/leaderboard/page.tsx` - Leaderboard with updated metadata and og:image
- `src/app/matches/page.tsx` - Matches index with updated metadata and og:image
- `src/app/about/page.tsx` - About page with compliant metadata and og:image
- `src/app/methodology/page.tsx` - Methodology page with compliant metadata and og:image
- `src/app/blog/page.tsx` - Blog index with updated metadata and og:image
- `src/app/blog/[slug]/page.tsx` - Blog post detail using enforceDescriptionLength and og:image

**Components:**
- `src/components/competition/competition-header.tsx` - Updated H1 to "{League} Predictions"

## Decisions Made

**Title length enforcement:**
- Chose to drop " | Kroam" suffix when title exceeds 60 chars instead of abbreviating entity names
- Rationale: User specified never abbreviate team/league/model names; preserves full entity identity

**Description length enforcement:**
- Set MIN_DESCRIPTION_LENGTH to 100 (Ahrefs best practice)
- Set MAX_META_DESCRIPTION_LENGTH to 160 (Google's actual limit, not 155)
- Created enforceDescriptionLength() helper that pads short descriptions with generic branding text
- Rationale: Ahrefs audit flagged short descriptions; padding maintains 100-160 range

**Branding update:**
- Changed SITE_NAME from 'BettingSoccer' to 'Kroam'
- Changed siteName in metadata from 'kroam.xyz' to 'Kroam'
- Updated organization schema name from 'kroam.xyz' to 'Kroam'
- Rationale: Consistent branding across SEO metadata

**Model count update:**
- Updated from 29/35 to 42 in all metadata
- Rationale: Platform now has 42 active models (29 Together + 13 Synthetic)

**og:image wiring:**
- All pages now have og:image URLs pointing to /api/og/* routes
- Routes created by Plan 02 in parallel (deterministic URL patterns)
- Match pages use convention-based opengraph-image.tsx (no manual URL)
- Rationale: SEO audit flagged missing og:image tags

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

**Ready for Plan 02:**
- All og:image URLs wired, awaiting /api/og/* route implementation
- Title/description formulas locked and centralized
- H1 tags standardized across page types

**Blockers:** None

**Notes:**
- og:image routes don't need to exist at build time (runtime resolution)
- All title/description builders tested with type-checking (no TypeScript errors)
- Build succeeds with updated metadata

---
*Phase: 46-content-tags-meta-optimization*
*Completed: 2026-02-06*

## Self-Check: PASSED

All modified files exist and commits are present in git log.
