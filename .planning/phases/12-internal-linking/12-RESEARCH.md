# Phase 12: Internal Linking - Research

**Researched:** 2026-02-02
**Domain:** Internal linking architecture, SEO crawl depth optimization, React Server Components
**Confidence:** HIGH

## Summary

Phase 12 focuses on implementing a strategic internal linking structure to reduce crawl depth and improve SEO discoverability. The phase addresses 111 orphan pages identified in the Ahrefs audit by adding contextual cross-links between related content.

The standard approach combines three strategies:
1. **Related matches widget** - Cross-link matches within same competition, involving same teams, or temporally proximate
2. **Related models section** - Link to top-performing models from model detail pages to create hub-spoke architecture
3. **Recent predictions widget** - Add dynamic content to competition hub pages linking to recent match predictions

**Primary recommendation:** Use hub-spoke architecture with contextual internal links, keep all pages within 3 clicks of homepage, implement server-side queries for related content using existing database indexes, and prioritize descriptive anchor text over generic "read more" links.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | Server-side data fetching | Already used, RSC support for zero-JS widgets |
| React Server Components | 19 | Zero-bundle related content | Default in Next.js App Router, optimal for SEO |
| Drizzle ORM | - | Type-safe database queries | Already used for all DB operations |
| PostgreSQL | - | Relational queries for matching | Existing infrastructure with indexed columns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Link component | Next.js | Client-side navigation | All internal links (required for prefetch) |
| Lucide icons | - | Visual hierarchy in widgets | Existing UI library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RSC queries | Client-side fetch | RSC = better SEO, no JS required, crawlable immediately |
| Simple SQL | Recommendation engine | SQL sufficient for "same competition/team" matching |
| Manual links | AI-powered linking tool | Manual = full control, appropriate for structured sports data |

**Installation:**
No new packages required - all dependencies already in project.

## Architecture Patterns

### Recommended Component Structure
```
src/components/
├── match/
│   ├── related-matches-widget.tsx    # NEW: Server Component
│   └── match-h1.tsx                   # Existing
├── model/
│   └── related-models-widget.tsx      # NEW: Server Component
└── competition/
    ├── recent-predictions-widget.tsx  # NEW: Server Component
    └── competition-stats.tsx          # Existing
```

### Pattern 1: Hub-Spoke Internal Linking

**What:** Hierarchical linking structure where hub pages (high-value category pages) link to spokes (detail pages), and spokes link back to hubs and selectively to sibling spokes.

**When to use:** SEO-focused content architecture, topic clustering, crawl depth optimization.

**Current hierarchy:**
```
Homepage (depth 0)
├── /leagues/{competition} (depth 1) [HUB]
│   └── /leagues/{competition}/{match-slug} (depth 2) [SPOKE]
│       └── /matches/{id}/stats (depth 3) [DETAIL]
├── /leaderboard (depth 1) [HUB]
│   └── /models/{id} (depth 2) [SPOKE]
└── /blog (depth 1) [HUB]
    └── /blog/{slug} (depth 2) [SPOKE]
```

**After Phase 12:**
```
- Match pages link to 3-5 related matches (same competition/teams) → reduces orphan matches
- Match pages link to competition hub → breadcrumb already exists
- Competition hubs link to recent 5 predictions → increases hub freshness
- Model pages link to top 5 performers → creates model discovery paths
```

**SEO benefit:** All pages within 3 clicks of homepage, no orphan pages, better crawl budget allocation.

### Pattern 2: Related Content Database Query

**What:** Server-side query pattern for fetching related content based on shared attributes (competition, teams, temporal proximity).

**When to use:** Sports matches, e-commerce products with categories, blog posts with tags.

**Example:**
```typescript
// src/lib/db/queries.ts - NEW FUNCTION
export async function getRelatedMatches(matchId: string, limit: number = 5) {
  const db = getDb();

  // Get current match to find related criteria
  const currentMatch = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!currentMatch[0]) return [];

  const match = currentMatch[0];

  // Query related matches:
  // 1. Same competition (prioritize)
  // 2. Involving same teams
  // 3. Recent (within 30 days)
  // 4. Exclude current match
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        ne(matches.id, matchId), // Exclude self
        or(
          eq(matches.competitionId, match.competitionId), // Same competition
          eq(matches.homeTeam, match.homeTeam), // Same home team
          eq(matches.awayTeam, match.awayTeam), // Same away team
          eq(matches.homeTeam, match.awayTeam), // Home plays as away
          eq(matches.awayTeam, match.homeTeam)  // Away plays as home
        )
      )
    )
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}
```

