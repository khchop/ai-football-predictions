# Architecture Patterns: Club/Team Pages Integration

**Project:** BettingSoccer (kroam.xyz)
**Researched:** 2026-02-11
**Domain:** Club/Team Pages for AI Football Predictions Platform
**Confidence:** HIGH (based on existing codebase patterns and verified integration points)

## Executive Summary

Club/team pages integrate cleanly with existing architecture using established patterns: dynamic routes, Drizzle ORM queries with aggregations, Redis caching with pattern-based invalidation, ISR with 60s revalidation, and Schema.org SportsTeam markup. The platform already filters predictions by `clubId` in leaderboard queries (`/leaderboard/club/[id]`), proving the data model supports team-scoped aggregation. New pages add **zero** schema changes — teams exist as `homeTeam/awayTeam` text fields in matches table.

**Key insight:** The existing `/leaderboard/club/[id]` page already implements the core query pattern needed for team pages. This validates the approach and provides a working reference implementation.

**Integration complexity:** LOW to MEDIUM. New route (`/teams/[slug]`), new query functions (aggregate by team), new cache keys, new schema markup. All use existing patterns without architectural changes.

---

## Current Architecture (Relevant to Team Pages)

### Data Model

```
┌─────────────────────────────────────────────────┐
│ matches table (existing)                         │
│ ├─ id: text (UUID primary key)                   │
│ ├─ homeTeam: text (team name from API-Football)  │
│ ├─ awayTeam: text (team name)                    │
│ ├─ homeTeamLogo: text (logo URL)                 │
│ ├─ awayTeamLogo: text (logo URL)                 │
│ ├─ competitionId: text → competitions.id         │
│ ├─ kickoffTime: text (ISO datetime)              │
│ ├─ status: text (scheduled/live/finished)        │
│ ├─ homeScore: integer (NULL until finished)      │
│ ├─ awayScore: integer                            │
│ └─ slug: text (SEO-friendly slug)                │
│                                                   │
│ predictions table (existing)                     │
│ ├─ matchId: text → matches.id                    │
│ ├─ modelId: text → models.id                     │
│ ├─ predictedHome: integer                        │
│ ├─ predictedAway: integer                        │
│ ├─ tendencyPoints: integer (2-6 based on quota)  │
│ ├─ goalDiffBonus: integer (0 or 1)               │
│ ├─ exactScoreBonus: integer (0 or 3)             │
│ ├─ totalPoints: integer (sum, max 10)            │
│ └─ status: text (pending/scored/void)            │
│                                                   │
│ ⚠️ NO teams table — teams are strings in matches │
│ ⚠️ Team names from API-Football may vary:        │
│    "Man City", "Manchester City", "Man. City"    │
│                                                   │
│ leagueStandings table (existing, optional)       │
│ ├─ teamId: integer (API-Football ID)             │
│ ├─ teamName: text                                │
│ ├─ position, points, played, won, drawn, lost    │
│ └─ Form, goals for/against, home/away splits     │
└─────────────────────────────────────────────────┘
```

**Critical insight:** Teams are stored as **text fields** (homeTeam, awayTeam) in matches table. No separate teams table exists. Team pages will query by filtering `matches.homeTeam = 'Liverpool'` OR `matches.awayTeam = 'Liverpool'`.

**Implication:** Team slugs must normalize to match stored team names. Mapping layer needed: `/teams/liverpool` → filter for `homeTeam = 'Liverpool'` or `awayTeam = 'Liverpool'`.

### Existing Query Patterns (Reference Implementation)

The platform **already implements team-scoped queries** in `/leaderboard/club/[id]`:

```typescript
// src/app/leaderboard/club/[id]/page.tsx (EXISTING)
export async function getLeaderboard(
  limit: number = 30,
  metric: LeaderboardMetric = 'avgPoints',
  filters?: LeaderboardFilters  // includes clubId, isHome, season
): Promise<LeaderboardEntry[]>
```

**How it works:**
1. Accepts `filters.clubId` (team name string)
2. Filters matches with `or(eq(matches.homeTeam, clubId), eq(matches.awayTeam, clubId))`
3. Joins `predictions` → `matches` → `competitions` (when season filter used)
4. Aggregates model performance: `COUNT()`, `SUM()`, `AVG()`, `ROUND()` for accuracy
5. Returns leaderboard entries with model stats for that team

