# Architecture Patterns

**Domain:** Next.js 16 UI/UX Rebuild for Sports Prediction Platform
**Researched:** 2026-02-02
**Confidence:** HIGH (Context7 + Official Docs + Codebase Analysis)

## Executive Summary

This architecture document defines the patterns for rebuilding the UI/UX of an existing 82,942 LOC Next.js 16 sports prediction platform. The rebuild focuses on three pillars: **Speed** (Partial Prerendering + Streaming), **SEO** (structured data optimization), and **GEO** (AI citation optimization for generative engines).

The current codebase has solid foundations (React 19 Server Components, ISR, Redis caching, shadcn/ui) but suffers from architectural issues: cluttered match pages, redundant data rendering, poor internal linking, and slow navigation. This document provides patterns to address each issue while preserving working infrastructure.

---

## Current Architecture Analysis

### What Works (Preserve)

| Component | Status | Notes |
|-----------|--------|-------|
| Next.js 16 App Router | Solid | Route structure is clean |
| React 19 Server Components | Solid | Default server rendering works well |
| ISR with 60s revalidation | Solid | Implemented correctly in v1.3 |
| Parallel data fetching | Solid | `Promise.all` pattern in match pages |
| shadcn/ui + Tailwind v4 | Solid | Design tokens established |
| Redis caching layer | Solid | `withCache` pattern, proper TTLs |
| SEO metadata generation | Good | `buildMatchMetadata` is comprehensive |
| JSON-LD structured data | Good | Schema.org implemented |

### What Needs Fixing (Modify)

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Match pages cluttered | Data rendered multiple times | Poor UX, wasted bandwidth |
| Blog layout unusable | ReactMarkdown without structure | Poor readability |
| Slow initial loads | No PPR, full dynamic render | LCP regression |
| Slow navigation | No prefetching strategy | Poor FID/INP |
| Poor internal linking | Manual links, no systematic approach | SEO penalty |
| No GEO optimization | Missing AI-friendly content structure | No AI citations |

### Component Boundary Issues

Current problematic pattern in `/leagues/[slug]/[match]/page.tsx`:
- Same data displayed in multiple cards (Match Stats, MatchOddsPanel, PredictionsSection)
- 387 lines of JSX mixing layout, data, and presentation
- Desktop/mobile divergence duplicates logic

---

## Recommended Architecture

### Layer 1: Data Fetching Architecture

**Pattern: Waterfall Elimination with Parallel Fetch + Streaming**

```
Route Handler (page.tsx)
    |
    v
Stage 1: Critical Path (blocking)
    - getMatchBySlug() - Required for 404/redirect check
    |
    v
Stage 2: Parallel Fetch (non-blocking)
    Promise.all([
        getMatchWithAnalysis(),
        getPredictionsForMatchWithDetails(),
        getMatchEvents(),
        getStandingsForTeams(),
        getNextMatchesForTeams(),
        getMatchRoundup()
    ])
    |
    v
Stage 3: Streaming (Suspense boundaries)
    - Heavy widgets stream in after shell
    - RelatedMatchesWidget
    - RecentPredictionsWidget
```

**KEEP**: Current `Promise.all` pattern (lines 119-155 in match page)
**FIX**: Add Suspense boundaries for expensive renders

### Layer 2: Component Architecture

**Pattern: Composition over Configuration**

```
src/
  components/
    ui/                    # shadcn primitives (KEEP)
    patterns/              # NEW: Composed patterns
      data-card.tsx        # Card + loading + error states
      stat-grid.tsx        # Grid of stat items
      content-section.tsx  # Article-style sections

    match/                 # REFACTOR: Feature-based
      match-shell.tsx      # Static shell (PPR)
      match-header.tsx     # KEEP: Already good
      match-score.tsx      # NEW: Single source of truth for score
      match-odds-compact.tsx  # NEW: Compact odds display
      match-predictions-summary.tsx  # NEW: Condensed view
      match-predictions-full.tsx     # NEW: Full table (lazy)
      match-content-ai.tsx # NEW: GEO-optimized content
      match-internal-links.tsx # NEW: Systematic linking

    blog/                  # NEW: Article architecture
      article-shell.tsx    # Static wrapper
      article-header.tsx   # Title, meta, breadcrumbs
      article-body.tsx     # Markdown with structure
      article-toc.tsx      # Table of contents
      article-related.tsx  # Related content widget
```

