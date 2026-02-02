# Phase 15: Performance Optimization - Research

**Researched:** 2026-02-02
**Domain:** Next.js 15/16 ISR Performance Optimization, Redis Caching, Parallel Data Fetching
**Confidence:** HIGH

## Summary

Research focused on converting match pages from `force-dynamic` (SSR with ~800ms TTFB) to ISR with conditional revalidation intervals (60s live, 300s scheduled, 3600s finished) to achieve sub-400ms TTFB on mobile networks. The investigation covered Next.js ISR best practices, parallel data fetching strategies, Redis cache optimization, and common performance pitfalls.

**Current state:** Match pages use `export const dynamic = 'force-dynamic'` with `export const revalidate = 60`, which creates a conflict where `force-dynamic` disables ISR benefits. Sequential data fetching creates request waterfalls (4x baseline latency). Redis caching infrastructure exists but isn't leveraged for page-level caching.

**Target performance:** TTFB under 400ms on mobile networks (currently ~800ms), cache hit rate >70% (currently minimal due to force-dynamic), parallel data fetching to eliminate waterfalls.

**Primary recommendation:** Remove `force-dynamic` export, implement conditional revalidation based on match status, parallelize all independent data fetches with `Promise.all`, and leverage existing Redis cache for database queries while relying on Next.js Data Cache for fetch requests.

## Standard Stack

The project already uses the established stack for Next.js performance optimization:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.4 | App Router with ISR | Industry standard for static + dynamic hybrid rendering |
| React | 19.2.3 | Server Components | Native streaming and automatic request memoization |
| ioredis | 5.9.2 | Redis client | High-performance Redis client with connection pooling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date manipulation | Already used for match status determination |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ISR with revalidate | On-demand revalidation | ISR simpler for time-based patterns; on-demand adds webhook complexity |
| Promise.all | Suspense boundaries | Promise.all blocks until all resolve; Suspense streams incrementally (better UX but more complex) |
| ioredis | Upstash Redis | ioredis for self-hosted; Upstash for serverless edge (not needed for this deployment) |

**Installation:**
No new packages required - all dependencies already installed.

## Architecture Patterns

### Recommended ISR Structure

```typescript
// Remove conflicting exports:
// ❌ export const dynamic = 'force-dynamic';  // BLOCKS ISR
// ❌ export const revalidate = 60;           // IGNORED with force-dynamic

// ✅ Use conditional revalidation based on match status
export const revalidate = 60; // Default for scheduled matches

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Metadata generation (runs in parallel with page)
}

export default async function MatchPage({ params }: Props) {
  // 1. Resolve params
  const { slug, match } = await params;

  // 2. PARALLEL data fetching - initiate all promises
  const matchPromise = getMatchBySlug(competitionSlug, match);
  const analysisPromise = getMatchWithAnalysis(matchData.id);
  const predictionsPromise = getPredictionsForMatchWithDetails(matchData.id);

  // 3. Resolve critical path first (match data needed for conditionals)
  const result = await matchPromise;
  if (!result) notFound();

  // 4. Wait for remaining promises in parallel
  const [analysisData, predictions] = await Promise.all([
    analysisPromise,
    predictionsPromise
  ]);

  // 5. Conditional data fetching for non-critical data
  const matchEvents = (isFinished || isLive) && matchData.externalId
    ? await getMatchEvents(parseInt(matchData.externalId, 10))
    : [];
}
```

### Pattern 1: Conditional Revalidation via Middleware

**What:** Dynamically set revalidation intervals based on match status without hardcoding in page
**When to use:** When pages need different cache durations based on data state
**Implementation approach:**

Since Next.js doesn't support dynamic `revalidate` export values, use one of these approaches:

**Option A: Per-fetch revalidation (RECOMMENDED)**
```typescript
// In data fetching function
async function getMatchData(id: string) {
  // Determine revalidation based on match status
  const revalidateTime = match.status === 'live' ? 30
    : match.status === 'scheduled' ? 60
    : 3600;

  // Apply to individual fetch
  return fetch(url, { next: { revalidate: revalidateTime } });
}
```

**Option B: Fixed conservative revalidate + cache invalidation**
```typescript
// page.tsx
export const revalidate = 30; // Shortest interval (live matches)

// Use revalidatePath() when match status changes (in worker/webhook)
import { revalidatePath } from 'next/cache';
revalidatePath(`/leagues/${slug}/${match}`);
```

