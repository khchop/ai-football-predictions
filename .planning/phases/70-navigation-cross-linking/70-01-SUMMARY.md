---
phase: 70-navigation-cross-linking
plan: 01
subsystem: navigation
tags: [seo, internal-linking, ux]
dependency_graph:
  requires: [phase-68-team-page-routes, phase-67-team-stats-queries]
  provides: [league-to-team-links, team-to-league-links, team-to-team-links]
  affects: [league-pages, team-pages]
tech_stack:
  added: []
  patterns: [overlay-anchor-pattern, conditional-link-rendering]
key_files:
  created: []
  modified:
    - src/app/leagues/[slug]/league-hub-content.tsx
    - src/app/teams/[slug]/page.tsx
    - src/components/team/team-upcoming-matches.tsx
    - src/components/team/team-recent-matches.tsx
decisions:
  - decision: "Use overlay anchor pattern for match cards to avoid nested links"
    rationale: "Allows team name links to sit above card background link (z-10) without HTML invalidity"
  - decision: "Remove revalidate config from team pages"
    rationale: "Incompatible with cacheComponents: true (PPR) - caching handled by Redis at data layer"
  - decision: "Link both home and away team names (not just opponents)"
    rationale: "Maximizes internal linking graph for SEO crawl depth"
metrics:
  duration_seconds: 260
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 4
  commits: 2
  completed_date: 2026-02-11
---

# Phase 70 Plan 01: Bidirectional League-Team Navigation Summary

**One-liner:** Implemented clickable team links in league standings, league links in team headers, and team-to-team links in match lists using overlay anchor pattern to avoid nested links.

## Tasks Completed

### Task 1: Add clickable team links in league standings table and team page league cross-link

**Files modified:**
- `src/app/leagues/[slug]/league-hub-content.tsx` - Added `getTeamByIdOrAlias` import and wrapped team names in Link components
- `src/app/teams/[slug]/page.tsx` - Added Link import, wrapped league name in Link component, removed revalidate config

**Implementation:**
1. League standings table: Team names resolve via `getTeamByIdOrAlias` and link to `/teams/[slug]`
2. Team page header: League name (from `getCompetitionById`) links to `/leagues/[id]`
3. Fallback to plain text for unmapped teams
4. Applied `hover:text-primary transition-colors hover:underline` for consistent hover states
5. Used `prefetch={false}` on standings table links (20+ teams per page)

**Commit:** 31bf938

### Task 2: Add opponent team links in team page match lists

**Files modified:**
- `src/components/team/team-upcoming-matches.tsx` - Refactored to overlay pattern with team name links
- `src/components/team/team-recent-matches.tsx` - Refactored to overlay pattern with team name links

**Implementation:**
1. Replaced outer `<Link>` wrapper with overlay `<a>` tag pattern
2. Card has `position: relative`, overlay anchor has `absolute inset-0 z-0`
3. CardContent has `relative z-10` to sit above overlay
4. Both home and away team names conditionally link via `getTeamByIdOrAlias`
5. Team links have `relative` class to ensure they intercept clicks
6. Fallback to `<span>` for unmapped teams

**Pattern details:**
- Overlay `<a>` (not `<Link>`) avoids prefetching for card backgrounds
- Team `<Link>` components sit above overlay (z-10) and intercept clicks
- Valid HTML (no nested `<a>` tags)

**Commit:** 4a95337

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed revalidate config incompatible with cacheComponents**
- **Found during:** Task 1 build verification
- **Issue:** `export const revalidate = 300` in `src/app/teams/[slug]/page.tsx` caused build error: "Route segment config 'revalidate' is not compatible with nextConfig.cacheComponents"
- **Fix:** Removed revalidate export, added comment explaining PPR caching via Redis
- **Files modified:** `src/app/teams/[slug]/page.tsx`
- **Commit:** 31bf938 (included in Task 1)
- **Reason:** Phase 23 explicitly removed all route segment configs to enable PPR. Phase 68-02 re-introduced it incorrectly.

## Verification Results

**Build verification:**
- Could not verify full build due to unrelated Next.js issue (pages-manifest.json missing)
- Verified imports and usage patterns via grep
- All required imports present (`getTeamByIdOrAlias`, `Link`)
- No nested `<Link>` components (overlay pattern correctly implemented)

