# Implementation Plan

**Project**: navigation-site-improvements
**Generated**: 2026-01-26T16:15:00.000Z

## Executive Summary

This plan addresses 5 key issues identified in the current navigation and site structure:

1. **Duplicate URLs**: `/leagues/[slug]` vs `/predictions/[league]/[slug]` causing confusion
2. **Empty Blog**: No league roundups generated via `regenerate-content` script
3. **Matches Position**: "Matches" link is in top nav - should be in footer
4. **League Dropdown**: Poor visual hierarchy and cramped layout
5. **Navigation Order**: LeagueSelector position in header menu

---

## Technical Context & Standards

*Detected Stack & Patterns*
- **Architecture**: Next.js 16.1.4 App Router, Monolith
- **Framework**: React 19.2.3 with TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui components (Radix UI primitives)
- **State**: Server Components by default, client components for interactive
- **API**: Server Actions + Drizzle ORM queries
- **Database**: PostgreSQL with Drizzle ORM
- **Conventions**:
  - Components: PascalCase in `src/components/`
  - Client components: `'use client'` directive at top
  - Imports: Use `@/*` alias (maps to `./src/*`)
  - Styling: `cn()` utility from `@/lib/utils` for conditional classes
  - Icons: `lucide-react`
  - shadcn/ui: Components in `src/components/ui/`
  - Routes: App Router in `src/app/`

---

## Phase 1: URL Consolidation

**Goal**: Merge `/leagues/[slug]` and `/predictions/[league]/[slug]` into single, canonical URL structure

### Issue Analysis
- `/leagues/[slug]` → Points to `/leagues/ligue1`, `/leagues/ucl`, etc. - sparse content
- `/predictions/[league]/[slug]` → Points to `/predictions/ligue-1/manchester-city-vs-liverpool` - rich content with predictions, analysis, stats
- Both URLs exist but serve different purposes and have inconsistent slug formats (`ligue1` vs `ligue-1`)

### Recommended Strategy
**Keep `/predictions/[league]/[slug]` as primary** (rich content, existing traffic) and redirect `/leagues/[slug]` to appropriate `/predictions/` URLs or consolidate into a unified league hub that links to predictions.

---

- [ ] **1.1: Audit URL structures and content differences**
  Task ID: phase-1-url-01
  > **Implementation**: Create audit document comparing `/leagues/[slug]` and `/predictions/[league]/[slug]` content, identifying what exists in each.
  > **Details**: 
  > - Read `src/app/leagues/[slug]/league-hub-content.tsx`
  > - Read `src/app/predictions/[league]/[slug]/page.tsx`
  > - Document: What content exists only in predictions? What should exist in league hub?

- [ ] **1.2: Design unified URL strategy**
  Task ID: phase-1-url-02
  > **Implementation**: Create `docs/url-strategy.md` with recommended approach.
  > **Details**: Decide whether to:
  > - Option A: Redirect `/leagues/` → `/predictions/` (keep predictions as primary)
  > - Option B: Make `/leagues/` the hub with links to `/predictions/`
  > - Option C: Merge both into single page with tabs (Match list vs Predictions)

- [ ] **1.3: Implement URL redirects or consolidation**
  Task ID: phase-1-url-03
  > **Implementation**: Modify `src/app/leagues/[slug]/page.tsx` based on strategy from 1.2.
  > **Details**: If redirecting, add `redirect()` to league pages pointing to `/predictions/[slug]`. If consolidating, merge content from predictions page into league hub.

- [ ] **1.4: Update navigation links to use canonical URLs**
  Task ID: phase-1-url-04
  > **Implementation**: Modify `src/components/league-selector.tsx` to link to correct URL.
  > **Details**: Change all `/leagues/${competition.id}` links to `/predictions/${competition.slug}` or maintain league pages with proper links.

- [ ] **1.5: Update sitemap and internal links**
  Task ID: phase-1-url-05
  > **Implementation**: Modify `src/app/sitemap.ts` to reflect canonical URLs.
  > **Details**: Ensure only one URL per match/league exists in sitemap to avoid SEO duplicate content issues.

---

## Phase 2: Blog Content Generation