**Limitation:** Next.js ISR doesn't natively support conditional page-level revalidation. The project needs to choose between:
1. Conservative fixed interval (30s) for all matches
2. Per-fetch revalidation (requires refactoring database queries)
3. On-demand revalidation triggered by status changes (requires webhook infrastructure)

**Recommendation:** Start with **fixed 60s revalidation** (balances live match freshness with cache efficiency), then optimize with on-demand revalidation when match status changes to 'finished'.

### Pattern 2: Parallel Data Fetching with Promise.all

**What:** Initiate independent data fetches simultaneously to eliminate request waterfalls
**When to use:** When multiple data sources don't depend on each other
**Example:**
```typescript
// Source: Next.js Official Docs - Data Fetching Patterns
// https://nextjs.org/docs/app/building-your-application/data-fetching/patterns

export default async function Page({ params }) {
  const { id } = await params;

  // ❌ SEQUENTIAL (400ms + 400ms + 400ms = 1200ms)
  const match = await getMatch(id);
  const predictions = await getPredictions(id);
  const analysis = await getAnalysis(id);

  // ✅ PARALLEL (max(400ms, 400ms, 400ms) = 400ms)
  const [match, predictions, analysis] = await Promise.all([
    getMatch(id),
    getPredictions(id),
    getAnalysis(id)
  ]);
}
```

**Critical caveat:** Promise.all blocks rendering until ALL promises resolve. If one query is slow (e.g., external API), it delays the entire page. For better UX with streaming, use Suspense boundaries instead (see Anti-Patterns below).

### Pattern 3: Two-Stage Data Fetching

**What:** Resolve critical path data first, then fetch dependent/optional data in parallel
**When to use:** When some data depends on other data, or some data is optional based on conditions
**Example:**
```typescript
// Stage 1: Critical path (match existence check)
const matchData = await getMatch(id);
if (!matchData) notFound();

const isFinished = matchData.status === 'finished';
const isLive = matchData.status === 'live';

// Stage 2: Parallel fetch of all remaining data
const [
  matchEvents,
  standings,
  nextMatches,
  roundup
] = await Promise.all([
  (isFinished || isLive) && matchData.externalId
    ? getMatchEvents(parseInt(matchData.externalId, 10))
    : Promise.resolve([]),
  getStandingsForTeams(competition.id, [matchData.homeTeam, matchData.awayTeam]),
  getNextMatchesForTeams([matchData.homeTeam, matchData.awayTeam], 4),
  isFinished ? getMatchRoundup(matchData.id) : Promise.resolve(null)
]);
```

**Key insight:** Use `Promise.resolve()` for conditional branches to keep Promise.all syntax clean.

### Pattern 4: Redis Cache Layer Strategy

**What:** Three-tier caching with Redis (origin), Data Cache (fetch), and CDN (edge)
**When to use:** Always for production Next.js applications with database queries
**Architecture:**

```
Request Flow:
1. CDN Edge (Cloudflare/Vercel) → 20-50ms TTFB (cache hit)
2. Next.js Data Cache (fetch) → 50-100ms TTFB (memoized)
3. Redis Cache (ioredis) → 100-200ms TTFB (in-memory)
4. PostgreSQL (origin) → 200-800ms TTFB (cold query)
```

**Current implementation status:**
- ✅ Redis infrastructure exists (`src/lib/cache/redis.ts`)
- ✅ Database query caching via `withCache()` helper
- ✅ Graceful degradation when Redis unavailable
- ❌ Page-level ISR caching disabled by `force-dynamic`

**Action:** Simply remove `force-dynamic` to enable Next.js Data Cache + CDN edge caching layers.

### Anti-Patterns to Avoid

- **Using `force-dynamic` with `revalidate`:** `force-dynamic` disables all caching, making `revalidate` export meaningless. Choose one strategy.

- **Sequential awaits for independent data:** Creates request waterfalls (N × latency instead of max(latencies)). Current codebase does this extensively.

- **Promise.all without error handling:** One rejected promise fails entire batch. Use `Promise.allSettled()` if some failures are acceptable:
  ```typescript
  const results = await Promise.allSettled([promise1, promise2, promise3]);
  const [match, predictions, analysis] = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : fallbackValues[i]
  );
  ```

- **Memoizing database calls manually:** Next.js automatically memoizes `fetch()` requests during render. Don't wrap in `React.cache()` unless using non-fetch data sources.

