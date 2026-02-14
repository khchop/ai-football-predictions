---
phase: quick-055
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/queries/team-stats.ts
  - src/components/team/team-hero.tsx
  - src/components/team/team-stats-overview.tsx
  - src/app/teams/[slug]/page.tsx
autonomous: true
must_haves:
  truths:
    - "Team page displays the team logo prominently in a hero section"
    - "Team page shows AI-generated description text near the top"
    - "Stats are compact in a single card with dense grid layout, not 11 separate cards"
    - "Page has less vertical spacing and feels professional/dense"
    - "Form guide is integrated into the hero area"
  artifacts:
    - path: "src/lib/db/queries/team-stats.ts"
      provides: "getTeamLogo query function"
      exports: ["getTeamLogo"]
    - path: "src/components/team/team-hero.tsx"
      provides: "Team hero component with logo, name, league, description, form"
      exports: ["TeamHero"]
    - path: "src/components/team/team-stats-overview.tsx"
      provides: "Compact single-card stats grid"
      exports: ["TeamStatsOverview"]
    - path: "src/app/teams/[slug]/page.tsx"
      provides: "Redesigned page layout with hero and compact sections"
  key_links:
    - from: "src/app/teams/[slug]/page.tsx"
      to: "src/components/team/team-hero.tsx"
      via: "TeamHero component import"
      pattern: "import.*TeamHero"
    - from: "src/components/team/team-hero.tsx"
      to: "next/image"
      via: "Image component for team logo"
      pattern: "Image.*src=.*logo"
    - from: "src/app/teams/[slug]/page.tsx"
      to: "src/lib/db/queries/team-stats.ts"
      via: "getTeamLogo query call"
      pattern: "getTeamLogo"
---

<objective>
Redesign the team page with a professional hero section (team logo, name, league, AI description, form guide) and compact stats layout (single card with dense grid instead of 11 individual cards).

Purpose: The current team page has oversized stat boxes, no team logo, and the AI analysis buried at section 6. This redesign brings key identity and context to the top and makes stats scannable.
Output: New TeamHero component, redesigned TeamStatsOverview, updated page layout.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/teams/[slug]/page.tsx
@src/components/team/team-stats-overview.tsx
@src/components/match/match-hero.tsx
@src/lib/db/queries/team-stats.ts
@src/lib/db/queries/team-content.ts
@src/lib/football/teams.ts
@src/components/team/team-form-indicator.tsx
@src/components/ui/card.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add getTeamLogo query and create TeamHero component</name>
  <files>src/lib/db/queries/team-stats.ts, src/components/team/team-hero.tsx</files>
  <action>
**1. Add `getTeamLogo` to `src/lib/db/queries/team-stats.ts`:**

Add a new exported async function `getTeamLogo(teamName: string): Promise<string | null>` that:
- Queries the `matches` table for the most recent match (by `kickoffTime` DESC) where `homeTeam = teamName` OR `awayTeam = teamName`
- Selects `homeTeam`, `awayTeam`, `homeTeamLogo`, `awayTeamLogo`
- Returns the logo URL for the matching team side (if `homeTeam === teamName`, return `homeTeamLogo`, else `awayTeamLogo`)
- Returns `null` if no match found or logo is null
- Use `limit(1)` and `desc(matches.kickoffTime)` ordering
- Import `desc` (already imported), `eq`, `or` (already imported) from drizzle-orm

**2. Create `src/components/team/team-hero.tsx`:**

Server component (no 'use client'). Props interface:

```typescript
interface TeamHeroProps {
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  leagueName: string;
  leagueId: string;
  totalMatches: number;
  record: { wins: number; draws: number; losses: number };
  winRate: number;
  goalDifference: number;
  description: string | null;  // from teamContentData.analysis
  formGuide: ('W' | 'D' | 'L')[];
}
```

Layout inspired by MatchHero's design language but adapted for a single team:

