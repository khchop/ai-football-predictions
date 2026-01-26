# Implementation Plan

**Project**: internal-navigation-improvement
**Generated**: 2026-01-26T12:00:00.000Z

## Technical Context & Standards
*Detected Stack & Patterns*
- **Architecture**: Next.js 16.1.4 App Router, Monolith
- **Framework**: React 19.2.3 with TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State**: Server Components by default, use client for interactive components
- **API**: Server Actions + Drizzle ORM queries
- **Conventions**:
  - Components: PascalCase in `src/components/`
  - Client components: `'use client'` directive at top
  - Imports: Use `@/*` alias (maps to `./src/*`)
  - Styling: `cn()` utility from `@/lib/utils` for conditional classes
  - Icons: `lucide-react`
  - shadcn/ui: Components in `src/components/ui/`
  - Routes: App Router in `src/app/`

---

## Phase 1: Install Required shadcn/ui Components

- [x] **Install Dropdown Menu and Dialog components**
  Task ID: phase-1-setup-01
  > **Implementation**: Run `npx shadcn@latest add dropdown-menu dialog` to install required components.
  > **Details**: These are needed for the league selector dropdown and search modal on mobile. The project already has select, tabs, and card components.

- [x] **Install Sheet component for mobile navigation**
  Task ID: phase-1-setup-02
  > **Implementation**: Run `npx shadcn@latest add sheet` to install the sheet (slide-out panel) component.
  > **Details**: Used for mobile navigation expansion and search modal on mobile devices.

---

## Phase 2: Add Blog Link to Main Navigation

- [x] **Add Blog link to Navigation component**
  Task ID: phase-2-nav-blog-01
  > **Implementation**: Modify `src/components/navigation.tsx`. Add `{ href: '/blog', label: 'Blog', icon: FileText }` to the `navItems` array.
  > **Details**: Import `FileText` from `lucide-react`. The icon should be sized `h-4 w-4` matching existing icons. The link should have the same styling and active state detection as other nav items.

- [x] **Verify navigation is mobile responsive**
  Task ID: phase-2-nav-blog-02
  > **Implementation**: Review `src/components/navigation.tsx` to ensure blog link is visible on mobile.
  > **Details**: The existing navigation hides labels on small screens (`hidden sm:inline`). Ensure the Blog link follows the same pattern with an icon-only version on mobile.

---

## Phase 3: Create League Selector Component

- [x] **Create LeagueSelector component**
  Task ID: phase-3-league-selector-01
  > **Implementation**: Create `src/components/league-selector.tsx` as a client component.
  > **Details**:
  > - Import `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel` from `@/components/ui/dropdown-menu`
  > - Import `ChevronDown` from `lucide-react`
  > - Import `COMPETITIONS` from `@/lib/football/competitions.ts`
  > - Group competitions by `category` (club-europe, club-domestic, international)
  > - Use `DropdownMenu` to show categories and leagues
  > - Each league item should link to `/leagues/[slug]` where slug is the competition id
  > - Add keyboard navigation support

- [x] **Add LeagueSelector to Navigation**
  Task ID: phase-3-league-selector-02
  > **Implementation**: Modify `src/components/navigation.tsx` to include the LeagueSelector component.
  > **Details**: Add LeagueSelector after the existing nav items but before any action buttons. Ensure it has consistent styling with the nav bar. On mobile, consider showing as a select dropdown instead.

- [x] **Create competition logo component**
  Task ID: phase-3-league-selector-03
  > **Implementation**: Create `src/components/competition-badge.tsx` for displaying competition logos/names.
  > **Details**: Create a reusable component that shows competition name with an optional icon. Use consistent styling with other badges in the project (e.g., existing content-type badges in blog).

---

## Phase 4: Create League Hub Pages

- [x] **Create League Hub page route**
  Task ID: phase-4-league-hub-01
  > **Implementation**: Create `src/app/leagues/[slug]/page.tsx`.
  > **Details**:
  > - Use `params: Promise<{ slug: string }>` pattern (Next.js 16 async params)
  > - Import `notFound` from `next/navigation` for invalid competition slugs
  > - Get competition data from `getCompetitionById()` in `@/lib/football/competitions.ts`
  > - Display league name, season, and category
  > - Return proper metadata for SEO

- [x] **Create LeagueHubContent component**
  Task ID: phase-4-league-hub-02
  > **Implementation**: Create `src/app/leagues/[slug]/league-hub-content.tsx` as a Server Component.
  > **Details**:
  > - Import `getMatchesByCompetitionSlug` from `@/lib/db/queries`
  > - Import `getPublishedBlogPosts` for the competition
  > - Import `LeagueStanding` type from schema
  > - Display upcoming and recent matches for the competition
  > - Show league standings table
  > - Display related blog posts with `competitionId` filter