- **Forgetting CDN cache invalidation:** When using `revalidatePath()`, CDN (Cloudflare/Vercel) cache isn't automatically purged. Add CDN invalidation for instant updates.

- **Setting same revalidate for all fetch calls:** Lowest `revalidate` value across all fetches determines page revalidation. Be intentional about this cascade.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request deduplication | Custom request cache with Map | Next.js automatic memoization | fetch() requests auto-deduplicated during render; works across components |
| Redis connection pooling | Manual connection management | ioredis with singleton pattern | Already implemented correctly in `src/lib/cache/redis.ts` |
| Conditional revalidation logic | Custom middleware to set headers | Per-fetch `next: { revalidate }` | Next.js supports per-request revalidation; simpler than middleware |
| Cache warming on deploy | Custom build script | Next.js automatic static generation | ISR pre-renders pages on first request; no manual warming needed |
| Parallel data fetching orchestration | Custom Promise batching utility | Plain `Promise.all` / `Promise.allSettled` | Native JavaScript sufficient; additional abstraction adds complexity |

**Key insight:** Next.js 15/16 has sophisticated caching built-in. Most "optimization" attempts actually degrade performance by fighting the framework defaults. The project's existing Redis cache is well-implemented; focus on removing anti-patterns (`force-dynamic`) rather than adding complexity.

## Common Pitfalls

### Pitfall 1: force-dynamic Negates ISR Benefits

**What goes wrong:** Using `export const dynamic = 'force-dynamic'` with `export const revalidate = 60` creates a conflict where the page renders dynamically on every request (SSR), ignoring the revalidation interval and preventing CDN caching.

**Why it happens:** Developers add `force-dynamic` to ensure fresh data, not realizing ISR with `revalidate` already provides time-based freshness without sacrificing cache performance.

**How to avoid:**
- Remove `export const dynamic = 'force-dynamic'` from match pages
- Keep `export const revalidate = 60` (or appropriate interval)
- Trust ISR to serve cached pages and regenerate in background

**Warning signs:**
- TTFB consistently high (400-800ms) even for repeat page loads
- Next.js logs show "Dynamic page" instead of "SSG/ISR" during build
- Vercel Analytics shows 0% cache hit rate

**Impact:** Removing `force-dynamic` from match pages should reduce TTFB from ~800ms to 50-200ms (cached) for 95%+ of requests.

### Pitfall 2: Sequential Data Fetching Creates Waterfalls

**What goes wrong:** Awaiting each data fetch sequentially multiplies latency:
```typescript
const match = await getMatch(id);        // 200ms
const predictions = await getPredictions(id);  // 200ms
const analysis = await getAnalysis(id);       // 200ms
// Total: 600ms (3× waterfall)
```

**Why it happens:** Natural coding pattern (await each operation before next) doesn't account for I/O concurrency.

**How to avoid:**
```typescript
// Initiate all promises first (don't await yet)
const matchPromise = getMatch(id);
const predictionsPromise = getPredictions(id);
const analysisPromise = getAnalysis(id);

// Wait for all in parallel
const [match, predictions, analysis] = await Promise.all([
  matchPromise,
  predictionsPromise,
  analysisPromise
]);
// Total: 200ms (parallelized)
```

**Warning signs:**
- Chrome DevTools Network tab shows sequential "staircase" pattern
- Server logs show sequential query timestamps (200ms gaps)
- TTFB varies significantly with number of data sources

**Current impact:** Match pages fetch 5-7 data sources sequentially. Parallelizing should reduce data fetching time by 3-5×.

### Pitfall 3: Misunderstanding Next.js Cache Layers

**What goes wrong:** Developers get confused by four overlapping cache layers in Next.js:
1. Request Memoization (in-memory, per-render)
2. Data Cache (persistent, fetch calls)
3. Full Route Cache (ISR static HTML)
4. Router Cache (client-side, navigation)

**Why it happens:** Next.js documentation treats these as separate features, but they interact in complex ways. Example: `revalidatePath()` invalidates Data Cache and Full Route Cache but NOT Router Cache, requiring client refresh to see changes.

**How to avoid:**
- Understand that removing `force-dynamic` enables layers 2-4
- Know that `fetch()` automatically uses layers 1-2 (memoization + Data Cache)
- Test cache behavior with `next build && next start` (dev mode bypasses caches)
- Use per-fetch `cache: 'no-store'` to opt out specific requests, not page-level `force-dynamic`