- Outer wrapper: `<section className="bg-card border-border border rounded-xl p-6 md:p-8">` (matches MatchHero style)
- Top area is a flex row with 3 parts:
  - **Left: Logo** - `<div className="shrink-0">` containing a `<div className="h-20 w-20 md:h-24 md:w-24 rounded-xl bg-muted/50 flex items-center justify-center">`. Inside: if `logoUrl`, render `<Image src={logoUrl} alt={teamName + " logo"} width={96} height={96} className="object-contain" priority />` (import from `next/image`). Else, render first character as fallback: `<span className="text-3xl font-bold text-muted-foreground">{teamName.charAt(0)}</span>`.
  - **Center: Team info** - `<div className="flex-1 min-w-0 ml-5 md:ml-6">` containing:
    - `<h1 className="text-2xl md:text-3xl font-bold">{teamName}</h1>`
    - League link: `<p className="text-muted-foreground mt-1">` with `<Link href={"/leagues/" + leagueId} className="hover:text-primary transition-colors hover:underline">{leagueName}</Link>` and ` -- {totalMatches} matches tracked`
    - Key stats row: `<div className="flex items-center gap-4 mt-3 text-sm">` containing:
      - Record: `<span className="font-medium">{wins}W {draws}D {losses}L</span>`
      - Win rate: `<span className="text-muted-foreground">{winRate}%</span>`
      - Goal diff with color: `<span className={cn("font-medium", goalDifference > 0 && "text-green-400", goalDifference < 0 && "text-red-400")}>{goalDifference > 0 ? "+" : ""}{goalDifference}</span>`
    - Form guide row: `<div className="flex items-center gap-2 mt-3">` with inline form badges (reuse the same styling from TeamFormIndicator -- W/D/L colored boxes, `h-7 w-7 rounded-md flex items-center justify-center font-semibold text-xs border` with the same green/yellow/red color classes). Render these inline, do NOT import the client component.
  - **Right: (empty/reserved)** - No right column needed; the left-aligned layout is cleaner for a single team.

- If `description` is not null, add a separator and description below: `<div className="mt-5 pt-5 border-t border-border/50">` containing `<p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{description}</p>`. Use `line-clamp-3` to limit to 3 lines. Only show the FIRST paragraph of the analysis (split by `\n\n` and take index 0).

Import `cn` from `@/lib/utils`, `Link` from `next/link`, `Image` from `next/image`.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | head -30` to verify no type errors in the new files. Check that `getTeamLogo` and `TeamHero` are properly exported.
  </verify>
  <done>
`getTeamLogo` function exists in team-stats.ts and returns a logo URL from the most recent match. `TeamHero` component renders logo, team name, league link, key stats, form guide, and optional description in a rounded card layout.
  </done>
</task>

<task type="auto">
  <name>Task 2: Redesign TeamStatsOverview to compact single-card layout</name>
  <files>src/components/team/team-stats-overview.tsx</files>
  <action>
Replace the entire `TeamStatsOverview` component with a compact single-card design.

**New design:** One `<Card>` wrapping all stats in a dense grid, instead of 11 separate cards.

Structure:
```
<Card className="bg-card/50 border-border/50">
  <CardContent className="p-4 md:p-6">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
      {/* Each stat is a simple div, NOT a card */}
      <StatItem />
      <StatItem />
      ...
    </div>
  </CardContent>