**Goal**: Generate league roundup posts for the blog

### Issue Analysis
- `/blog` page exists but is empty
- No league roundup posts have been generated
- Script `npm run regenerate-content` exists but hasn't been run with proper configuration

---

- [ ] **2.1: Audit existing blog infrastructure**
  Task ID: phase-2-blog-01
  > **Implementation**: Read `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx`.
  > **Details**: Check if blog query functions exist in `src/lib/db/queries.ts`. Verify `blog_posts` table has data.

- [ ] **2.2: Run content regeneration script**
  Task ID: phase-2-blog-02
  > **Implementation**: Run `npm run regenerate-content` to generate league roundup posts.
  > **Details**: This script (`scripts/regenerate-post-match-content.ts`) should generate content for finished matches. Check output and verify blog_posts table has new entries.

- [ ] **2.3: Configure automatic content generation**
  Task ID: phase-2-blog-03
  > **Implementation**: Check if there's a cron job or queue for automatic content generation.
  > **Details**: Look in `src/app/api/cron/` for existing cron endpoints. Consider adding daily cron to generate roundups.

- [ ] **2.4: Improve blog landing page**
  Task ID: phase-2-blog-04
  > **Implementation**: Modify `src/app/blog/page.tsx` to display league roundups.
  > **Details**: Import `getPublishedBlogPosts` from queries, display cards with competition filter, add pagination.

---

## Phase 3: Navigation Restructure

**Goal**: Move "Matches" to footer, reorder navigation items

### Current Structure
```
Header: [Logo] [Search] [LeagueSelector] [Home] [Matches] [Leaderboard] [Blog]
Footer: [League links] [Quick links]
```

### Desired Structure
```
Header: [Logo] [Home] [LeagueSelector] [Leaderboard] [Blog]
Footer: [Matches] [Other footer links]
```

---

- [x] **3.1: Remove Matches from top navigation**
  Task ID: phase-3-nav-01
  > **Implementation**: Modify `src/components/navigation.tsx`, remove `{ href: '/matches', label: 'Matches', icon: Calendar }` from `navItems` array.
  > **Details**: Keep LeagueSelector in current position (after Search, before navItems).

- [x] **3.2: Create footer with Matches link**
  Task ID: phase-3-nav-02
  > **Implementation**: Create `src/components/footer.tsx`.
  > **Details**: 
  > - Import `Calendar` icon from lucide-react
  > - Add "Matches" link to footer section
  > - Include league links (existing in layout.tsx or create new section)
  > - Style consistent with site design

- [x] **3.3: Add Footer to layout**
  Task ID: phase-3-nav-03
  > **Implementation**: Modified `src/app/layout.tsx`, imported and rendered `<Footer />` component.
  > **Details**: Added `<Footer />` before closing `</body>` tag in the layout. Committed as `1a484b2`.

- [x] **3.4: Verify navigation order**
  Task ID: phase-3-nav-04
  > **Implementation**: Reviewed `src/components/navigation.tsx`.
  > **Details**: Verified order: Search → LeagueSelector → Home → Leaderboard → Blog. Matches task specification. Phase 3 complete.

---

## Phase 4: League Dropdown Improvement

**Goal**: Improve visual hierarchy, add icons, reduce cramped layout

### Current Issues
- 17 leagues grouped into 3 categories with just labels
- No visual distinction between categories
- Tight spacing between items
- No competition icons/logos

---

- [ ] **4.1: Design improved dropdown layout**
  Task ID: phase-4-dropdown-01
  > **Implementation**: Create mockup/design for improved LeagueSelector dropdown.
  > **Details**: Consider:
  > - Adding competition icons (trophy emoji or SVG)
  > - Better spacing between items
  > - Category headers with icons
  > - Search within dropdown for 17 items
  > - Two-column layout for domestic leagues (too many to list vertically)

- [ ] **4.2: Update LeagueSelector with improved UI**
  Task ID: phase-4-dropdown-02
  > **Implementation**: Modify `src/components/league-selector.tsx`.
  > **Details**: 
  > - Add icon support to each competition item
  > - Use `grid` layout within dropdown for better organization
  > - Increase padding for items
  > - Add hover states with competition-specific colors if possible