**Warning signs:**
- Cache behavior differs between dev and production
- `revalidatePath()` doesn't show immediate updates
- Some data updates while other data stays stale

### Pitfall 4: Lowest Revalidate Wins

**What goes wrong:** If a page has multiple fetch requests with different `revalidate` values, the **lowest** value determines the entire page's revalidation frequency:

```typescript
// Match data: revalidate = 3600 (1 hour)
fetch('/api/match', { next: { revalidate: 3600 } });

// Live odds: revalidate = 30 (30 seconds)
fetch('/api/odds', { next: { revalidate: 30 } });

// Result: Entire page revalidates every 30 seconds
```

**Why it happens:** Next.js conservatively chooses the shortest interval to ensure no data is stale longer than specified.

**How to avoid:**
- Audit all fetch calls in a route to understand effective revalidation
- Move frequently-updating data to client components or Suspense boundaries
- Use consistent revalidation intervals for data with similar freshness requirements

**Warning signs:**
- Page revalidates more frequently than expected
- CDN cache hit rate lower than anticipated
- High server load despite ISR implementation

### Pitfall 5: CDN Cache Not Invalidated with revalidatePath()

**What goes wrong:** When using on-demand revalidation with `revalidatePath()`, Next.js invalidates its internal cache but doesn't automatically invalidate CDN (Cloudflare/Vercel Edge) cache. Users continue seeing stale content from CDN for up to `s-maxage` duration.

**Why it happens:** CDN cache is separate infrastructure; Next.js can't directly invalidate external CDN caches.

**How to avoid:**
- When using Vercel: use `revalidatePath()` which triggers both Next.js and Edge cache invalidation
- When using Cloudflare: manually call Cloudflare API to purge cache paths after `revalidatePath()`
- Set appropriate `s-maxage` headers (5× shorter than ISR revalidate interval)

**Warning signs:**
- `revalidatePath()` logged in server but users report stale content
- Direct server requests show fresh data, but CDN serves stale
- Cache headers show `X-Vercel-Cache: HIT` with old data

### Pitfall 6: Redis Unavailable Breaks Application

**What goes wrong:** If Redis connection fails and code doesn't handle gracefully, entire application can crash or hang.

**Why it happens:** Network failures, Redis restarts, connection pool exhaustion.

**How to avoid (already implemented):**
- ✅ Project uses graceful degradation in `src/lib/cache/redis.ts`
- ✅ `shouldUseRedis()` checks availability before operations
- ✅ `withCache()` wrapper continues without cache on Redis failure
- ✅ Cooldown period prevents Redis spam during outages

**Warning signs:**
- 500 errors during Redis outages
- Request timeouts when Redis is slow
- Cache functions throwing instead of degrading

**Current status:** Project already handles this correctly. No action needed.

### Pitfall 7: Cache Metrics Without Monitoring

**What goes wrong:** Implementing caching strategies without measuring effectiveness. Target is 70%+ cache hit rate, but without monitoring, you don't know if it's 10% or 90%.

**Why it happens:** Focus on implementation rather than observability.

**How to avoid:**
- Use Redis `INFO stats` command to check `keyspace_hits` and `keyspace_misses`
- Calculate hit rate: `hits / (hits + misses) × 100%`
- Add logging to cache operations (project already has this via `loggers.cache`)
- Monitor cache hit rates in production dashboard

**Warning signs:**
- Don't know current cache hit rate
- Performance issues without data to diagnose
- Unable to validate optimization impact

**Action:** Add cache monitoring endpoint or script to check Redis `INFO stats` regularly.

## Code Examples

Verified patterns from official sources and current codebase analysis:

### Example 1: Remove force-dynamic, Enable ISR

**Before (current implementation):**
```typescript
// src/app/leagues/[slug]/[match]/page.tsx
export const dynamic = 'force-dynamic'; // ❌ Blocks ISR

export default async function MatchPage({ params }: MatchPageProps) {
  // Sequential fetching (waterfall)
  const result = await getMatchBySlug(competitionSlug, match);
  const analysisData = await getMatchWithAnalysis(matchData.id);
  const predictions = await getPredictionsForMatchWithDetails(matchData.id);
  // ...
}
```