**Key Principle**: Each component has ONE responsibility

### Layer 3: Server/Client Component Boundaries

**Pattern: Push Client Boundaries Down**

```typescript
// CORRECT: Client boundary at interaction point
// match-tabs-mobile.tsx (already correct in codebase)
'use client';
export function MatchTabsMobile({ children }) { ... }

// INCORRECT: Client boundary too high
// Would force all children to be client components
'use client';
export function MatchPage({ data }) { ... }
```

**Current Violations to Fix:**

| Component | Current | Should Be |
|-----------|---------|-----------|
| `match-card.tsx` | 'use client' (line 1) | Server (with client time component) |
| `navigation.tsx` | 'use client' (line 1) | Server (with client dropdown) |
| `competition-filter.tsx` | 'use client' | Server (with client select) |

**Strategy**: Extract interactive bits into tiny client components

```typescript
// BEFORE: Entire card is client
'use client';
export function MatchCard({ match }) {
  const [showAnimation, setShowAnimation] = useState(false);
  // ... 300 lines of mostly static JSX
}

// AFTER: Only interactive parts are client
// match-card.tsx (server)
export function MatchCard({ match }) {
  return (
    <Link href={matchUrl}>
      <div className="...">
        <MatchCardContent match={match} />
        <MatchGoalAnimation matchId={match.id} />  {/* Client */}
      </div>
    </Link>
  );
}

// match-goal-animation.tsx (client)
'use client';
export function MatchGoalAnimation({ matchId }) {
  const [flash, setFlash] = useState(false);
  // Only the animation state lives here
}
```

### Layer 4: Partial Prerendering (PPR) Architecture

**Pattern: Static Shell + Dynamic Holes**

```typescript
// next.config.ts
export default {
  experimental: {
    ppr: true,
  },
};

// app/leagues/[slug]/[match]/page.tsx
export default async function MatchPage({ params }) {
  const { slug, match } = await params;

  // This renders at BUILD TIME (static shell)
  return (
    <div className="max-w-4xl mx-auto">
      <MatchShell slug={slug} matchSlug={match}>
        {/* These stream in at REQUEST TIME */}
        <Suspense fallback={<ScoreSkeleton />}>
          <MatchScore matchSlug={match} />
        </Suspense>

        <Suspense fallback={<PredictionsSkeleton />}>
          <MatchPredictions matchSlug={match} />
        </Suspense>
      </MatchShell>
    </div>
  );
}
```

**PPR Candidates (Static Shell):**
- Navigation header
- Page layout structure
- Footer
- Breadcrumb structure
- JSON-LD schema structure

**Dynamic Holes (Stream In):**
- Match scores (live updates)
- Predictions data
- Stats aggregations
- Related matches

### Layer 5: Design System Architecture

**Pattern: Token-Based Theming (Preserve + Extend)**

Current `globals.css` establishes tokens correctly. Extend, don't replace.

```css
/* globals.css - ADD semantic tokens */
:root {
  /* Existing tokens (KEEP) */
  --primary: #a855f7;

  /* NEW: Component-level tokens */
  --match-card-bg: var(--card);
  --match-card-border: var(--border);
  --match-live-indicator: var(--live);

  /* NEW: Spacing scale */
  --space-section: 2rem;    /* Between major sections */
  --space-card: 1.5rem;     /* Inside cards */
  --space-inline: 0.5rem;   /* Between inline elements */

  /* NEW: Content widths */
  --content-narrow: 65ch;   /* Readable line length */
  --content-wide: 80rem;    /* Full-width content */
}
```

**Component Token Mapping:**

| Component | Background | Border | Text |
|-----------|------------|--------|------|
| Match Card | `--match-card-bg` | `--match-card-border` | `--foreground` |
| Live Badge | `--live` | transparent | white |
| Stats Grid | `--muted` | `--border` | `--muted-foreground` |

### Layer 6: SEO/GEO Content Architecture

**Pattern: Dual-Purpose Content (Search + AI)**