- [x] **Add league hub to sitemap**
  Task ID: phase-4-league-hub-03
  > **Implementation**: Modify `src/app/sitemap.ts` to include league hub pages.
  > **Details**: Add entries for each active competition in the sitemap. Use the `slug` field from competitions table.

- [x] **Create LeagueCard component**
  Task ID: phase-4-league-hub-04
  > **Implementation**: Create `src/components/league-card.tsx`.
  > **Details**:
  > - Card component for displaying league information
  > - Show league name, logo placeholder, and match count
  > - Link to `/leagues/[slug]`
  > - Use existing card styling patterns from `src/components/ui/card.tsx`

- [x] **Create CompetitionFilter component**
  Task ID: phase-5-competition-filter-01
  > **Implementation**: Create `src/components/competition-filter.tsx` as a client component.
  > **Details**:
  > - Use `Select` component from `@/components/ui/select`
  > - Allow single competition selection initially (can add multi-select later)
  > - Default to "All Competitions"
  > - Update URL search params when selection changes
  > - Mobile-friendly: use full-width select on small screens

- [x] **Modify Matches page to use filter**
  Task ID: phase-5-competition-filter-02
  > **Implementation**: Modify `src/app/matches/page.tsx` to support competition filtering.
  > **Details**:
  > - Import and use `CompetitionFilter` component
  > - Parse `competition` search param in the page component
  > - Pass competition filter to `getUpcomingMatches`, `getFinishedMatches`, etc.
  > - Add filter UI above the tabs section
  > - Show active filter indicator when a competition is selected

- [ ] **Update match queries to support competition filter**
  Task ID: phase-5-competition-filter-03
  > **Implementation**: Modify `src/lib/db/queries.ts` if needed.
  > **Details**:
  > - Ensure `getUpcomingMatches`, `getFinishedMatches`, `getLiveMatches` support optional `competitionId` parameter
  > - Add index on competitionId if not exists (check schema has `idx_matches_competition_id`)

---

## Phase 6: Quick League Links Section

- [ ] **Create QuickLeagueLinks component**
  Task ID: phase-6-quick-links-01
  > **Implementation**: Create `src/components/quick-league-links.tsx`.
  > **Details**:
  > - Display all 17 competitions as clickable cards
  > - Use competition logos/icons with names
  > - Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
  > - Link to `/leagues/[slug]` for each competition
  > - Use `LeagueCard` component created in Phase 4

- [x] **Add QuickLeagueLinks to Matches page**
  Task ID: phase-6-quick-links-02
  > **Implementation**: Modify `src/app/matches/page.tsx` to include QuickLeagueLinks section.
  > **Details**: Add the quick links section before the tabs, below the header. Make it collapsible or always visible depending on design preference.

- [x] **Add QuickLeagueLinks to Home page**
  Task ID: phase-6-quick-links-03
  > **Implementation**: Modify `src/app/page.tsx` to include QuickLeagueLinks.
  > **Details**: Find appropriate location (after featured matches or in a dedicated section). Ensure it doesn't clutter the home page.

- [x] **Create SearchModal component**
  Task ID: phase-7-search-01
  > **Implementation**: Create `src/components/search-modal.tsx` as a client component.
  > **Details**:
  > - Use `Dialog` component from `@/components/ui/dialog`
  > - Add search input field
  > - Show results as user types (debounced)
  > - Search categories: Leagues, Teams, Blog Posts
  > - Keyboard shortcut: Cmd+K or Ctrl+K to open
  > - Mobile: Use Sheet instead of Dialog for better UX

- [x] **Create search utility functions**
  Task ID: phase-7-search-02
  > **Implementation**: Create `src/lib/search.ts`.
  > **Details**:
  > - Create `searchCompetitions(query: string)` function
  > - Create `searchTeams(query: string)` function
  > - Create `searchBlogPosts(query: string)` function
  > - Debounce search input (300ms)
  > - Return results with type and URL

- [x] **Add Search trigger to Navigation**
  Task ID: phase-7-search-03
  > **Implementation**: Modify `src/components/navigation.tsx` to add search button.
  > **Details**: Add a search icon button in the nav bar that triggers the SearchModal. Position it appropriately (right side of nav). Use `Search` icon from `lucide-react`.

- [x] **Add search to keyboard events**
  Task ID: phase-7-search-04
  > **Implementation**: Modify `src/components/search-modal.tsx` to listen for keyboard shortcuts.
  > **Details**: Add `useEffect` that listens for `keydown` events. Open modal on Cmd+K/Ctrl+K. Close on Escape. Focus search input when opened.

- [x] **Add league links to footer**
  Task ID: phase-8-footer-01
  > **Implementation**: Modify `src/app/layout.tsx` to add footer with league links.
  > **Details**:
  > - Check if footer already exists in layout
  > - Create footer with "Leagues" section listing all 17 competitions
  > - Add "Blog" link to footer
  > - Keep footer simple and consistent with site design
  > - Mobile: Stack links vertically

---

*Generated by Clavix /clavix-plan*