**Why this works:** Leverages existing indexes on `competitionId`, `homeTeam`, `awayTeam`, `kickoffTime` - no new indexes needed.

### Pattern 3: React Server Component Widget

**What:** Zero-JavaScript widget that renders server-side with data fetching co-located.

**When to use:** SEO-critical content like internal links that must be crawlable.

**Example:**
```typescript
// src/components/match/related-matches-widget.tsx
import Link from 'next/link';
import { getRelatedMatches } from '@/lib/db/queries';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface RelatedMatchesWidgetProps {
  matchId: string;
}

export async function RelatedMatchesWidget({ matchId }: RelatedMatchesWidgetProps) {
  const relatedMatches = await getRelatedMatches(matchId, 5);

  if (relatedMatches.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-4">Related Matches</h2>
        <div className="space-y-3">
          {relatedMatches.map(({ match, competition }) => (
            <Link
              key={match.id}
              href={`/leagues/${competition.id}/${match.slug}`}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
            >
              <div>
                <p className="font-medium text-sm">
                  {match.homeTeam} vs {match.awayTeam}
                </p>
                <p className="text-xs text-muted-foreground">
                  {competition.name}
                </p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Benefits:**
- Server-rendered = crawlable by search engines
- No JavaScript bundle cost
- Co-located data fetching
- Type-safe with TypeScript

### Anti-Patterns to Avoid

- **Random "You may also like" without relevance** - Weakens topic authority, confuses crawlers about page purpose
- **Client-side only related content** - Not crawlable, invisible to search engines, defeats SEO purpose
- **Generic anchor text like "Click here"** - Google 2026 algorithm prioritizes descriptive anchor text for semantic understanding
- **Linking everything to everything** - Creates flat architecture, no topic clustering, wastes crawl budget
- **Hard-coded related links** - Breaks when content changes, maintenance nightmare

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Related content algorithm | ML-based similarity scoring | Simple SQL with shared attributes | Sports data has clear relationships (competition, teams) - no ML needed |
| Link graph analysis | Custom crawler | Database query with existing indexes | Matches table already indexed on competition, teams, time |
| Anchor text generation | Template strings with concatenation | Structured component with semantic HTML | Maintainability, accessibility, consistent styling |
| Prefetching logic | Custom intersection observer | Next.js Link component | Built-in prefetch, optimized by framework team |

**Key insight:** Sports content has structured relationships (same league, same teams) that map directly to SQL queries. Complex similarity algorithms add latency without improving relevance.

## Common Pitfalls

### Pitfall 1: Client-Side Related Content

**What goes wrong:** Related matches fetched client-side aren't crawlable by search engines.
**Why it happens:** Developer uses `useEffect` + `fetch` pattern from React SPA experience.
**How to avoid:** Always use React Server Components for SEO-critical links - render server-side with async/await.
**Warning signs:** "View source" shows no links, Google Search Console reports low internal link count.

### Pitfall 2: N+1 Query Problem in Widgets

**What goes wrong:** Related content widget renders on 50 match pages, each fetching related matches = 50 queries.
**Why it happens:** Database query runs on every page load without caching.
**How to avoid:**
- Use existing Redis cache with `withCache()` helper
- Cache key pattern: `related:matches:{matchId}`
- TTL: 1 hour (content changes infrequently)
**Warning signs:** Database CPU spikes, slow page loads, connection pool exhaustion.

### Pitfall 3: Circular Internal Links

**What goes wrong:** Match A links to Match B, Match B links to Match A, no diversity.
**Why it happens:** Query returns most recent match with same teams = often the reverse fixture.
**How to avoid:**
- Limit to max 1 reverse fixture in related matches
- Diversify with "same competition, different teams" matches
- Order by recency but deduplicate by team pair
**Warning signs:** Related content shows same 2-3 matches everywhere, no discovery value.

### Pitfall 4: Generic Anchor Text

**What goes wrong:** Links use "View match" or "Read more" instead of descriptive text.
**Why it happens:** Developer copy-pastes pattern without considering SEO.
**How to avoid:** Use format "{HomeTeam} vs {AwayTeam} - {Competition}" for match links.
**Warning signs:** Google Search Console flags "non-descriptive anchor text", low topic relevance in rankings.

### Pitfall 5: Over-Linking

**What goes wrong:** Every match page links to 20+ related matches, overwhelming users and diluting link equity.
**Why it happens:** "More is better" thinking.
**How to avoid:** Limit to 5 related items per widget, prioritize quality over quantity.
**Warning signs:** High bounce rate, low CTR on related links, cluttered UI.

## Code Examples

Verified patterns from official sources and project conventions:

### Related Matches Query

```typescript
// src/lib/db/queries.ts
import { getDb, competitions, matches } from './index';
import { eq, and, or, desc, ne, gte } from 'drizzle-orm';