```typescript
// NEW: Content structure for GEO optimization
interface MatchContentGEO {
  // Question-based headers for AI extraction
  quickAnswer: string;        // First 100 words - lead with answer
  keyFacts: KeyFact[];        // Structured facts for AI parsing

  // Traditional SEO content
  narrative: string;          // Prose for human readers

  // Schema.org for both
  structuredData: {
    '@type': 'SportsEvent';
    // ... comprehensive schema
  };
}

// Component implementation
export function MatchContentAI({ content }: { content: MatchContentGEO }) {
  return (
    <article itemScope itemType="https://schema.org/SportsEvent">
      {/* GEO: Lead with answer - AI extracts this */}
      <p className="text-lg font-medium" itemProp="description">
        {content.quickAnswer}
      </p>

      {/* GEO: Structured facts - AI can quote directly */}
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {content.keyFacts.map(fact => (
          <div key={fact.label}>
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className="font-semibold" itemProp={fact.schema}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* SEO: Narrative content for humans */}
      <div className="prose prose-invert mt-8">
        {content.narrative}
      </div>
    </article>
  );
}
```

**GEO Optimization Patterns:**

| Pattern | Implementation | Why |
|---------|----------------|-----|
| Answer-First | First 100 words contain key prediction | AI quotes opening |
| Question Headers | "What score will X vs Y be?" | Maps to user queries |
| Declarative Facts | "AI predicts 2-1 with 67% confidence" | Quotable statements |
| Schema Markup | FAQPage, SportsEvent, Article | AI parses structured data |
| Entity Consistency | Same team names everywhere | Entity recognition |

### Layer 7: Internal Linking Architecture

**Pattern: Systematic Link Graph**

```typescript
// NEW: Centralized link generation
// lib/links/internal.ts

export function getMatchLinks(match: Match, competition: Competition) {
  return {
    // Primary canonical
    canonical: `/leagues/${competition.id}/${match.slug}`,

    // Related entities
    competition: `/leagues/${competition.id}`,
    homeTeam: `/teams/${slugify(match.homeTeam)}`,  // Future
    awayTeam: `/teams/${slugify(match.awayTeam)}`,  // Future

    // Temporal links
    previousMatchday: `/leagues/${competition.id}?round=${prevRound}`,
    nextMatchday: `/leagues/${competition.id}?round=${nextRound}`,

    // Content links
    roundup: match.hasRoundup ? `/blog/${match.roundupSlug}` : null,
    preview: match.hasPreview ? `/blog/${match.previewSlug}` : null,
  };
}

// Component for systematic internal linking
export function MatchInternalLinks({ match, competition }) {
  const links = getMatchLinks(match, competition);

  return (
    <nav aria-label="Related content" className="border-t pt-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        Explore More
      </h3>
      <ul className="space-y-2">
        <li><Link href={links.competition}>More {competition.name} matches</Link></li>
        {links.previousMatchday && (
          <li><Link href={links.previousMatchday}>Previous matchday</Link></li>
        )}
        {links.roundup && (
          <li><Link href={links.roundup}>Match analysis</Link></li>
        )}
      </ul>
    </nav>
  );
}
```

---

## Data Flow Optimizations

### Current Flow (Problematic)

```
Page Load
    |
    v
getMatchBySlug() -----> DB Query
    |
    v
getMatchWithAnalysis() -----> DB Query (overlapping data!)
    |
    v
getPredictionsForMatchWithDetails() -----> DB Query
    |
    v
Render ALL data to DOM (including duplicates)
```

### Optimized Flow

```
Page Load
    |
    v
getMatchComplete() -----> Single optimized query
    |                      (match + analysis + predictions summary)
    |
    v
Static Shell renders immediately (PPR)
    |
    v
[Parallel Streams]
    |
    +---> <MatchScore /> streams when ready
    |
    +---> <MatchStats /> streams when ready
    |
    +---> <Suspense> defers <PredictionsFull />
```

**New Query Pattern:**