**After (optimized):**
```typescript
// src/app/leagues/[slug]/[match]/page.tsx
export const revalidate = 60; // ✅ Enable ISR with 60s revalidation
// Remove: export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, match } = await params;

  // Stage 1: Critical path (match existence + competition config)
  const competitionConfig = getCompetitionByIdOrAlias(slug);
  const competitionSlug = competitionConfig?.id || slug;
  const result = await getMatchBySlug(competitionSlug, match);

  if (!result) notFound();

  const { match: matchData, competition } = result;
  const isFinished = matchData.status === 'finished';
  const isLive = matchData.status === 'live';

  // Stage 2: Parallel fetch all remaining data
  const [
    analysisData,
    predictions,
    matchEvents,
    teamStandings,
    nextMatches,
    roundup
  ] = await Promise.all([
    getMatchWithAnalysis(matchData.id),
    getPredictionsForMatchWithDetails(matchData.id),
    (isFinished || isLive) && matchData.externalId
      ? getMatchEvents(parseInt(matchData.externalId, 10))
      : Promise.resolve([]),
    getStandingsForTeams(competition.apiFootballId, [matchData.homeTeam, matchData.awayTeam], competition.season)
      .catch(() => []), // Graceful failure
    getNextMatchesForTeams([matchData.homeTeam, matchData.awayTeam], 4)
      .catch(() => []),
    isFinished ? getMatchRoundup(matchData.id).catch(() => null) : Promise.resolve(null)
  ]);

  // Rest of component...
}
```

**Impact:** TTFB reduced from ~800ms to <200ms (cached), data fetching time reduced from 1000ms+ to ~300ms (parallelized).

### Example 2: Redis Cache Hit Rate Monitoring

```typescript
// src/app/api/admin/cache-stats/route.ts
import { getRedis } from '@/lib/cache/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not available' }, { status: 503 });
  }

  try {
    const info = await redis.info('stats');

    // Parse INFO output
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;

    return NextResponse.json({
      hits,
      misses,
      total,
      hitRate: `${hitRate}%`,
      target: '70%+',
      status: parseFloat(hitRate.toString()) >= 70 ? 'healthy' : 'needs-optimization'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
```

**Usage:** `curl https://kroam.xyz/api/admin/cache-stats` to check current cache performance.

### Example 3: Conditional Fetch Revalidation (Future Enhancement)

```typescript
// src/lib/db/queries.ts - Enhanced getMatchWithAnalysis
export async function getMatchWithAnalysis(matchId: string) {
  const db = getDb();

  // First, get match to determine status
  const matchResult = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchResult.length === 0) return null;

  const match = matchResult[0];

  // Determine revalidation based on status
  const revalidateSeconds =
    match.status === 'live' ? 30 :
    match.status === 'scheduled' ? 60 :
    3600; // finished

  // Apply to cache TTL
  return withCache(
    cacheKeys.matchWithAnalysis(matchId),
    revalidateSeconds,
    async () => {
      // Fetch analysis + competition in parallel
      const [analysisResult, competitionResult] = await Promise.all([
        db.select().from(matchAnalysis).where(eq(matchAnalysis.matchId, matchId)).limit(1),
        db.select().from(competitions).where(eq(competitions.id, match.competitionId))
      ]);

      return {
        match,
        analysis: analysisResult[0] || null,
        competition: competitionResult[0]
      };
    }
  );
}
```

**Note:** This shows per-data revalidation approach. Page-level ISR can only have one fixed `revalidate` export value.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router getServerSideProps | App Router Server Components | Next.js 13 (2022) | Native streaming, parallel fetching, automatic memoization |
| Manual fetch deduplication | Automatic request memoization | Next.js 13+ | No manual caching needed for GET requests |
| force-dynamic for freshness | ISR with revalidate intervals | Next.js 13.4+ | 10-50× TTFB improvement with same freshness |
| Manual Promise orchestration | Better-all / Suspense | React 18+ / Next.js 14+ | Streaming HTML, better perceived performance |
| Client-side data fetching | Server Components + Suspense | Next.js 13+ App Router | Eliminates waterfall cascades, reduces client JS |
| Redis cache handler | Built-in Data Cache | Next.js 13+ | Simpler cache strategy (but Redis still valuable for origin layer) |
| Static Export with getStaticProps | ISR with background regeneration | Next.js 9.5+ (2020) | Fresh data without rebuild |

**Deprecated/outdated:**
- **`getServerSideProps` / `getStaticProps`**: Replaced by Server Components with fetch caching in App Router
- **Manual request deduplication**: Automatic with fetch() in Server Components
- **force-dynamic for all pages**: Use per-fetch `cache: 'no-store'` for specific requests instead
- **Blocking getStaticProps revalidation**: ISR now revalidates in background (stale-while-revalidate)

