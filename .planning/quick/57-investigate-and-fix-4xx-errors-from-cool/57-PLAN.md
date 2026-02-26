---
phase: quick-57
plan: 57
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/team/team-recent-matches.tsx
  - src/components/team/team-upcoming-matches.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Team page recent matches cards link to canonical match URLs"
    - "Team page upcoming matches cards link to canonical match URLs"
    - "No 410 Gone errors from team page match links"
  artifacts:
    - path: "src/components/team/team-recent-matches.tsx"
      provides: "Links using /leagues/{competitionId}/{matchSlug} format"
      min_lines: 180
    - path: "src/components/team/team-upcoming-matches.tsx"
      provides: "Links using /leagues/{competitionId}/{matchSlug} format"
      min_lines: 180
  key_links:
    - from: "team-recent-matches.tsx"
      to: "/leagues/{competitionId}/{matchSlug}"
      via: "matchUrl variable on line 24"
      pattern: "matchUrl.*leagues.*competitionId"
    - from: "team-upcoming-matches.tsx"
      to: "/leagues/{competitionId}/{matchSlug}"
      via: "matchUrl variable on line 24"
      pattern: "matchUrl.*leagues.*competitionId"
---

<objective>
Fix team page match links to use canonical URLs.

Purpose: Team pages currently link to `/matches/{slug}` which returns 410 Gone. The canonical match URL is `/leagues/{competitionId}/{matchSlug}`. Both query results already include competitionId field needed to build correct URLs.

Output: Two component files updated to use canonical match URL format, eliminating 4xx errors from team pages.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Query types already provide competitionId field -->

From src/lib/db/queries/team-stats.ts (lines 333-349):
```typescript
export interface UpcomingMatchWithPredictions {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  kickoffTime: string;
  competitionId: string;  // Already available
  slug: string | null;
  isHome: boolean;
  predictionCount: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  avgPredictedHome: number;
  avgPredictedAway: number;
}
```

From src/lib/db/queries/team-stats.ts (lines 428-445):
```typescript
export interface RecentMatchWithAccuracy {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffTime: string;
  competitionId: string;  // Already available
  slug: string | null;
  isHome: boolean;
  result: 'W' | 'D' | 'L';
  predictionCount: number;
  correctPredictions: number;
  accuracyPct: number;
  exactScoreCount: number;
}
```

Canonical match URL format (from src/lib/navigation/urls.ts line 87):
```typescript
// Match URL format: /leagues/{leagueSlug}/{matchSlug}
return `/leagues/${params.leagueSlug}/${params.matchSlug}`;
```

Middleware enforcement:
- ALL `/matches/*` routes return 410 Gone
- Canonical route is `/leagues/{competitionId}/{matchSlug}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix team-recent-matches to use canonical match URLs</name>
  <files>src/components/team/team-recent-matches.tsx</files>
  <action>
Change matchUrl generation on line 24 from:
```typescript
const matchUrl = match.slug ? `/matches/${match.slug}` : null;
```

To:
```typescript
const matchUrl = match.slug && match.competitionId
  ? `/leagues/${match.competitionId}/${match.slug}`
  : null;
```

This uses the competitionId field already present in RecentMatchWithAccuracy type to build the canonical `/leagues/{competitionId}/{matchSlug}` URL instead of the deprecated `/matches/{slug}` format that triggers 410 Gone.

Why: Middleware returns 410 for ALL `/matches/*` routes. The only valid match URL is `/leagues/{competitionId}/{matchSlug}`. The competitionId field is already in the query results (line 437 of team-stats.ts) so no query changes needed.
  </action>
  <verify>
    <automated>
      # Verify the URL format change
      grep -n "matchUrl.*leagues.*competitionId" src/components/team/team-recent-matches.tsx

      # Ensure old /matches/ pattern is gone
      ! grep "/matches/\${" src/components/team/team-recent-matches.tsx
    </automated>
  </verify>
  <done>
    matchUrl variable uses `/leagues/${match.competitionId}/${match.slug}` format, no references to `/matches/` URLs remain in file
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix team-upcoming-matches to use canonical match URLs</name>
  <files>src/components/team/team-upcoming-matches.tsx</files>
  <action>
Change matchUrl generation on line 24 from:
```typescript
const matchUrl = match.slug ? `/matches/${match.slug}` : null;
```

To:
```typescript
const matchUrl = match.slug && match.competitionId
  ? `/leagues/${match.competitionId}/${match.slug}`
  : null;
```

This uses the competitionId field already present in UpcomingMatchWithPredictions type to build the canonical `/leagues/{competitionId}/{matchSlug}` URL instead of the deprecated `/matches/{slug}` format that triggers 410 Gone.

Why: Middleware returns 410 for ALL `/matches/*` routes. The only valid match URL is `/leagues/{competitionId}/{matchSlug}`. The competitionId field is already in the query results (line 340 of team-stats.ts) so no query changes needed.
  </action>
  <verify>
    <automated>
      # Verify the URL format change
      grep -n "matchUrl.*leagues.*competitionId" src/components/team/team-upcoming-matches.tsx

      # Ensure old /matches/ pattern is gone
      ! grep "/matches/\${" src/components/team/team-upcoming-matches.tsx
    </automated>
  </verify>
  <done>
    matchUrl variable uses `/leagues/${match.competitionId}/${match.slug}` format, no references to `/matches/` URLs remain in file
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. No `/matches/{slug}` URLs in team components:
   ```bash
   ! grep -r "/matches/\${" src/components/team/
   ```

2. Both components use canonical format:
   ```bash
   grep -l "leagues.*competitionId.*slug" src/components/team/team-recent-matches.tsx src/components/team/team-upcoming-matches.tsx
   ```

3. Manual verification (if needed):
   - Visit any team page (e.g., `/teams/arsenal`)
   - Click a recent match card → should navigate to `/leagues/{competitionId}/{slug}` not `/matches/{slug}`
   - Click an upcoming match card → should navigate to `/leagues/{competitionId}/{slug}` not `/matches/{slug}`
   - No 410 errors in browser network tab
</verification>

<success_criteria>
- Both team-recent-matches.tsx and team-upcoming-matches.tsx use `/leagues/{competitionId}/{matchSlug}` URL format
- No 410 Gone errors from team page match links
- Team page match cards link to working match detail pages
- All changes verified with grep commands
</success_criteria>

<output>
After completion, create `.planning/quick/57-investigate-and-fix-4xx-errors-from-cool/57-SUMMARY.md`
</output>
