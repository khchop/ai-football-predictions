# Stack Research: Club/Team Pages

**Domain:** Football club/team detail pages with AI model performance tracking
**Researched:** 2026-02-11
**Confidence:** HIGH

## Summary

**NO new dependencies required.** All capabilities for club/team pages exist in the current validated stack. Implementation requires only new application code using existing libraries.

## Existing Stack (No Changes)

### Core Technologies (Already Validated)

| Technology | Version | Purpose | Why Sufficient |
|------------|---------|---------|----------------|
| Next.js | 16.1.4 | App Router, ISR, dynamic routes | Dynamic routes pattern already proven in `/leagues/[slug]` and `/leaderboard/club/[id]`. ISR with 60s revalidation established. |
| React | 19.2.3 | UI components | Standard component patterns apply. |
| TypeScript | ^5 | Type safety | Existing type infrastructure extends naturally to club pages. |
| Drizzle ORM | ^0.45.1 | Database queries | Club filtering already implemented in `getLeaderboard()`. Match history queries trivial with existing schema. |
| PostgreSQL | (via pg ^8.17.2) | Data storage | Teams stored as text in `matches.homeTeam` / `matches.awayTeam`. No new tables needed. |
| schema-dts | ^1.1.5 | Schema.org types | `SportsTeam` type already used in `buildSportsEventSchema()`. Extend for dedicated team pages. |

### Supporting Libraries (Already Validated)

| Library | Version | Purpose | Why Sufficient |
|---------|---------|---------|----------------|
| date-fns | ^4.1.0 | Date/time manipulation | Time period filters (weekly/monthly/all-time) already implemented in leaderboard. Reuse for club-scoped filters. |
| lucide-react | ^0.562.0 | Icons | Trophy, Shield, Calendar icons available for club pages. |
| recharts | ^3.6.0 | Charts/visualizations | Performance charts already used in match/league pages. Extend to club performance over time. |
| Radix UI | (multiple ^1.x / ^2.x) | Accessible components | Tabs, Select, Tooltip, Accordion all available for club page UI. |
| next/og | (built-in Next.js) | OG image generation | Pattern established in `/api/og/league/route.tsx`. Copy for `/api/og/team/route.tsx`. |
| isomorphic-dompurify | ^2.35.0 | HTML sanitization | Content sanitization patterns exist in `content/sanitization.ts`. |

### Content Generation (Already Validated)

| Component | Implementation | Purpose | Why Sufficient |
|-----------|---------------|---------|----------------|
| LLM Provider | Together AI (Gemini 3 Flash) | AI-generated content | `content/generator.ts` patterns extend to club analysis. Existing prompt builder patterns in `content/prompts.ts`. |
| FAQ Generation | `generate-league-faqs.ts` | Schema.org FAQPage | Pattern directly applicable: replace league data with club data. |
| Content Storage | `matchContent` / `matchPreviews` tables | CMS-like content | Similar table pattern for `clubContent` if persistence needed (optional - can generate on-demand with ISR). |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Separate teams table | Unnecessary normalization. Teams already exist as text in matches. Adding a teams table creates migration complexity for marginal benefit. | Query distinct homeTeam/awayTeam from matches. Use text-based filtering. |
| GraphQL layer | Overkill for simple REST-like data fetching. Next.js Server Components already provide efficient data loading. | Server Components + React Server Actions for mutations if needed. |
| Dedicated analytics library | Recharts + existing aggregate queries sufficient. Analytics libraries add bundle size for features we don't need. | Extend existing Recharts usage. |
| Internationalization (i18n) | Not in milestone scope. Team names come from API-Football in English. | Defer until explicit i18n requirement. |
| CMS for club content | LLM generation + ISR caching simpler than CMS integration. Content regenerates on revalidation. | On-demand generation in Server Components with ISR. |

## Implementation Plan (Using Existing Stack)

### 1. Database Queries (Drizzle ORM)
**File:** `src/lib/db/queries/teams.ts` (new file, existing patterns)