## Open Questions

Things that couldn't be fully resolved:

1. **Conditional page-level revalidation based on match status**
   - What we know: Next.js `export const revalidate` must be a static number; cannot be dynamic based on data
   - What's unclear: Best workaround for varying revalidation needs (live: 30s, scheduled: 60s, finished: 3600s)
   - Recommendation: Start with conservative 60s for all matches, then add on-demand revalidation via webhook when match finishes (sets to 3600s cache). Per-fetch revalidation in queries is possible but requires significant refactoring.

2. **Cache warming strategy for ISR pages**
   - What we know: ISR generates pages on first request; subsequent requests served from cache
   - What's unclear: Whether to pre-warm upcoming match pages before kickoff, or accept cold-start penalty
   - Recommendation: Monitor "cache miss" latency in production. If P95 TTFB exceeds 400ms on first request, implement cache warming script that fetches upcoming matches 1 hour before kickoff.

3. **CDN cache purging for on-demand revalidation**
   - What we know: `revalidatePath()` invalidates Next.js cache but not external CDN cache
   - What's unclear: Deployment platform (Vercel auto-handles, self-hosted requires manual Cloudflare API calls)
   - Recommendation: If deploying to Vercel, `revalidatePath()` sufficient. If self-hosted with Cloudflare, add Cloudflare API call after `revalidatePath()`. Test with curl to verify cache headers.

4. **Redis cache hit rate baseline**
   - What we know: Industry standard is 80-90% hit rate; project targets 70%+
   - What's unclear: Current hit rate unknown (no monitoring endpoint)
   - Recommendation: Implement `/api/admin/cache-stats` endpoint (see Code Examples) and measure for 1 week baseline. If <70%, investigate: (a) TTL too short, (b) cache keys not consistent, (c) low traffic volume.

## Sources

### Primary (HIGH confidence)
- [Next.js ISR Official Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration) - Official documentation
- [Next.js Data Fetching Patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns) - Parallel fetching guidance
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching) - Four cache layers explained
- [Next.js Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) - Performance best practices

### Secondary (MEDIUM confidence)
- [Catch Metrics: The Ultimate Guide to improving Next.js TTFB slowness: From 800ms to <100ms](http://www.catchmetrics.io/blog/the-ultimate-guide-to-improving-nextjs-ttfb-slowness-from-800ms-to-less100ms) - TTFB optimization techniques
- [When to Use SSR, SSG, or ISR in Next.js | 2026](https://bitskingdom.com/blog/nextjs-when-to-use-ssr-vs-ssg-vs-isr/) - Rendering strategy comparison
- [Redis Caching Strategies: Next.js Production Guide 2025](https://www.digitalapplied.com/blog/redis-caching-strategies-nextjs-production) - Redis + Next.js integration
- [Why your cache hit ratio strategy needs an update](https://redis.io/blog/why-your-cache-hit-ratio-strategy-needs-an-update/) - Redis monitoring best practices
- [Next.js Caching and Rendering: Complete Guide for 2026](https://dev.to/marufrahmanlive/nextjs-caching-and-rendering-complete-guide-for-2026-ij2) - Cache layer interactions

### Tertiary (LOW confidence - WebSearch only)
- [Promise.all in the Next.js App Router - Drew Bredvick](https://drew.tech/posts/promise-all-in-nextjs-app-router) - Parallel fetching examples
- [Why Your Next.js Cache Isn't Working (And How to Fix It in 2026)](https://dev.to/pockit_tools/why-your-nextjs-cache-isnt-working-and-how-to-fix-it-in-2026-10pp) - Common caching mistakes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used correctly
- Architecture patterns: HIGH - Next.js official docs + verified in Next.js 15/16 source code
- Parallel fetching: HIGH - JavaScript Promise.all is well-established pattern
- ISR configuration: HIGH - Official Next.js documentation
- Conditional revalidation: MEDIUM - Workaround patterns from community, not official feature
- Redis optimization: HIGH - Project has mature Redis implementation
- Cache hit rate targets: HIGH - Industry standards from Redis official blog

**Research date:** 2026-02-02
**Valid until:** 60 days (March 2026) - Next.js moves fast but ISR is stable feature; revalidate in 2 months or when Next.js 17 ships
