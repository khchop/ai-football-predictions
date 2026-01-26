# Internal Navigation Improvement - Quick PRD

**Goal:** Improve internal navigation on the BettingSoccer platform so users can easily access the 17 tracked football leagues/competitions and the existing blog at `/blog`. Currently, users cannot discover leagues or find blog content due to limited navigation (only Home, Matches, Leaderboard). The solution requires adding a Blog link to main navigation, creating a league/competition selector, building dedicated league hub pages at `/leagues/[slug]`, adding competition filters to the matches page, and implementing a search functionality for leagues, teams, and blog posts. All features must be mobile-friendly using Next.js 16, shadcn/ui, and Tailwind CSS.

**Core Features:** Add Blog to top navigation; create league selector dropdown showing 17 competitions organized by category (European, Domestic, International); build league hub pages with league-specific matches, standings, and blog posts; add competition filter controls to `/matches` page with single/multi-league selection; implement quick league links section with logos; and add global search accessible from navigation. Technical approach: reuse existing `Navigation` component patterns, create new components (`league-selector.tsx`, `competition-filter.tsx`, `league-card.tsx`), use competition data from `src/lib/football/competitions.ts`, and add route `src/app/leagues/[slug]/page.tsx`.

**Scope Boundaries:** User accounts/profile pages, dark mode toggle, social sharing features, and email notifications are explicitly out of scope. Mobile-first responsive design is required. The blog already exists at `/blog` with full functionality and just needs navigation linking.

---

*Generated with Clavix Planning Mode*
*Generated: 2026-01-26T00:00:00.000Z*