```typescript
// Get all unique teams from matches (DISTINCT query)
export async function getAllTeams(): Promise<Array<{ name: string; slug: string }>>

// Get team match history (already possible with existing schema)
export async function getTeamMatches(teamName: string, filters?: TimeFilters)

// Leaderboard filtering already exists in queries/stats.ts
// getLeaderboard() with clubId filter - REUSE AS-IS
```

### 2. Routes (Next.js App Router)
**Pattern:** Copy `/app/leagues/[slug]/page.tsx` structure

```
/app/teams/page.tsx              # Index page listing all teams
/app/teams/[slug]/page.tsx       # Team detail with leaderboard + match history
```

**ISR Config:** `export const revalidate = 60` (proven pattern)

### 3. Schema.org Structured Data (schema-dts)
**File:** `src/lib/seo/schema/sports-team.ts` (new file, existing patterns)

```typescript
import type { SportsTeam } from 'schema-dts';

// SportsTeam type already imported in sports-event.ts
// Extend usage to standalone team pages
export function buildSportsTeamSchema(team: TeamData): SportsTeam
```

**Reference:** [Schema.org SportsTeam](https://schema.org/SportsTeam)

### 4. Content Generation (Together AI)
**File:** `src/lib/content/prompts.ts` (extend existing)

```typescript
// Add to existing prompt builders
export function buildClubAnalysisPrompt(clubData: ClubAnalysisData): string
```

**Pattern:** Same as `buildLeagueRoundupPrompt()` - data enrichment + LLM call + sanitization

### 5. OG Images (next/og)
**File:** `src/app/api/og/team/route.tsx` (copy from `og/league/route.tsx`)

**Pattern:** Identical ImageResponse setup, swap league stats for team stats

### 6. Slugification (date-fns utilities)
**File:** `src/lib/utils/slugify.ts` (extend existing)

```typescript
// Add to existing slug generators
export function generateTeamSlug(teamName: string): string {
  return slugify(teamName); // Already handles special chars, lowercase, hyphens
}
```

## Version Compatibility

All packages already validated together in production (kroam.xyz). No compatibility concerns for new feature using existing stack.

| Package | Current Version | Compatibility Notes |
|---------|----------------|---------------------|
| Next.js 16.1.4 | React 19.2.3 | Verified in production with Turbopack |
| Drizzle ORM 0.45.1 | PostgreSQL pg 8.17.2 | Active production queries |
| schema-dts 1.1.5 | TypeScript ^5 | SportsTeam type available |
| date-fns 4.1.0 | - | Time zone support built-in (v4.0+) |

## Integration Points

### Linking from Existing Pages

**League pages** → Link team names to `/teams/[slug]`
```typescript
// In league match list component
<Link href={`/teams/${slugify(match.homeTeam)}`}>{match.homeTeam}</Link>
```

**Match pages** → Link team names to `/teams/[slug]`
```typescript
// In match header component
<Link href={`/teams/${slugify(homeTeam)}`}>{homeTeam}</Link>
```

**Sitemap** → Add teams to sitemap.xml
```typescript
// Extend src/app/sitemap.ts (if exists) or create
// Query distinct teams, generate sitemap entries
```

### Existing Leaderboard Integration

**DO NOT duplicate** `/leaderboard/club/[id]` functionality.

**Strategy:**
- Keep `/leaderboard/club/[id]` for direct leaderboard access
- Add leaderboard section to `/teams/[slug]` that embeds same component
- OR redirect from `/teams/[slug]` to `/leaderboard/club/[id]` for leaderboard view
- Decide based on UX preference (co-location vs. separation)

## Sources

- [Next.js Dynamic Routes Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) — App Router dynamic segments
- [How to Handle Dynamic Routing in Next.js (2026)](https://oneuptime.com/blog/post/2026-01-24-nextjs-dynamic-routing/view) — Best practices
- [schema-dts on npm](https://www.npmjs.com/package/schema-dts) — Latest version verification
- [Schema.org SportsTeam](https://schema.org/SportsTeam) — Structured data specification
- [date-fns releases](https://github.com/date-fns/date-fns/releases) — Version 4.x features

---
*Stack research for: Club/Team Pages Milestone*
*Researched: 2026-02-11*
*Confidence: HIGH — All capabilities exist in validated stack*