- [ ] **4.3: Add competition icons/colors**
  Task ID: phase-4-dropdown-03
  > **Implementation**: Add icon/color configuration to `src/lib/football/competitions.ts`.
  > **Details**: Extend `CompetitionConfig` interface:
  ```typescript
  interface CompetitionConfig {
    // ... existing fields
    icon?: string;  // icon name or emoji
    color?: string; // hex color for branding
  }
  ```

- [ ] **4.4: Implement two-column layout for domestic leagues**
  Task ID: phase-4-dropdown-04
  > **Implementation**: Modify `src/components/league-selector.tsx`, change Domestic Leagues section to use two-column grid.
  > **Details**: Since there are 7 domestic leagues, split into two columns for better visibility.

---

## Phase 5: Cross-Linking and UX Improvements

**Goal**: Ensure smooth navigation between related pages

---

- [ ] **5.1: Add "Back to Matches" link consistency**
  Task ID: phase-5-ux-01
  > **Implementation**: Audit all pages with "Back to Matches" links.
  > **Details**: Ensure link destination is `/matches` (not deprecated URL).

- [ ] **5.2: Add breadcrumb navigation to key pages**
  Task ID: phase-5-ux-02
  > **Implementation**: Create `src/components/breadcrumb.tsx` component.
  > **Details**: Add to `/predictions/[league]/[slug]`, `/leagues/[slug]` if kept, `/blog/[slug]`.

- [ ] **5.3: Add competition filter to Matches page**
  Task ID: phase-5-ux-03
  > **Implementation**: Verify `src/components/competition-filter.tsx` is working on `/matches` page.
  > **Details**: Check if filtering by competition works and displays correct matches.

- [ ] **5.4: Add QuickLeagueLinks to Matches page header**
  Task ID: phase-5-ux-04
  > **Implementation**: Verify `src/components/quick-league-links.tsx` is displayed on `/matches`.
  > **Details**: Ensure users can quickly jump to specific league matches.

---

## Phase 6: SEO and Performance

**Goal**: Fix crawl issues and improve page load

---

- [ ] **6.1: Remove duplicate indexable pages**
  Task ID: phase-6-seo-01
  > **Implementation**: Add `robots.txt` or meta robots to prevent indexing of duplicate pages.
  > **Details**: If keeping both `/leagues/` and `/predictions/`, noindex the duplicate.

- [ ] **6.2: Add canonical URLs to all pages**
  Task ID: phase-6-seo-02
  > **Implementation**: Verify all pages have proper `canonical` metadata.
  > **Details**: Check `/leagues/[slug]/page.tsx` and `/predictions/[league]/[slug]/page.tsx`.

- [ ] **6.3: Optimize static generation**
  Task ID: phase-6-perf-01
  > **Implementation**: Review `generateStaticParams` in league and predictions pages.
  > **Details**: Ensure only necessary pages are pre-rendered. Consider making some pages dynamic if they change frequently.

---

## Priority Order

1. **Phase 3 (Navigation Restructure)** - Quick wins, visible improvement
2. **Phase 4 (Dropdown Improvement)** - Major UX enhancement
3. **Phase 2 (Blog Content)** - Fill empty blog
4. **Phase 1 (URL Consolidation)** - Strategic decision first
5. **Phase 5 (Cross-linking)** - After consolidation
6. **Phase 6 (SEO)** - Final polish

---

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `src/components/navigation.tsx` | 3 | Remove Matches from navItems |
| `src/components/footer.tsx` | 3 | Create new component |
| `src/app/layout.tsx` | 3 | Add Footer import and render |
| `src/components/league-selector.tsx` | 4 | Improve dropdown UI, add icons |
| `src/lib/football/competitions.ts` | 4 | Add icon/color to config |
| `src/app/leagues/[slug]/page.tsx` | 1/5 | Redirect or consolidate |
| `src/app/sitemap.ts` | 1/5 | Update URLs |
| `src/app/blog/page.tsx` | 2 | Display roundup posts |

---

*Generated by Clavix /clavix-plan*
