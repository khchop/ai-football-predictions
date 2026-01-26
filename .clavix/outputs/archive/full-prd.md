# Product Requirements Document: Internal Navigation Improvement

## Problem & Goal

Users cannot easily navigate to different football leagues or access the blog content on the BettingSoccer platform. The current navigation only includes Home, Matches, and Leaderboard, leaving users unable to discover the 17 tracked competitions (Champions League, Premier League, La Liga, etc.) or find the existing blog at `/blog`. The goal is to create intuitive, mobile-friendly navigation that allows users to quickly access league-specific content and the blog.

## Requirements

### Must-Have Features

1. **Blog Link in Main Navigation**
   - Add "Blog" link to the existing top navigation bar in `src/components/navigation.tsx`
   - Ensure consistent styling with existing nav items
   - Mobile-responsive (hamburger menu or collapsible)

2. **League/Competition Selector**
   - Create a dropdown or selector component for quick league access
   - Display all 17 tracked competitions organized by category (European, Domestic, International)
   - Include competition logos/names and link to league hub pages
   - Accessible from navigation or prominent placement on matches page

3. **League Hub Pages**
   - Create dedicated pages for each competition at `/leagues/[slug]` (e.g., `/leagues/premier-league`)
   - Display league-specific matches, standings, and recent blog posts
   - Include league metadata (name, season, category)
   - Filter matches by competition on league hub

4. **Competition Filter on Matches Page**
   - Add filter controls to `/matches` page to show only specific competitions
   - Filter by single league or multiple leagues
   - Default to showing all leagues
   - Mobile-friendly filter interface (dropdown or chips)

5. **Quick League Links**
   - Add league quick-links section to matches page or footer
   - Allow users to jump directly to specific competitions
   - Use competition logos for visual recognition
   - Responsive grid layout

6. **Search Functionality**
   - Global search for leagues, teams, and blog posts
   - Search bar accessible from navigation
   - Keyboard shortcuts for quick access
   - Mobile-friendly search interface

### Technical Requirements

- Next.js 16 App Router
- shadcn/ui components (DropdownMenu, Select, Dialog/Sheet for mobile)
- Tailwind CSS for styling
- Mobile-first responsive design
- TypeScript
- Follow existing code patterns in `src/components/navigation.tsx`

### Architecture & Design

- Reuse existing `Navigation` component patterns
- Create new components in `src/components/`:
  - `league-selector.tsx` - Dropdown for competition selection
  - `competition-filter.tsx` - Filter controls for matches page
  - `league-card.tsx` - Card component for league hub pages
- Use existing competition data from `src/lib/football/competitions.ts`
- Add routes: `src/app/leagues/[slug]/page.tsx`

## Out of Scope

- User accounts/profile pages
- Dark mode toggle implementation
- Social sharing features
- Email notifications
- User preferences storage

## Additional Context

- Mobile-friendly is critical requirement
- Platform already tracks 17 competitions
- Blog exists at `/blog` with full functionality
- Existing navigation uses shadcn/ui patterns
- Current design uses gradient accents and card-based layouts

---

*Generated with Clavix Planning Mode*
*Generated: 2026-01-26T00:00:00.000Z*
