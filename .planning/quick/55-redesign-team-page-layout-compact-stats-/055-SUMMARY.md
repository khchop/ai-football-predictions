---
phase: quick-055
plan: 01
subsystem: team-pages
tags: [ui, redesign, compact-layout, team-hero]
dependency_graph:
  requires: []
  provides:
    - team-hero-component
    - compact-team-stats-grid
    - team-logo-query
  affects:
    - team-page-layout
    - team-stats-overview
tech_stack:
  added: []
  patterns:
    - hero-section-design
    - single-card-stats-grid
    - logo-from-recent-match
key_files:
  created:
    - src/components/team/team-hero.tsx
  modified:
    - src/lib/db/queries/team-stats.ts
    - src/components/team/team-stats-overview.tsx
    - src/app/teams/[slug]/page.tsx
decisions:
  - "Team logo sourced from most recent match data (homeTeamLogo/awayTeamLogo)"
  - "Stats reduced from 11 separate cards to 8 items in a single dense grid"
  - "AI description first paragraph displayed as 3-line teaser in hero (full analysis removed from page)"
  - "Form guide integrated into hero instead of standalone section"
  - "Page spacing reduced from space-y-8 (32px) to space-y-6 (24px)"
metrics:
  duration: 187
  completed_at: "2026-02-14T20:57:19Z"
---

# Quick Task 055: Redesign Team Page Layout (Compact Stats, Hero Section)

**One-liner:** Team pages now feature a professional hero section with logo, key stats, and form guide, plus a compact single-card stats grid replacing 11 separate boxes.

## Objective

Redesign the team page with:
1. Professional hero section displaying team logo, name, league, AI description teaser, and form guide
2. Compact stats layout with single card containing dense 4-column grid instead of 11 individual cards
3. Tighter spacing throughout the page for a more professional, scannable experience

**Purpose:** The original team page had oversized stat boxes, no team logo, and AI analysis buried at section 6. This redesign brings key identity and context to the top and makes stats more scannable.

## Tasks Completed

### Task 1: Add getTeamLogo query and create TeamHero component
**Files:** `src/lib/db/queries/team-stats.ts`, `src/components/team/team-hero.tsx`

- Added `getTeamLogo(teamName: string)` query function that fetches the team's logo from the most recent match (either homeTeamLogo or awayTeamLogo depending on which side the team was on)
- Created `TeamHero` server component with props for team name, logo, league, stats, form guide, and description
- Hero layout inspired by `MatchHero` design language: rounded card (border-border border rounded-xl) with structured sections
- Left section: Logo in 96x96 rounded container with fallback to first character
- Center section: Team name (h1), league link, key stats row (W-D-L, win rate, goal diff with coloring), and inline form badges (W/D/L colored boxes)
- Bottom section: AI description first paragraph with `line-clamp-3` for 3-line teaser
- Form badges inline (same styling as TeamFormIndicator but NOT imported to avoid client component)

**Commit:** `63ddb2d`

### Task 2: Redesign TeamStatsOverview to compact single-card layout
**Files:** `src/components/team/team-stats-overview.tsx`

- Replaced 11 separate Card components (3 rows: 4+4+3 layout) with ONE Card containing a dense grid
- Created local `StatItem` component for consistent stat display (value + label)
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` with `gap-x-6 gap-y-4`
- Reduced from 11 stats to 8: removed `totalMatches`, `avgGoalsScored`, `avgGoalsConceded` (redundant with record/goals/win rate)
- Stats in order: Record (W-D-L), Win Rate, Goals Scored, Goals Conceded, Goal Diff (with color), Clean Sheets, Home (W-D-L), Away (W-D-L)
- Each stat item: `text-lg font-bold` value + `text-xs text-muted-foreground` label
- Vertical height reduced from ~360px (11 cards × ~120px + gaps) to ~120px (2 rows × ~40px + padding)

**Commit:** `3036eeb`

### Task 3: Update page.tsx layout with hero and compact sections
**Files:** `src/app/teams/[slug]/page.tsx`

- Added `getTeamLogo` to import from `team-stats.ts`
- Added `TeamHero` import, removed `TeamFormIndicator` import
- Updated Promise.all to fetch `teamLogo` as 8th item
- Computed `winRate` for hero props
- Replaced entire JSX layout:
  - Changed outer `space-y-8` to `space-y-6` (32px → 24px gaps)
  - Replaced old header section + form section with `<TeamHero />` component
  - Removed "Statistics" h2 header (stats card is self-explanatory)
  - Removed standalone AI Analysis section (first paragraph now in hero as teaser)
  - Changed all section h2 margins from `mb-4` to `mb-3`
  - Reordered sections: Hero → Stats → Leaderboard → Accuracy Trend → Upcoming Matches → Recent Matches → FAQ
- TeamHero receives: team name, slug, logo, league name/id, total matches, record, win rate, goal diff, description (analysis), form guide

**Commit:** `bc60fb7`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compilation: ✅ PASSED (no errors in modified files)
- Production build: ✅ PASSED with webpack fallback (`npx next build --webpack`)
- Route generated: ✅ `/teams/[slug]` present in build output with Partial Prerender mode
- Team logo query: ✅ Fetches from most recent match, returns null if no matches
- TeamHero component: ✅ Renders logo, team name, league link, key stats, form badges, description teaser
- TeamStatsOverview: ✅ Single card with 8 stats in 4-column responsive grid
- Page spacing: ✅ Reduced from 32px to 24px between sections

## Impact

**Before:**
- No team logo displayed
- 11 separate stat cards in 3 rows (~360px vertical height)
- AI analysis buried at section 6 below charts
- Form guide in separate section
- 32px gaps between sections

**After:**
- Team logo prominently displayed in hero (96x96)
- 8 stats in single compact card (~120px vertical height)
- AI description teaser visible at top of page (first paragraph, 3 lines)
- Form guide integrated into hero
- 24px gaps between sections
- Professional, scannable layout matching MatchHero design language

**UX improvements:**
- Immediately see team identity (logo + name + league)
- Key context visible above fold (stats + form + description teaser)
- ~240px vertical space saved on stats section
- ~100px saved on removed sections (standalone Form, AI Analysis)
- Faster scanning with denser information architecture

## Self-Check

```bash
# Check created files exist
[ -f "src/components/team/team-hero.tsx" ] && echo "FOUND: src/components/team/team-hero.tsx" || echo "MISSING: src/components/team/team-hero.tsx"

# Check commits exist
git log --oneline --all | grep -q "63ddb2d" && echo "FOUND: 63ddb2d" || echo "MISSING: 63ddb2d"
git log --oneline --all | grep -q "3036eeb" && echo "FOUND: 3036eeb" || echo "MISSING: 3036eeb"
git log --oneline --all | grep -q "bc60fb7" && echo "FOUND: bc60fb7" || echo "MISSING: bc60fb7"
```

**Result:**
```
FOUND: src/components/team/team-hero.tsx
FOUND: 63ddb2d
FOUND: 3036eeb
FOUND: bc60fb7
```

## Self-Check: PASSED

---

*Duration: 187 seconds (~3 minutes)*
*Completed: 2026-02-14 20:57:19 UTC*