```typescript
// lib/db/queries/match-complete.ts
export async function getMatchComplete(competitionSlug: string, matchSlug: string) {
  return withCache(
    `match:${competitionSlug}:${matchSlug}`,
    CACHE_TTL.PREDICTIONS,
    async () => {
      const db = getDb();

      // Single query with all needed data
      const result = await db
        .select({
          match: matches,
          competition: competitions,
          analysis: matchAnalysis,
          predictionCount: sql<number>`COUNT(DISTINCT ${predictions.id})`,
          avgPredictedHome: sql<number>`AVG(${predictions.predictedHome})`,
          avgPredictedAway: sql<number>`AVG(${predictions.predictedAway})`,
          topModelAccuracy: sql<number>`MAX(...)`,
        })
        .from(matches)
        .innerJoin(competitions, eq(matches.competitionId, competitions.id))
        .leftJoin(matchAnalysis, eq(matchAnalysis.matchId, matches.id))
        .leftJoin(predictions, eq(predictions.matchId, matches.id))
        .where(and(
          eq(competitions.id, competitionSlug),
          eq(matches.slug, matchSlug)
        ))
        .groupBy(matches.id, competitions.id, matchAnalysis.id);

      return result[0];
    }
  );
}
```

---

## Component Patterns

### Pattern 1: Data Card with States

```typescript
// components/patterns/data-card.tsx
interface DataCardProps<T> {
  title: string;
  icon?: LucideIcon;
  data: T | null;
  loading?: boolean;
  error?: Error | null;
  render: (data: T) => React.ReactNode;
  emptyState?: React.ReactNode;
}

export function DataCard<T>({
  title,
  icon: Icon,
  data,
  loading,
  error,
  render,
  emptyState
}: DataCardProps<T>) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <DataCardSkeleton />}
        {error && <DataCardError error={error} />}
        {!loading && !error && !data && emptyState}
        {!loading && !error && data && render(data)}
      </CardContent>
    </Card>
  );
}
```

### Pattern 2: Streamed Content Section

```typescript
// components/patterns/streamed-section.tsx
interface StreamedSectionProps {
  title: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function StreamedSection({ title, children, fallback }: StreamedSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <Suspense fallback={fallback || <SectionSkeleton />}>
        {children}
      </Suspense>
    </section>
  );
}
```

### Pattern 3: Responsive Layout Switcher

```typescript
// components/patterns/responsive-layout.tsx
interface ResponsiveLayoutProps {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}

export function ResponsiveLayout({ mobile, desktop }: ResponsiveLayoutProps) {
  return (
    <>
      <div className="md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  );
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prop Drilling Data

**What:** Passing full data objects through multiple component layers
**Why bad:** Tight coupling, unnecessary re-renders
**Instead:** Use component-level data fetching with caching

```typescript
// BAD
<MatchPage>
  <MatchHeader match={match} analysis={analysis} />
  <MatchStats match={match} analysis={analysis} standings={standings} />
  <MatchPredictions match={match} predictions={predictions} />
</MatchPage>

// GOOD
<MatchPage matchSlug={slug}>
  <MatchHeader matchSlug={slug} />  {/* Fetches own data */}
  <MatchStats matchSlug={slug} />   {/* Fetches own data */}
  <Suspense fallback={<Skeleton />}>
    <MatchPredictions matchSlug={slug} />  {/* Streams in */}
  </Suspense>
</MatchPage>
```

### Anti-Pattern 2: Client Components for Static Content

**What:** Using 'use client' for components that don't need interactivity
**Why bad:** Increases JS bundle, slower hydration
**Instead:** Default to server, extract only interactive parts

### Anti-Pattern 3: Duplicate Data Rendering

**What:** Showing same information in multiple places
**Why bad:** Cluttered UI, wasted bandwidth, maintenance burden
**Instead:** Single source of truth, reference with links

```typescript
// BAD: Score shown in header, sticky header, and stats card
<MatchHeader homeScore={2} awayScore={1} />
<MatchStickyHeader homeScore={2} awayScore={1} />
<MatchStats homeScore={2} awayScore={1} />

// GOOD: Score shown once, context provides if needed elsewhere
<MatchScoreProvider match={match}>
  <MatchHeader />      {/* Shows score prominently */}
  <MatchStickyHeader /> {/* Shows minimal score on scroll */}
  <MatchStats />       {/* Links to score, doesn't repeat */}