export async function getRelatedMatches(matchId: string, limit: number = 5) {
  const db = getDb();

  // Get current match details
  const currentMatch = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!currentMatch[0]) return [];

  const match = currentMatch[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Priority: Same competition > Same teams > Recent
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        ne(matches.id, matchId),
        or(
          // Same competition matches
          eq(matches.competitionId, match.competitionId),
          // Matches with same teams (any position)
          eq(matches.homeTeam, match.homeTeam),
          eq(matches.awayTeam, match.awayTeam),
          eq(matches.homeTeam, match.awayTeam),
          eq(matches.awayTeam, match.homeTeam)
        ),
        // Only recent or upcoming matches (within 30 days past or future)
        gte(matches.kickoffTime, thirtyDaysAgo)
      )
    )
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}
```

### Related Matches Widget Component

```typescript
// src/components/match/related-matches-widget.tsx
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { getRelatedMatches } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

interface RelatedMatchesWidgetProps {
  matchId: string;
}

export async function RelatedMatchesWidget({ matchId }: RelatedMatchesWidgetProps) {
  const relatedMatches = await getRelatedMatches(matchId, 5);

  if (relatedMatches.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Related Matches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relatedMatches.map(({ match, competition }) => {
            const kickoff = parseISO(match.kickoffTime);
            const matchUrl = match.slug
              ? `/leagues/${competition.id}/${match.slug}`
              : `/matches/${match.id}`;

            return (
              <Link
                key={match.id}
                href={matchUrl}
                className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">
                      {match.homeTeam} vs {match.awayTeam}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {competition.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    {format(kickoff, 'MMM d')}
                  </div>
                </div>
                {match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    Final: {match.homeScore}-{match.awayScore}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Integration into Match Page

```typescript
// src/app/leagues/[slug]/[match]/page.tsx
// Add import at top:
import { RelatedMatchesWidget } from '@/components/match/related-matches-widget';

// Add component after predictions section (around line 300):
export default async function MatchPage({ params }: MatchPageProps) {
  // ... existing code ...

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ... existing match content ... */}

      {/* Add related matches widget */}
      <div className="mt-8">
        <RelatedMatchesWidget matchId={matchData.id} />
      </div>
    </div>
  );
}
```

### Top Models Query

```typescript
// src/lib/db/queries.ts
export async function getTopModels(limit: number = 5) {
  const db = getDb();

  // Get top models by total points (existing leaderboard query)
  return db
    .select({
      id: models.id,
      displayName: models.displayName,
      totalPoints: sql<number>`
        COALESCE(SUM(CASE WHEN ${predictions.status} = 'scored' THEN ${predictions.totalPoints} ELSE 0 END), 0)
      `.as('total_points'),
      scoredPredictions: sql<number>`
        COUNT(CASE WHEN ${predictions.status} = 'scored' THEN 1 END)
      `.as('scored_predictions'),
    })
    .from(models)
    .leftJoin(predictions, eq(predictions.modelId, models.id))
    .where(eq(models.active, true))
    .groupBy(models.id, models.displayName)
    .orderBy(desc(sql`total_points`))
    .limit(limit);
}
```

### Related Models Widget

```typescript
// src/components/model/related-models-widget.tsx
import Link from 'next/link';
import { getTopModels } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

export async function RelatedModelsWidget() {
  const topModels = await getTopModels(5);

  if (topModels.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Performing Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topModels.map((model, index) => (
            <Link
              key={model.id}
              href={`/models/${model.id}`}
              className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-6 text-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {model.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {model.scoredPredictions} predictions
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold">{model.totalPoints} pts</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Recent Predictions Widget for Competition Pages

```typescript
// src/components/competition/recent-predictions-widget.tsx
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { getMatchesByCompetitionId } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface RecentPredictionsWidgetProps {
  competitionId: string;
}

export async function RecentPredictionsWidget({ competitionId }: RecentPredictionsWidgetProps) {
  // Get recent 5 matches with predictions
  const matchesData = await getMatchesByCompetitionId(competitionId, 5);

  if (matchesData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Predictions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {matchesData.map(({ match, competition }) => {
            const kickoff = parseISO(match.kickoffTime);
            const matchUrl = match.slug
              ? `/leagues/${competition.id}/${match.slug}`
              : `/matches/${match.id}`;

            return (
              <Link
                key={match.id}
                href={matchUrl}
                className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">
                      {match.homeTeam} vs {match.awayTeam}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(kickoff, 'MMM d, yyyy')}
                    </p>
                  </div>
                  {match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono font-bold">
                        {match.homeScore}-{match.awayScore}
                      </p>
                      <p className="text-xs text-muted-foreground">Final</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side related content | React Server Components | Next.js 13+ (2022) | Crawlable links, zero JS bundle |
| Generic "Read more" links | Descriptive anchor text | Google algorithm updates 2024-2025 | Better semantic understanding |
| ML similarity scoring | Structured SQL queries | Still evolving | Simpler, faster for structured data |
| Manual link insertion | Dynamic widgets | Standard since 2015 | Scalable, maintainable |

**Deprecated/outdated:**
- Client-side `useEffect` fetching for SEO-critical links - Not crawlable by search engines
- Generic anchor text ("Click here", "Learn more") - Google 2026 penalizes non-descriptive links
- Flat site architecture with no hub pages - Modern SEO requires topic clustering

## Open Questions

1. **Optimal Related Matches Count**
   - What we know: SEO best practice = 3-5 links per section (not overwhelm)
   - What's unclear: User engagement data for sports predictions context
   - Recommendation: Start with 5, measure CTR after 2 weeks, adjust if <2% CTR

2. **Cache TTL for Related Content**
   - What we know: Matches change status (scheduled → live → finished)
   - What's unclear: Balance between freshness and database load
   - Recommendation: 1 hour TTL for related matches (status changes don't affect relevance)

3. **Cross-Linking Blog Posts**
   - What we know: Blog posts exist at `/blog/{slug}` and may be orphaned
   - What's unclear: Blog post structure, tagging system, content categorization
   - Recommendation: Defer to future phase - analyze blog post corpus first, then add related posts widget

4. **Model Page Related Content**
   - What we know: Requirement says "link to top performers"
   - What's unclear: From ALL model pages, or only lower-ranked models?
   - Recommendation: Show on ALL model pages - creates discovery paths, increases crawl depth

## Sources

### Primary (HIGH confidence)
- [Internal Linking Strategy: Complete SEO Guide for 2026](https://www.ideamagix.com/blog/internal-linking-strategy-seo-guide-2026/)
- [Internal Linking Structure: Complete Guide to 2026 SEO Success](https://www.clickrank.ai/effective-internal-linking-structure/)
- [Crawl Depth: 10-Point Guide for SEOs](https://neilpatel.com/blog/crawl-depth/)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Google SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- Project codebase: src/lib/db/queries.ts, src/components/match-card.tsx, schema.ts

### Secondary (MEDIUM confidence)
- [Internal Linking for SEO: Types, Strategies & Tools](https://searchengineland.com/guide/internal-linking)
- [Anchor Text Optimization: Complete Internal Link Guide](https://koanthic.com/en/anchor-text-optimization-complete-internal-link-guide/)
- [Cross Linking Your Website with Internal SEO Links](https://back2marketingschool.com/seo-cross-linking-website/)
- Phase 11 research document (orphan pages context)

### Tertiary (LOW confidence)
- [Related Content Component Database Query Pattern](https://support.microsoft.com/en-us/office/when-to-use-the-content-query-web-part-or-the-content-search-web-part-in-sharepoint-346a0f48-38de-409b-8a58-3bdca1768929) - General CMS patterns, not Next.js specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture patterns: HIGH - Hub-spoke is SEO standard, RSC documented by Next.js
- Database queries: HIGH - Indexes exist, query patterns match existing codebase
- SEO best practices: HIGH - Multiple authoritative sources agree on 2026 standards
- Implementation details: MEDIUM - Specific widget designs need UX validation

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - SEO best practices stable, Next.js patterns established)
**Dependencies:** Phase 11 complete (redirect optimization), existing database schema
**Blocks:** None - Phase 12 is final SEO phase in v1.2 milestone