**What team pages need:** Same pattern but for **team stats** (not model leaderboard).

### Caching Strategy (Existing Pattern)

```typescript
// src/lib/cache/redis.ts
export const cacheKeys = {
  leaderboard: (filters: string) => `db:leaderboard:${hashForCacheKey(filters)}`,
  matchPredictions: (matchId: string) => `db:predictions:${matchId}`,
  // ... other keys
};

export const CACHE_TTL = {
  LEADERBOARD: 60,      // 1 minute
  STATS: 60,            // 1 minute
  COMPETITIONS: 300,    // 5 minutes
  // ... other TTLs
};

// Pattern-based invalidation (used after match scoring)
export async function invalidateMatchCaches(matchId: string): Promise<void> {
  await Promise.all([
    cacheDeletePattern('db:leaderboard:*'),  // All leaderboard variants
    cacheDelete(cacheKeys.overallStats()),
    cacheDelete(cacheKeys.topPerformingModel()),
  ]);
}
```

**For team pages, add:**
```typescript
cacheKeys.teamStats: (teamSlug: string) => `db:team-stats:${teamSlug}`,
cacheKeys.teamLeaderboard: (teamSlug: string, filters: string) =>
  `db:team-leaderboard:${teamSlug}:${hashForCacheKey(filters)}`,
cacheKeys.teamMatches: (teamSlug: string, filters: string) =>
  `db:team-matches:${teamSlug}:${hashForCacheKey(filters)}`,
```

**Invalidation:** Extend `invalidateMatchCaches()` to also delete `db:team-stats:*` and `db:team-leaderboard:*` when a match finishes.

### Dynamic Route Pattern (Existing)

```typescript
// src/app/leagues/[slug]/page.tsx (EXISTING PATTERN)
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionByIdOrAlias(slug);

  if (!competition) return { title: 'League Not Found' };

  // Redirect to canonical URL if slug is alias
  if (slug !== competition.id) {
    permanentRedirect(`/leagues/${competition.id}`);
  }

  return {
    title: buildLeagueTitle(competition.name),
    description: buildLeagueDescription(competition.name, modelCount),
    alternates: { canonical: `${BASE_URL}/leagues/${competition.id}` },
    // ... OG, Twitter, robots
  };
}

export default async function LeaguePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  // ... fetch data, render components
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Breadcrumbs items={visualBreadcrumbs} />
      <Suspense fallback={<LoadingSkeleton />}>
        <LeagueHubContent competitionId={competition.id} />
      </Suspense>
    </>
  );
}
```

**Team pages pattern:**
```typescript
// src/app/teams/[slug]/page.tsx (NEW, SAME PATTERN)
export async function generateMetadata({ params }: PageProps)
export default async function TeamPage({ params, searchParams }: PageProps)
```

**Key differences:**
- Team name mapping: `/teams/liverpool` → `homeTeam = 'Liverpool'` filter
- Team logo from matches table (`homeTeamLogo` or `awayTeamLogo`)
- No canonical redirect (unless implementing team aliases)

---

## New Components for Team Pages

### Component 1: Team Stats Aggregation

**Purpose:** Calculate team performance metrics across all matches.

**Query pattern (inspired by existing `getLeaderboard`):**

