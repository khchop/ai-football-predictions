---
phase: 09-critical-seo-errors
plan: 01
subsystem: seo
tags: [aliases, redirects, url-canonicalization, seo-fixes]

requires: []
provides:
  - Competition alias system with 301 redirects
  - Canonical URL enforcement for league and match pages
  - Support for both short IDs and long-form slugs

affects:
  - phase: 09
    plan: 02
    note: "Other SEO fixes can build on canonical URL system"

tech-stack:
  added: []
  patterns:
    - Alias resolution with fallback lookup
    - Permanent redirects (308) for SEO
    - Canonical URL enforcement in metadata

key-files:
  created: []
  modified:
    - src/lib/football/competitions.ts
    - src/app/leagues/[slug]/page.tsx
    - src/app/leagues/[slug]/[match]/page.tsx
    - src/lib/db/queries.ts

decisions:
  - decision: "Use 308 Permanent Redirect instead of 301"
    rationale: "Next.js permanentRedirect uses 308, which preserves HTTP method"
    alternatives: ["301 redirect via redirect() with custom type"]
  - decision: "Add aliases array to CompetitionConfig instead of separate mapping"
    rationale: "Keep configuration co-located, easier to maintain and understand"
    alternatives: ["Separate COMPETITION_ALIASES object", "Database-based aliases"]
  - decision: "Query both competition.id and competition.slug in database"
    rationale: "Support both canonical config IDs and database slugs in one query"
    alternatives: ["Separate query functions", "Always map to database slug first"]

metrics:
  duration: "4.3 minutes"
  completed: "2026-02-02"
---

# Phase 09 Plan 01: Competition Alias System Summary

Slug alias system enabling both short IDs (epl, ucl) and long-form slugs (premier-league, champions-league) with 308 redirects to canonical URLs.

## Objective Achieved

Added competition alias system that resolves 7 404 errors in sitemap by making long-form SEO-friendly slugs work as aliases while maintaining short IDs as canonical URLs.

## Implementation Summary

### Task 1: Competition Config Updates
**Commit:** 9404309

Added aliases infrastructure to competition configuration:
- Added `aliases?: string[]` field to `CompetitionConfig` interface
- Configured aliases for 6 competitions with slug mismatches:
  - ucl → ['champions-league']
  - uel → ['europa-league']
  - epl → ['premier-league']
  - laliga → ['la-liga']
  - seriea → ['serie-a']
  - ligue1 → ['ligue-1']
- Created `getCompetitionByIdOrAlias()` function:
  - First tries exact ID match
  - Falls back to alias search
  - Returns undefined if neither matches

### Task 2: League Page Redirects
**Commit:** 3d69abe

Updated league page to handle aliases and redirect to canonical URLs:
- Imported `getCompetitionByIdOrAlias` and `permanentRedirect`
- Replaced `getCompetitionById` with `getCompetitionByIdOrAlias` in both generateMetadata and LeaguePage
- Added alias detection and permanent redirect: `if (slug !== competition.id) permanentRedirect(/leagues/${competition.id})`
- Updated canonical URLs in metadata to use `competition.id` instead of `slug`
- Passed `competition.id` to LeagueHubContent component
- Updated breadcrumb schema to use canonical competition ID

### Task 3: Match Page and Query Updates
**Commit:** fd8a09b

Extended alias support to match pages:
- Imported `getCompetitionByIdOrAlias` and `permanentRedirect` in match page
- Added alias detection in both generateMetadata and MatchPage component
- Implemented permanent redirect for alias URLs: `/leagues/{alias}/{match}` → `/leagues/{canonical}/{match}`
- Updated `getMatchBySlug` query to support both `competition.id` and `competition.slug`:
  - Changed WHERE clause to use OR condition checking both fields
  - Enables lookup by canonical config ID or database slug
- Updated all internal links to use canonical competition IDs:
  - Back to league link
  - Breadcrumb URLs
  - Related match links
  - Upcoming fixtures links
- Applied `getCompetitionByIdOrAlias` to dynamically resolve competition IDs for related matches

## Verification Results

All verification criteria passed:

1. ✓ `/leagues/epl` returns 200 (canonical URL works)
2. ✓ `/leagues/premier-league` returns 308 redirect to `/leagues/epl`
3. ✓ `/leagues/ucl` returns 200 (canonical URL works)
4. ✓ `/leagues/champions-league` returns 308 redirect to `/leagues/ucl`
5. ✓ TypeScript compiles without errors
6. ✓ No 404 errors when accessing long-form URLs
7. ✓ Canonical URLs in metadata use short IDs

## Technical Details

### Alias Resolution Strategy

1. **Lookup Order:**
   - Try exact match on competition.id (fast, in-memory)
   - If not found, search aliases array
   - Return undefined if neither matches

2. **Redirect Flow:**
   - Page component receives slug parameter
   - Call `getCompetitionByIdOrAlias(slug)`
   - If found AND slug ≠ competition.id → redirect
   - Else proceed with canonical ID

3. **Query Compatibility:**
   ```typescript
   where(
     and(
       or(
         eq(competitions.slug, competitionSlug),
         eq(competitions.id, competitionSlug)
       ),
       eq(matches.slug, matchSlug)
     )
   )
   ```

### SEO Benefits

1. **301/308 Permanent Redirects:** Search engines understand canonical URL preference
2. **Canonical Tags:** Metadata uses competition.id in canonical URLs
3. **No Duplicate Content:** Aliases redirect, preventing split SEO value
4. **Backward Compatible:** Both short and long URLs work, old links preserved

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for Phase 09, Plan 02:** Other SEO fixes can proceed.

**Key Outputs:**
- Competition alias system functional and tested
- 7 404 errors resolved (long-form slug URLs now redirect)
- Canonical URL enforcement throughout league and match pages

**No Blockers:** System working as designed, ready for additional SEO improvements.

## Key Learnings

1. **Next.js Redirect Types:** `permanentRedirect()` uses 308, not 301. Both are permanent redirects, but 308 preserves HTTP method (POST stays POST).

2. **Alias Co-location:** Keeping aliases in the CompetitionConfig interface makes maintenance easier than separate mappings.

3. **Query Flexibility:** Using OR conditions in database queries allows supporting both canonical IDs and database slugs without code duplication.

4. **Link Resolution:** Related match links needed inline alias resolution to ensure all internal links use canonical IDs.