</Card>
```

Create a local `StatItem` component (not exported) inside the file:

```typescript
function StatItem({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div>
      <div className={cn("text-lg font-bold tabular-nums", className)}>{value}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
```

Stats to render in this order (8 items, not 11 -- remove totalMatches, avgGoalsScored, avgGoalsConceded since winRate + record + goals already cover these):

1. Record (W-D-L): value=`{wins}-{draws}-{losses}`, label="Record (W-D-L)"
2. Win Rate: value=`{winRate}%`, label="Win Rate"
3. Goals Scored: value=`{goalsScored}`, label="Goals Scored"
4. Goals Conceded: value=`{goalsConceded}`, label="Goals Conceded"
5. Goal Difference: value=`{goalDifference > 0 ? "+" : ""}{goalDifference}`, label="Goal Diff", className with green/red coloring based on positive/negative
6. Clean Sheets: value=`{cleanSheets}`, label="Clean Sheets"
7. Home Record: value=`{homeWins}-{homeDraws}-{homeLosses}`, label="Home (W-D-L)"
8. Away Record: value=`{awayWins}-{awayDraws}-{awayLosses}`, label="Away (W-D-L)"

Keep existing imports: `Card`, `CardContent` from ui/card, `cn` from lib/utils, `TeamStats` type.
Calculate `winRate` the same way as before: `Math.round((stats.wins / stats.totalMatches) * 100)` with 0 fallback.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | head -30` to verify no type errors. The component should still accept `TeamStatsOverviewProps` with `stats: TeamStats`.
  </verify>
  <done>
TeamStatsOverview renders 8 stats in a single Card with a dense 4-column grid. No more 11 separate Card components. Each stat is ~40px tall instead of ~120px.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update page.tsx layout with new hero, reorder sections, reduce spacing</name>
  <files>src/app/teams/[slug]/page.tsx</files>
  <action>
**1. Add imports:**
- Add `import { getTeamLogo } from '@/lib/db/queries/team-stats';` (add `getTeamLogo` to existing import from team-stats)
- Add `import { TeamHero } from '@/components/team/team-hero';`
- Remove `import { TeamFormIndicator } from '@/components/team/team-form-indicator';` (form is now in hero)

**2. Update data fetching:**
In the `Promise.all` array (line 127), add `getTeamLogo(team.id)` as the 8th item. Destructure as `teamLogo`:
```typescript
const [stats, formGuide, leaderboard, upcomingMatches, recentWithAccuracy, accuracyTrend, teamContentData, teamLogo] = await Promise.all([
  ...existing calls...,
  getTeamLogo(team.id),
]);
```

**3. Compute winRate for hero:**
After the Promise.all, add:
```typescript
const winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
```

**4. Replace the entire JSX layout (lines 167-262):**

Change `<div className="space-y-8">` to `<div className="space-y-6">` (reduce from 32px to 24px gaps).

Replace the old header section (lines 177-191) and form section (lines 201-204) with the new TeamHero:

```tsx
{/* Hero section with logo, name, league, description, form */}
<TeamHero
  teamName={team.id}
  teamSlug={team.slug}
  logoUrl={teamLogo}
  leagueName={competition?.name ?? team.league}
  leagueId={competition?.id ?? team.league}
  totalMatches={stats.totalMatches}
  record={{ wins: stats.wins, draws: stats.draws, losses: stats.losses }}
  winRate={winRate}
  goalDifference={stats.goalDifference}
  description={teamContentData?.analysis ?? null}
  formGuide={formGuide}
/>
```

Then the sections in this order (removing the old standalone Form section and AI Analysis section since both are now in the hero):

1. **Stats overview** - Keep as `<section>` but remove the `<h2>` header (the card is self-explanatory):
```tsx
<section>
  <TeamStatsOverview stats={stats} />
</section>
```

2. **Model Leaderboard** - Keep exactly as is (lines 207-213)

3. **Model Accuracy Trend** - Keep exactly as is (lines 216-219)

4. **Upcoming Matches** - Keep exactly as is (lines 235-239) but remove the standalone h2, instead put h2 inside:
```tsx
<section>
  <h2 className="text-xl font-semibold mb-3">Upcoming Matches</h2>
  <TeamUpcomingMatches matches={upcomingMatches} teamName={team.id} />
</section>
```

5. **Recent Matches** - Same pattern:
```tsx
<section>
  <h2 className="text-xl font-semibold mb-3">Recent Matches</h2>
  <TeamRecentMatches matches={recentWithAccuracy} teamName={team.id} />
</section>
```

6. **FAQ section** - Keep exactly as is (lines 248-260)

**5. Remove the standalone AI Analysis section** (lines 221-233). The first paragraph of analysis is now in the hero. The full analysis was always too long anyway -- a 3-line teaser in the hero is better UX.

**6. Reduce section heading margins** from `mb-4` to `mb-3` across all remaining `<h2>` elements.

Key: Do NOT remove the AI Analysis section's full content permanently -- if the user wants it back later, the data is still fetched. For now, the hero's line-clamped first paragraph is the only display.
  </action>
  <verify>
Run `npx tsc --noEmit 2>&1 | head -30` to verify no type errors. Then run `npm run build 2>&1 | tail -20` to confirm production build succeeds. Verify the page renders by checking the build output includes `teams/[slug]` route.
  </verify>
  <done>
Team page renders with: (1) hero card showing logo, team name, league link, key stats, form badges, and description teaser; (2) compact single-card stats grid below; (3) remaining sections with tighter spacing. No standalone form section or AI analysis section -- both integrated into hero.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully (use `--webpack` fallback if turbopack SWC fails locally)
- Team page at `/teams/arsenal` (or any team) shows: logo in hero, description teaser, compact stats card
- No unused imports remain (TeamFormIndicator removed from page.tsx)
</verification>

<success_criteria>
- Team logo displays in hero section from most recent match data
- AI description first paragraph visible near top of page (line-clamped to 3 lines)
- Stats section is a single card with 8 items in a 4-column grid (not 11 separate cards)
- Page spacing reduced from space-y-8 to space-y-6
- Form guide W/D/L badges display inline in hero area
- Production build passes
</success_criteria>

<output>
After completion, create `.planning/quick/55-redesign-team-page-layout-compact-stats-/055-SUMMARY.md`
</output>