```typescript
// src/lib/db/queries/team-stats.ts (NEW)
export interface TeamStats {
  teamName: string;
  teamLogo: string | null;
  totalMatches: number;
  homeMatches: number;
  awayMatches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  // Model prediction accuracy for this team
  totalPredictions: number;
  avgModelAccuracy: number;  // % of predictions with tendencyPoints > 0
}

export async function getTeamStats(
  teamName: string,
  filters?: { competitionId?: string; season?: number; dateFrom?: string; dateTo?: string }
): Promise<TeamStats | null> {
  const db = getDb();

  // Build WHERE conditions
  const whereConditions = [
    or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
    eq(matches.status, 'finished'),  // Only finished matches
  ];

  if (filters?.competitionId) {
    whereConditions.push(eq(matches.competitionId, filters.competitionId));
  }
  // ... other filters

  // Aggregate match results
  const stats = await db
    .select({
      teamName: sql<string>`${teamName}`,
      teamLogo: sql<string>`COALESCE(
        MAX(CASE WHEN ${matches.homeTeam} = ${teamName} THEN ${matches.homeTeamLogo} END),
        MAX(CASE WHEN ${matches.awayTeam} = ${teamName} THEN ${matches.awayTeamLogo} END)
      )`,
      totalMatches: sql<number>`COUNT(*)`,
      homeMatches: sql<number>`SUM(CASE WHEN ${matches.homeTeam} = ${teamName} THEN 1 ELSE 0 END)`,
      awayMatches: sql<number>`SUM(CASE WHEN ${matches.awayTeam} = ${teamName} THEN 1 ELSE 0 END)`,
      wins: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} > ${matches.awayScore} THEN 1
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} > ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      draws: sql<number>`SUM(CASE WHEN ${matches.homeScore} = ${matches.awayScore} THEN 1 ELSE 0 END)`,
      losses: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} < ${matches.awayScore} THEN 1
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} < ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      goalsScored: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} THEN ${matches.homeScore}
        WHEN ${matches.awayTeam} = ${teamName} THEN ${matches.awayScore}
        ELSE 0
      END)`,
      goalsConceded: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} THEN ${matches.awayScore}
        WHEN ${matches.awayTeam} = ${teamName} THEN ${matches.homeScore}
        ELSE 0
      END)`,
    })
    .from(matches)
    .where(and(...whereConditions))
    .groupBy(sql`1`);  // Aggregate to single row

  if (stats.length === 0) return null;

  const stat = stats[0];

  // Separately query prediction accuracy
  const predictionStats = await db
    .select({
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      correctPredictions: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
        eq(predictions.status, 'scored'),
        // ... filters
      )
    );

  const predStat = predictionStats[0];

  return {
    ...stat,
    avgGoalsScored: stat.totalMatches > 0 ? stat.goalsScored / stat.totalMatches : 0,
    avgGoalsConceded: stat.totalMatches > 0 ? stat.goalsConceded / stat.totalMatches : 0,
    totalPredictions: Number(predStat.totalPredictions),
    avgModelAccuracy: predStat.totalPredictions > 0
      ? (Number(predStat.correctPredictions) / Number(predStat.totalPredictions)) * 100
      : 0,
  };
}
```