</MatchScoreProvider>
```

### Anti-Pattern 4: Monolithic Page Components

**What:** 300+ line page.tsx files mixing concerns
**Why bad:** Hard to test, hard to reuse, hard to optimize
**Instead:** Compose from focused components

---

## Build Order Recommendation

Based on dependencies and impact, recommended implementation order:

### Phase 1: Foundation (No Visual Changes)

| Order | Task | Rationale |
|-------|------|-----------|
| 1.1 | Enable PPR in next.config.ts | Enables streaming architecture |
| 1.2 | Create `getMatchComplete()` query | Single source of truth for data |
| 1.3 | Add semantic design tokens | Foundation for consistent styling |
| 1.4 | Create component pattern library | Reusable building blocks |

### Phase 2: Match Page Rebuild

| Order | Task | Rationale |
|-------|------|-----------|
| 2.1 | Create MatchShell (static) | PPR shell renders at build |
| 2.2 | Extract MatchScore component | Single source of truth |
| 2.3 | Condense stats display | Eliminate duplication |
| 2.4 | Add Suspense boundaries | Enable streaming |
| 2.5 | Convert MatchCard to server | Reduce JS bundle |

### Phase 3: Blog/Content Rebuild

| Order | Task | Rationale |
|-------|------|-----------|
| 3.1 | Create ArticleShell | Consistent blog layout |
| 3.2 | Structured markdown parser | Better content rendering |
| 3.3 | Add table of contents | Improved navigation |
| 3.4 | GEO content structure | AI citation optimization |

### Phase 4: Navigation & Linking

| Order | Task | Rationale |
|-------|------|-----------|
| 4.1 | Centralized link generation | Consistent URLs |
| 4.2 | Internal linking components | Systematic link graph |
| 4.3 | Prefetch optimization | Faster navigation |
| 4.4 | Breadcrumb enhancement | SEO + UX |

### Phase 5: Polish & Performance

| Order | Task | Rationale |
|-------|------|-----------|
| 5.1 | Audit client boundaries | Minimize JS |
| 5.2 | Add loading.tsx files | Better streaming UX |
| 5.3 | Schema.org audit | Comprehensive structured data |
| 5.4 | GEO content audit | AI citation readiness |

---

## Integration Points

### Existing Components to Preserve

| Component | Path | Integration Notes |
|-----------|------|-------------------|
| MatchHeader | `components/match/match-header.tsx` | Wrap in Suspense for streaming |
| MatchTabsMobile | `components/match/match-tabs-mobile.tsx` | Keep as-is (good pattern) |
| PredictionTable | `components/prediction-table.tsx` | Wrap in lazy loading |
| shadcn/ui primitives | `components/ui/*` | Use without modification |

### New Components to Create

| Component | Purpose | Integration |
|-----------|---------|-------------|
| MatchShell | PPR static shell | Wraps entire match page |
| MatchScore | Single score display | Replaces multiple score renders |
| MatchContentAI | GEO-optimized content | Replaces MatchContentSection |
| ArticleShell | Blog layout wrapper | Replaces inline blog layout |
| InternalLinks | Systematic linking | Adds to all content pages |

### Data Layer Changes

| Change | File | Impact |
|--------|------|--------|
| Add `getMatchComplete` | `lib/db/queries.ts` | New function, no breaks |
| Add cache key | `lib/cache/redis.ts` | Extend `cacheKeys` object |
| Add content types | `lib/content/types.ts` | New GEO content interface |

---

## Sources

### Official Documentation (HIGH Confidence)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
- [Next.js Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)

### Industry Analysis (MEDIUM Confidence)
- [Next.js 16 Features - Strapi](https://strapi.io/blog/next-js-16-features)
- [Next.js Advanced Patterns 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [shadcn/ui Component Architecture](https://www.paulserban.eu/blog/post/shadcnui-component-architecture-building-scalable-design-systems-in-nextjs/)

### GEO/SEO Research (MEDIUM Confidence)
- [GEO Guide 2026](https://www.digitalapplied.com/blog/geo-guide-generative-engine-optimization-2026)
- [SEO Trends 2026 - AI Citations](https://almcorp.com/blog/seo-trends-2026-rank-google-ai-search/)
- [GEO Will Replace SEO](https://statuslabs.com/blog/how-geo-will-replace-traditional-seo-in-2026)

### Codebase Analysis (HIGH Confidence)
- Current match page: `src/app/leagues/[slug]/[match]/page.tsx`
- Current caching: `src/lib/cache/redis.ts`
- Current design tokens: `src/app/globals.css`
- Current components: `src/components/match/*`