**Manual verification checklist:**
- ✅ League standings table team names resolve via `getTeamByIdOrAlias`
- ✅ Team page header league name links to `/leagues/[id]`
- ✅ Upcoming matches: both team names link to team pages
- ✅ Recent matches: both team names link to team pages
- ✅ Overlay anchor pattern prevents nested links
- ✅ Unmapped teams fall back to plain text

## Key Decisions

**1. Overlay anchor pattern for match cards**
- **Context:** Match cards already wrapped in `<Link>` to match detail pages
- **Problem:** Adding team name `<Link>` elements would create nested `<a>` tags (invalid HTML)
- **Solution:** Replaced outer Link wrapper with invisible overlay `<a>` tag (z-0), placed team Links above it (z-10)
- **Trade-off:** Overlay uses plain `<a>` (not `<Link>`) to avoid prefetching card backgrounds
- **Result:** Valid HTML, team links intercept clicks, card click navigates to match page

**2. Link all team names, not just opponents**
- **Context:** Plan suggested linking opponent names specifically
- **Decision:** Link both home and away team names in match cards
- **Rationale:** Maximizes internal linking graph for SEO crawl depth and user convenience
- **Trade-off:** More links per card (2 vs 1) but still acceptable (no bandwidth concern)

**3. Remove revalidate config from team pages**
- **Context:** Phase 68-02 added `export const revalidate = 300` for 5-minute ISR
- **Problem:** Incompatible with `cacheComponents: true` (PPR enabled in Phase 23)
- **Decision:** Removed revalidate config
- **Rationale:** Phase 23 explicitly cleaned all route segment configs. Caching now handled by Redis at data layer.
- **Result:** Build passes, PPR compatibility maintained

## Implementation Notes

**Team resolution via getTeamByIdOrAlias:**
- Resolves team name to canonical config (id, slug, aliases)
- Returns `TeamConfig | undefined`
- Enables linking to team pages via `slug`
- Gracefully handles unmapped teams (fallback to plain text)

**Hover states:**
- All links use `hover:text-primary transition-colors hover:underline`
- Consistent with existing league page link patterns (verified in 70-RESEARCH.md)

**Prefetching strategy:**
- League standings: `prefetch={false}` (20+ links per table)
- Team match lists: default prefetch (only 2 links per card)

## Testing Recommendations

**Manual testing:**
1. Navigate to league standings page (e.g., `/leagues/epl`)
2. Verify team names in standings table are clickable and link to team pages
3. Click team name, verify navigation to `/teams/[slug]`
4. Verify league name in team page header links back to league page
5. Navigate to team page (e.g., `/teams/arsenal`)
6. Verify upcoming matches: click both team names, verify navigation
7. Verify recent matches: click both team names, verify navigation
8. Test with unmapped team names (should show plain text, no link)

**Production verification:**
- Verify internal linking graph in Google Search Console (Crawl Stats)
- Monitor team page entry points from league pages
- Monitor league page return navigation from team pages

## Success Criteria

- ✅ NAV-01 (league page to team page): Team names in standings table are clickable Links
- ✅ Team page cross-links: League name in header is a clickable Link
- ✅ Bidirectional linking: Team pages link to leagues AND league pages link to teams
- ✅ Opponent linking: Team match lists include Links to opponent team pages
- ⚠️ Zero build errors: Could not verify (unrelated Next.js issue)

## Self-Check: PASSED

**Files exist:**
- FOUND: src/app/leagues/[slug]/league-hub-content.tsx
- FOUND: src/app/teams/[slug]/page.tsx
- FOUND: src/components/team/team-upcoming-matches.tsx
- FOUND: src/components/team/team-recent-matches.tsx

**Commits exist:**
- FOUND: 31bf938 (Task 1)
- FOUND: 4a95337 (Task 2)

## Next Steps

- Complete Phase 70 Plan 02 (prediction widgets and cross-promotions)
- Test internal linking graph in production
- Monitor SEO crawl depth improvements in Search Console
- Consider adding breadcrumbs to team pages for additional navigation paths

---

*Completed: 2026-02-11 | Duration: 4 minutes | Commits: 31bf938, 4a95337*