**Drizzle ORM patterns used:**
- `sql<type>` template for complex aggregations (matches [Drizzle ORM - Magic sql`` operator](https://orm.drizzle.team/docs/sql))
- `CASE WHEN` for conditional aggregations
- `COUNT()`, `SUM()`, `MAX()`, `AVG()` aggregate functions ([Drizzle ORM - Select](https://orm.drizzle.team/docs/select))
- `groupBy(sql\`1\`)` to aggregate all rows into one result

**Caching:**
```typescript
export async function getTeamStats(teamName: string, filters?: TeamFilters) {
  return withCache(
    cacheKeys.teamStats(teamSlug),
    CACHE_TTL.STATS,  // 60s, same as leaderboard
    async () => {
      // ... query above
    }
  );
}
```

### Component 2: Team Match History

**Purpose:** List recent/upcoming matches for a team with prediction data.

**Query pattern:**

```typescript
// src/lib/db/queries/team-stats.ts (NEW)
export interface TeamMatch {
  matchId: string;
  matchSlug: string;
  competitionId: string;
  competitionName: string;
  kickoffTime: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isHomeMatch: boolean;  // True if teamName is homeTeam
  // Prediction summary
  modelsPredictingWin: number;
  modelsPredictingDraw: number;
  modelsPredictingLoss: number;
}

export async function getTeamMatches(
  teamName: string,
  filters?: {
    status?: 'scheduled' | 'finished';
    competitionId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<TeamMatch[]> {
  const db = getDb();

  // Base query
  const whereConditions = [
    or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
  ];

  if (filters?.status === 'finished') {
    whereConditions.push(eq(matches.status, 'finished'));
  } else if (filters?.status === 'scheduled') {
    whereConditions.push(eq(matches.status, 'scheduled'));
  }

  if (filters?.competitionId) {
    whereConditions.push(eq(matches.competitionId, filters.competitionId));
  }

  const results = await db
    .select({
      matchId: matches.id,
      matchSlug: matches.slug,
      competitionId: matches.competitionId,
      competitionName: competitions.name,
      kickoffTime: matches.kickoffTime,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeTeamLogo: matches.homeTeamLogo,
      awayTeamLogo: matches.awayTeamLogo,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(and(...whereConditions))
    .orderBy(desc(matches.kickoffTime))
    .limit(filters?.limit || 20)
    .offset(filters?.offset || 0);

  // For each match, count prediction distribution
  const matchIds = results.map(r => r.matchId);

  const predictionCounts = await db
    .select({
      matchId: predictions.matchId,
      predictedResult: predictions.predictedResult,
      count: sql<number>`COUNT(*)`,
    })
    .from(predictions)
    .where(inArray(predictions.matchId, matchIds))
    .groupBy(predictions.matchId, predictions.predictedResult);

  // Map prediction counts to matches
  const predCountMap = new Map<string, { H: number; D: number; A: number }>();
  for (const pc of predictionCounts) {
    const key = pc.matchId;
    if (!predCountMap.has(key)) {
      predCountMap.set(key, { H: 0, D: 0, A: 0 });
    }
    const counts = predCountMap.get(key)!;
    counts[pc.predictedResult as 'H' | 'D' | 'A'] = Number(pc.count);
  }

  return results.map(r => {
    const isHome = r.homeTeam === teamName;
    const predCounts = predCountMap.get(r.matchId) || { H: 0, D: 0, A: 0 };

    return {
      ...r,
      isHomeMatch: isHome,
      modelsPredictingWin: isHome ? predCounts.H : predCounts.A,
      modelsPredictingDraw: predCounts.D,
      modelsPredictingLoss: isHome ? predCounts.A : predCounts.H,
    };
  });
}
```

**Caching:**
```typescript
export async function getTeamMatches(teamName: string, filters?: TeamMatchFilters) {
  return withCache(
    cacheKeys.teamMatches(teamSlug, JSON.stringify(filters)),
    CACHE_TTL.STATS,  // 60s
    async () => {
      // ... query above
    }
  );
}
```

### Component 3: Team Model Leaderboard

**Purpose:** Show which models perform best for this specific team.

**Implementation:** Reuse existing `getLeaderboard()` with `filters.clubId` set to team name.

```typescript
// src/app/teams/[slug]/page.tsx (NEW)
async function TeamLeaderboardContent({ teamName }: { teamName: string }) {
  const leaderboard = await getLeaderboard(30, 'avgPoints', { clubId: teamName });

  if (leaderboard.length === 0) {
    return <p>No prediction data for this team yet.</p>;
  }

  return <LeaderboardTable entries={leaderboard} />;
}
```

**No new query needed** — existing infrastructure handles this.

### Component 4: Team Name Normalization

**Purpose:** Map team slugs to stored team names.

**Challenge:** Team names in API-Football may vary:
- "Manchester City" vs "Man City" vs "Man. City"
- "Liverpool FC" vs "Liverpool"
- "Tottenham Hotspur" vs "Tottenham"

**Solution:** Create a mapping file (similar to `competitions.ts`):

```typescript
// src/lib/football/teams.ts (NEW)
export interface TeamConfig {
  id: string;              // Slug for URL: "liverpool", "man-city"
  name: string;            // Exact name as stored in matches.homeTeam
  displayName: string;     // Display name for UI: "Liverpool", "Man City"
  aliases: string[];       // Alternate names/slugs
  logo?: string;           // Fallback logo URL (optional, usually from matches)
}

export const TEAMS: TeamConfig[] = [
  {
    id: 'liverpool',
    name: 'Liverpool',
    displayName: 'Liverpool',
    aliases: ['liverpool-fc', 'liverpool'],
  },
  {
    id: 'man-city',
    name: 'Manchester City',
    displayName: 'Man City',
    aliases: ['manchester-city', 'man-city', 'mancity'],
  },
  // ... more teams
];

export function getTeamByIdOrAlias(slug: string): TeamConfig | null {
  const normalized = slug.toLowerCase();
  return TEAMS.find(
    t => t.id === normalized || t.aliases.includes(normalized)
  ) || null;
}

// Auto-generate TEAMS array from existing matches table (one-time script)
export async function generateTeamsList(): Promise<TeamConfig[]> {
  const db = getDb();

  const homeTeams = await db.selectDistinct({ name: matches.homeTeam }).from(matches);
  const awayTeams = await db.selectDistinct({ name: matches.awayTeam }).from(matches);

  const uniqueTeams = new Set([
    ...homeTeams.map(t => t.name),
    ...awayTeams.map(t => t.name),
  ]);

  return Array.from(uniqueTeams).map(name => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    displayName: name,
    aliases: [name.toLowerCase().replace(/\s+/g, '-')],
  }));
}
```

**Usage in route:**
```typescript
// src/app/teams/[slug]/page.tsx
export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const team = getTeamByIdOrAlias(slug);

  if (!team) notFound();

  const stats = await getTeamStats(team.name);  // Use team.name for DB query
  // ...
}
```

---

## Architecture Integration Points

### 1. Route Structure

**New route:**
```
src/app/teams/[slug]/page.tsx
src/app/teams/page.tsx (index page listing all teams)
```

**Follows existing pattern:**
- `/leagues/[slug]` → `/teams/[slug]`
- Dynamic params with `Promise<{ slug: string }>`
- `generateMetadata()` for SEO
- ISR with 60s revalidation (same as league pages)

### 2. Database Queries

**New query file:**
```
src/lib/db/queries/team-stats.ts
├─ getTeamStats(teamName, filters)
├─ getTeamMatches(teamName, filters)
└─ getTeamSeasonStats(teamName, season)  // Optional: season breakdown
```

**Integration with existing:**
- Uses same Drizzle ORM patterns as `src/lib/db/queries/stats.ts`
- Reuses `getLeaderboard()` with `filters.clubId`
- Joins `matches` → `predictions` → `models` → `competitions`

### 3. Caching Strategy

**New cache keys:**
```typescript
// src/lib/cache/redis.ts
export const cacheKeys = {
  // ... existing keys
  teamStats: (teamSlug: string) => `db:team-stats:${teamSlug}`,
  teamLeaderboard: (teamSlug: string, filters: string) =>
    `db:team-leaderboard:${teamSlug}:${hashForCacheKey(filters)}`,
  teamMatches: (teamSlug: string, filters: string) =>
    `db:team-matches:${teamSlug}:${hashForCacheKey(filters)}`,
  allTeams: () => 'db:teams:all',  // Team index page
};
```

**Invalidation on match finish:**
```typescript
// src/lib/cache/redis.ts (MODIFY existing function)
export async function invalidateMatchCaches(matchId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  // Get match details to know which teams to invalidate
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });

  await Promise.all([
    // Existing invalidations
    cacheDeletePattern('db:leaderboard:*'),
    cacheDelete(cacheKeys.overallStats()),
    cacheDelete(cacheKeys.topPerformingModel()),
    cacheDelete(cacheKeys.matchPredictions(matchId)),

    // NEW: Invalidate team-specific caches
    cacheDeletePattern('db:team-stats:*'),       // All team stats
    cacheDeletePattern('db:team-leaderboard:*'), // All team leaderboards
    cacheDeletePattern('db:team-matches:*'),     // All team match lists
    cacheDelete(cacheKeys.allTeams()),           // Team index page
  ]);

  loggers.cache.info({ matchId }, 'Invalidated match and team caches');
}
```

### 4. Sitemap Integration

**New sitemap file:**
```typescript
// src/app/sitemap/teams.xml/route.ts (NEW)
import { NextResponse } from 'next/server';
import { TEAMS } from '@/lib/football/teams';
import { BASE_URL } from '@/lib/seo/constants';

export async function GET() {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${TEAMS.map(team => `
  <url>
    <loc>${BASE_URL}/teams/${team.id}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
`).join('')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

**Update sitemap index:**
```typescript
// src/app/sitemap.ts (MODIFY existing)
import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/sitemap/static.xml`, lastModified: new Date() },
    { url: `${BASE_URL}/sitemap/leagues.xml`, lastModified: new Date() },
    { url: `${BASE_URL}/sitemap/teams.xml`, lastModified: new Date() },  // NEW
    { url: `${BASE_URL}/sitemap/models.xml`, lastModified: new Date() },
    { url: `${BASE_URL}/sitemap/blog.xml`, lastModified: new Date() },
    // ... matches sitemaps
  ];
}
```

### 5. Schema.org SportsTeam Markup

**New schema builder:**
```typescript
// src/lib/seo/schema/sports-team.ts (NEW)
import type { SportsTeam } from 'schema-dts';
import { BASE_URL } from '../constants';
import type { TeamConfig } from '@/lib/football/teams';
import type { TeamStats } from '@/lib/db/queries/team-stats';

export interface TeamSchemaData {
  team: TeamConfig;
  stats: TeamStats;
  activeModels: number;
}

export function buildSportsTeamSchema(data: TeamSchemaData): SportsTeam {
  const { team, stats, activeModels } = data;

  return {
    '@type': 'SportsTeam',
    '@id': `${BASE_URL}/teams/${team.id}`,
    name: team.displayName,
    sport: 'Football',
    url: `${BASE_URL}/teams/${team.id}`,
    logo: stats.teamLogo || undefined,

    // Team performance data
    description: `${team.displayName} football team stats and AI predictions. ${stats.totalMatches} matches tracked with ${activeModels} AI models providing predictions.`,

    // Optional: Add competition memberships (if available)
    // memberOf: competitions.map(c => ({
    //   '@type': 'SportsOrganization',
    //   '@id': `${BASE_URL}/leagues/${c.id}`,
    //   name: c.name,
    // })),
  };
}
```

**Usage in team page:**
```typescript
// src/app/teams/[slug]/page.tsx (NEW)
export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const team = getTeamByIdOrAlias(slug);
  if (!team) notFound();

  const [stats, overallStats] = await Promise.all([
    getTeamStats(team.name),
    getOverallStats(),
  ]);

  if (!stats) notFound();

  // Build schema.org structured data
  const teamSchema = buildSportsTeamSchema({
    team,
    stats,
    activeModels: overallStats.activeModels,
  });

  const breadcrumbs = buildBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Teams', url: `${BASE_URL}/teams` },
    { name: team.displayName, url: `${BASE_URL}/teams/${team.id}` },
  ]);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [teamSchema, breadcrumbs],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Breadcrumbs items={visualBreadcrumbs} />
      {/* Team page content */}
    </>
  );
}
```

**Schema.org properties used:**
- `@type: 'SportsTeam'` (from [Schema.org SportsTeam](https://schema.org/SportsTeam))
- Required: `name`, `sport`
- Recommended: `url`, `logo`, `description`
- Optional: `memberOf` (link to competition pages)

**Validation:** Test with [Rich Results Test](https://search.google.com/test/rich-results) after implementation.

### 6. Linking from Existing Pages

**A. From league pages:**
```typescript
// src/app/leagues/[slug]/league-hub-content.tsx (MODIFY)
<section>
  <h2>Teams in {competition.name}</h2>
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
    {teamsInCompetition.map(team => (
      <Link href={`/teams/${team.id}`} key={team.id}>
        <div className="flex items-center gap-2 p-3 rounded border hover:bg-accent">
          {team.logo && <img src={team.logo} alt={team.name} className="w-8 h-8" />}
          <span>{team.displayName}</span>
        </div>
      </Link>
    ))}
  </div>
</section>
```

**B. From match pages:**
```typescript
// src/app/leagues/[slug]/[match]/page.tsx (MODIFY)
<div className="flex justify-between items-center mb-6">
  <Link href={`/teams/${homeTeamSlug}`} className="flex items-center gap-2 hover:underline">
    <img src={match.homeTeamLogo} alt={match.homeTeam} className="w-10 h-10" />
    <span className="font-semibold">{match.homeTeam}</span>
  </Link>

  <span className="text-2xl font-bold">{match.homeScore} - {match.awayScore}</span>

  <Link href={`/teams/${awayTeamSlug}`} className="flex items-center gap-2 hover:underline">
    <span className="font-semibold">{match.awayTeam}</span>
    <img src={match.awayTeamLogo} alt={match.awayTeam} className="w-10 h-10" />
  </Link>
</div>
```

**C. Team index page:**
```typescript
// src/app/teams/page.tsx (NEW)
export default async function TeamsIndexPage() {
  const teams = TEAMS.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div>
      <h1>Football Teams</h1>
      <p>Explore AI prediction performance for {teams.length} football teams.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {teams.map(team => (
          <Link href={`/teams/${team.id}`} key={team.id}>
            <Card className="p-4 hover:bg-accent">
              {team.logo && <img src={team.logo} alt={team.displayName} className="w-16 h-16 mx-auto" />}
              <p className="text-center mt-2">{team.displayName}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Metadata:**
```typescript
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Football Teams | AI Predictions | kroam',
    description: `Explore ${TEAMS.length} football teams with AI prediction analysis. See which models perform best for each team.`,
    alternates: { canonical: `${BASE_URL}/teams` },
  };
}
```

---

## Data Flow Changes

### Before Team Pages

```
User → /leagues/epl → League Hub
                    ↓
            Matches List (all EPL matches)
                    ↓
            Match Detail → Predictions by Model
```

### After Team Pages

```
User → /leagues/epl → League Hub
       |                ↓
       |        Teams in League (NEW)
       |                ↓
       └→ /teams/liverpool → Team Page
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
         Team Stats            Model Leaderboard
         Recent Matches        (for Liverpool only)
              ↓
         Match Detail → Predictions
```

**New navigation paths:**
1. Home → Teams Index → Team Page → Match
2. League Hub → Team Link → Team Page → Recent Matches → Match
3. Match Page → Team Badge Link → Team Page

**Cross-linking benefits:**
- **SEO:** Internal links reduce orphan pages (currently 65 model pages, 47 match pages with no inlinks)
- **UX:** Users can explore teams, not just leagues
- **Discovery:** Team-specific model performance reveals insights

---

## Build Order (Integration Sequence)

### Phase 1: Foundation (No UI Changes)
**Goal:** Establish data layer without breaking existing features.

1. **Create team mapping file** (`src/lib/football/teams.ts`)
   - Generate from existing matches table
   - Add aliases for common team name variations
   - Export `getTeamByIdOrAlias()` function

2. **Create team query functions** (`src/lib/db/queries/team-stats.ts`)
   - `getTeamStats(teamName, filters)`
   - `getTeamMatches(teamName, filters)`
   - Test with existing team names ("Liverpool", "Man City")

3. **Add team cache keys** (`src/lib/cache/redis.ts`)
   - Define `cacheKeys.teamStats`, `cacheKeys.teamLeaderboard`, etc.
   - Extend `invalidateMatchCaches()` to include team patterns
   - No breaking changes — adds to existing function

**Validation:** Run queries in Node REPL, verify cache keys work, check invalidation triggers.

### Phase 2: Routes & SEO (New Pages)
**Goal:** Create accessible team pages with proper metadata.

4. **Create team detail page** (`src/app/teams/[slug]/page.tsx`)
   - Import team config, stats queries
   - Implement `generateMetadata()` for SEO
   - Render basic stats (wins/losses/goals)
   - Add breadcrumbs, Schema.org SportsTeam markup

5. **Create team index page** (`src/app/teams/page.tsx`)
   - List all teams with links
   - Add metadata, breadcrumbs
   - Simple grid layout with logos

6. **Add to sitemap** (`src/app/sitemap/teams.xml/route.ts`)
   - Generate XML for all team pages
   - Update sitemap index to reference teams.xml

**Validation:** Visit `/teams/liverpool`, check HTML source for canonical/OG tags, test Schema.org with Rich Results Test.

### Phase 3: UI Components (Visual Polish)
**Goal:** Add rich content to team pages.

7. **Build TeamStatsCard component** (`src/components/team/TeamStatsCard.tsx`)
   - Display W/D/L record, goals, avg per match
   - Home vs away split
   - Recent form indicator

8. **Build TeamMatchesTable component** (`src/components/team/TeamMatchesTable.tsx`)
   - List recent/upcoming matches
   - Show prediction distribution (models predicting W/D/L)
   - Link to match detail pages

9. **Integrate existing LeaderboardTable** (reuse)
   - Pass `filters.clubId` to `getLeaderboard()`
   - Show models sorted by performance for this team

**Validation:** Check responsive design, verify data accuracy, test loading states.

### Phase 4: Cross-Linking (SEO Impact)
**Goal:** Reduce orphan pages, improve internal linking.

10. **Add team links to league pages** (modify `LeagueHubContent.tsx`)
    - Section: "Teams in {League}"
    - Extract teams from matches in that competition
    - Grid of team badges linking to `/teams/[slug]`

11. **Add team links to match pages** (modify match detail page)
    - Team badges (home/away) link to team pages
    - Breadcrumb: Home > Leagues > {League} > {Team} > {Match}

12. **Add "Related Teams" widget** (new component)
    - Show teams that played recently
    - Cross-link between team pages
    - Place on homepage or league hubs

**Validation:** Crawl site with Screaming Frog, verify team pages have inlinks, check anchor text distribution.

### Phase 5: Content Generation (Optional)
**Goal:** Add AI-generated team analysis.

13. **Generate team summaries** (BullMQ worker)
    - Prompt: "Summarize {Team}'s recent performance: {stats}. Mention top-performing model."
    - Store in `team_content` table (similar to `matchContent`)
    - Display on team page

14. **Generate team FAQs** (similar to league FAQs)
    - "Which AI model is most accurate for {Team}?"
    - "What is {Team}'s win rate this season?"
    - Add to Schema.org FAQPage

**Validation:** Check content quality, verify Schema.org FAQPage validation, monitor LLM costs.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Team name inconsistency** (API-Football returns "Man City" sometimes, "Manchester City" other times) | MEDIUM | Create `teams.ts` mapping with aliases. Normalize on first load. |
| **Large query performance** (aggregating 1000+ matches for Liverpool) | MEDIUM | Add indexes: `CREATE INDEX idx_matches_home_team ON matches(home_team);` and `idx_matches_away_team ON matches(away_team);`. Cache for 60s. |
| **Cache invalidation complexity** (team pages depend on match results) | LOW | Pattern-based invalidation (`db:team-*`) handles all team caches. Already proven in existing `invalidateMatchCaches()`. |
| **Schema.org validation errors** (SportsTeam missing required properties) | LOW | Follow official schema, validate with Rich Results Test before deploy. Reference: [Schema.org SportsTeam](https://schema.org/SportsTeam). |
| **Sitemap explosion** (500+ teams = large sitemap) | LOW | Use chunked sitemaps (max 50k URLs per file). Teams sitemap likely <200 URLs. |
| **Orphan team pages** (teams with 0 matches in current season) | LOW | Filter `TEAMS` to only include teams with matches in active competitions. Or show "No data yet" message. |

---

## Success Criteria

### Technical
- [ ] Team pages accessible at `/teams/[slug]`
- [ ] Team index page at `/teams` with all team links
- [ ] Cache keys invalidate correctly when matches finish
- [ ] Database queries return within 200ms (avg)
- [ ] Schema.org SportsTeam markup validates with no errors
- [ ] Sitemap includes all team pages

### SEO
- [ ] Canonical URLs correct on all team pages
- [ ] Meta titles <60 chars, descriptions 120-155 chars
- [ ] OG tags complete (title, description, image, type)
- [ ] Breadcrumbs structured data present
- [ ] Internal links from league/match pages to team pages
- [ ] Team pages indexed in Google Search Console within 7 days

### UX
- [ ] Team stats display correctly (W/D/L, goals, accuracy)
- [ ] Recent matches list loads in <1s
- [ ] Model leaderboard shows team-specific performance
- [ ] Team badges on match pages link to team pages
- [ ] Loading states prevent layout shift

### Performance
- [ ] Team pages pass Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)
- [ ] ISR revalidation working (60s)
- [ ] Cache hit rate >80% for team stats queries
- [ ] No N+1 query problems (max 3 DB queries per page load)

---

## Sources

**Codebase Analysis:**
- Existing patterns: `src/app/leaderboard/club/[id]/page.tsx`, `src/app/leagues/[slug]/page.tsx`
- Query patterns: `src/lib/db/queries/stats.ts`, `src/lib/db/queries/model-stats.ts`
- Caching: `src/lib/cache/redis.ts`
- Schema: `src/lib/db/schema.ts`

**Documentation:**
- [Next.js Dynamic Routes and SSG](https://devanddeliver.com/blog/frontend/next-js-15-dynamic-routes-and-static-site-generation-ssg)
- [Next.js Dynamic Route SEO Best Practices](https://webpeak.org/blog/nextjs-dynamic-route-seo-best-practices/)
- [Schema.org SportsTeam](https://schema.org/SportsTeam)
- [Schema.org SportsOrganization](https://schema.org/SportsOrganization)
- [SportsTeam JSON-LD Example](https://jsonld.com/sports-team-json-ld-example/)
- [Drizzle ORM - Select](https://orm.drizzle.team/docs/select)
- [Drizzle ORM - Magic sql`` operator](https://orm.drizzle.team/docs/sql)
- [SEO in Next.js 15: Best Practices](https://medium.com/@sparklewebhelp/seo-in-next-js-15-best-practices-for-faster-ranking-23c1d2c95046)

**Confidence Level:** HIGH — Integration points validated against existing codebase patterns, query structures proven in `/leaderboard/club/[id]`, Schema.org properties verified with official docs.
