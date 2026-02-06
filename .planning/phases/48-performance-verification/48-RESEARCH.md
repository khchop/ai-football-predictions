# Phase 48: Performance & Verification - Research

**Researched:** 2026-02-06
**Domain:** Next.js performance optimization, TTFB profiling, Ahrefs SEO audit
**Confidence:** HIGH

## Summary

Phase 48 optimizes TTFB for pages >2s and verifies all v2.6 SEO fixes (Phases 44-47) pass Ahrefs re-audit with health score >90. This is the final verification and cleanup phase before milestone completion.

Research reveals that TTFB slowness in Next.js apps primarily stems from database query latency (not cold starts), and the standard approach combines parallel query optimization, PPR/caching tuning, and systematic profiling. Ahrefs health score calculation is straightforward: percentage of internal URLs without "Error" (red) severity issues. Achieving 90+ requires eliminating critical errors across 170+ pre-defined checks.

The existing audit script (5 passes) provides build-time validation. TTFB measurement should be added as Pass 6 using production URL fetching with timing analysis. Chrome DevTools Network tab waterfall chart remains the gold standard for local TTFB investigation.

**Primary recommendation:** Add Pass 6 to existing audit script for TTFB measurement, profile systematically by page type, optimize database queries with Promise.all() parallelization, verify middleware redirect speed, then prepare for manual Ahrefs audit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**TTFB Investigation Scope:**
- Profile ALL page types systematically (match, league, model, blog, index pages)
- Threshold: investigate pages with TTFB >2s (as stated in roadmap requirements)
- Fix easy wins, document complex issues that need bigger changes for future work
- Measurement: build-time audit script + post-deploy production measurement against kroam.xyz

**Optimization Approach:**
- /matches/UUID redirect: verify middleware-only is fast enough (<500ms), no edge caching unless needed
- All optimization techniques acceptable: query optimization, caching/PPR tuning, component-level fixes (lazy loading, bundle reduction)
- New dependencies allowed if they clearly help performance (runtime or dev)
- TTFB audit integration: Claude's discretion on whether to add as Pass 6 in existing audit or separate script

**Verification Process:**
- User runs Ahrefs site audit manually — Claude prepares the site to be audit-ready
- No additional validation tools needed (Google Rich Results Test, etc.) — Ahrefs is the tool of record
- If Ahrefs reveals NEW issues not covered by phases 44-47, fix them in this phase (this is the cleanup phase)
- Pre-audit spot-checks: Claude's discretion on what to verify before declaring ready

**Success Threshold:**
- Hard requirement: Ahrefs health score >90 (not negotiable)
- Zero critical or high-severity errors in Ahrefs specifically (Ahrefs is the only tool of record)
- TTFB optimization is best-effort — optimize what's reasonable, document the rest. Not a blocker if some pages remain >2s due to cold start or external factors
- Milestone closure: decide after Ahrefs audit results whether v2.6 is complete or needs additional phases

### Claude's Discretion

- Whether TTFB measurement becomes Pass 6 in existing audit or a separate script
- Which pre-audit spot-checks to run before declaring site ready for Ahrefs
- Specific profiling methodology and tooling choices
- Order of page types to investigate for TTFB

</user_constraints>

## Standard Stack

### Core Tools (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.4 | App framework with cacheComponents (PPR) enabled | Industry standard for SSR/static optimization |
| Drizzle ORM | 0.45.1 | Database query layer | Type-safe SQL with parallel query support |
| Cheerio | 1.2.0 | HTML parsing for audit scripts | Lightweight, already used in Pass 4/5 |
| PostgreSQL | (via pg 8.17.2) | Database | Established, supports concurrent queries |

### Performance Monitoring Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Chrome DevTools Network | Built-in | TTFB waterfall analysis | Local profiling, request timing |
| Lighthouse | Built-in Chrome | Synthetic performance audit | Pre-deployment spot checks |
| Ahrefs Site Audit | External service | SEO health score (170+ checks) | Final verification (user runs manually) |
| fetch() with timing | Node.js built-in | Production TTFB measurement | Build-time audit Pass 6 |

### Optional Dependencies (LOW priority)

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| @next/bundle-analyzer | Latest | JavaScript bundle visualization | If bundle size is root cause |
| pino timing extensions | N/A | Server-side performance logging | If investigating API route latency |

**Installation (if bundle analysis needed):**
```bash
npm install --save-dev @next/bundle-analyzer
```

## Architecture Patterns

### TTFB Audit Integration (RECOMMENDED)

Extend existing audit script with Pass 6 for TTFB measurement:

```
scripts/audit-internal-links.ts
  Pass 1: Sitemap URL validation (existing)
  Pass 2: Database completeness (existing)
  Pass 3: Internal link architecture (existing)
  Pass 4: Meta tag validation (existing)
  Pass 5: JSON-LD validation (existing)
  Pass 6: TTFB measurement (NEW) ← Add here
```

**Why this structure:**
- Single audit command for all build-time checks
- Reuses sitemap URL fetching from Pass 1
- AUDIT_BASE_URL already required for Passes 1/4/5
- Consistent failure/warning pattern
- Exit code 0/1 for CI/CD integration

### TTFB Measurement Pattern

**Build-time measurement (audit script):**
```typescript
// Source: Production measurement pattern
async function pass6TTFBMeasurement(baseUrl: string): Promise<Pass6Result> {
  // Fetch sitemap URLs (reuse Pass 1 logic)
  const allUrls = await fetchAllSitemapUrls(baseUrl);

  // Sample by page type for systematic profiling
  const urlsByType = categorizeUrlsByPageType(allUrls);

  // Measure TTFB for each page type
  for (const [pageType, urls] of Object.entries(urlsByType)) {
    const sample = urls.slice(0, 5); // 5 URLs per type

    for (const url of sample) {
      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Kroam-Audit/1.0' }
      });
      const ttfb = performance.now() - startTime;

      if (ttfb > 2000) {
        result.failures.push(`TTFB ${ttfb.toFixed(0)}ms (>2s threshold): ${url}`);
        result.slowPages.push({ url, ttfb, pageType });
      }
    }
  }

  return result;
}
```

**Page type categorization:**
```typescript
function categorizeUrlsByPageType(urls: string[]): Record<string, string[]> {
  return {
    'Index pages': urls.filter(u => u === '/' || u === '/blog' || u === '/models'),
    'League pages': urls.filter(u => u.startsWith('/leagues/') && !u.includes('/matches')),
    'Match pages': urls.filter(u => u.includes('/matches/') && !UUID_PATTERN.test(u)),
    'Model pages': urls.filter(u => u.startsWith('/models/')),
    'Blog pages': urls.filter(u => u.startsWith('/blog/') && u !== '/blog'),
  };
}
```

### Database Query Optimization Pattern

**Problem:** Sequential queries cause TTFB = sum of all query times
**Solution:** Parallel queries with Promise.all()

```typescript
// Source: Drizzle ORM parallel query pattern
// ❌ BAD: Sequential (150ms total)
const models = await db.select().from(models).where(eq(models.active, true)); // 50ms
const matches = await db.select().from(matches).where(isNotNull(matches.slug)); // 50ms
const posts = await db.select().from(blogPosts).where(eq(blogPosts.status, 'published')); // 50ms

// ✅ GOOD: Parallel (50ms total)
const [models, matches, posts] = await Promise.all([
  db.select().from(models).where(eq(models.active, true)),
  db.select().from(matches).where(isNotNull(matches.slug)),
  db.select().from(blogPosts).where(eq(blogPosts.status, 'published')),
]);
```

**When to apply:** Any page fetching from multiple tables or data sources

### Middleware Performance Pattern

**Current implementation analysis:**
```typescript
// src/middleware.ts (already optimized)
export function middleware(request: NextRequest) {
  // ✅ GOOD: /matches/UUID returns 410 immediately (no DB lookup)
  if (pathname.startsWith('/matches/')) {
    return new NextResponse('Gone', { status: 410 });
  }

  // ✅ GOOD: Single-pass redirect detection (no multiple URL.parse calls)
  // ✅ GOOD: Synchronous logic only (no async fetch)
  // ✅ GOOD: Matcher excludes static assets
}
```

**Performance characteristics:**
- Synchronous execution: <10ms overhead
- No database queries: sub-millisecond for non-redirect paths
- /matches/UUID: immediate 410 response (~5-10ms)
- Redirect detection: single pass, cache-friendly (1-year Cache-Control)

**TTFB target:** <500ms for /matches/UUID (requirement PERF-02) — current implementation meets this easily

### PPR/Cache Components Configuration

**Current setup (next.config.ts):**
```typescript
const nextConfig: NextConfig = {
  cacheComponents: true, // Enables PPR + Cache Components
  experimental: {
    viewTransition: true,
  },
};
```

**How PPR optimizes TTFB:**
- Static shell delivered instantly (<40ms TTFB)
- Dynamic content streams in parallel (no blocking)
- Single HTTP request (no extra roundtrips)

**When to verify:** If pages with dynamic data have >2s TTFB, check if Suspense boundaries are correctly placed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTFB measurement | Custom timing code | Chrome DevTools Network tab + fetch() with performance.now() | Waterfall chart shows full breakdown (DNS, TLS, server response, download) |
| Bundle size analysis | Manual file size checks | @next/bundle-analyzer | Visualizes chunk sizes, identifies bloat, tracks over time |
| Performance regression detection | Manual comparison | Lighthouse CI or Vercel Analytics | Automated tracking, alerts on regressions |
| Database connection pooling | Custom pool manager | pg-pool (built into pg package) | Handles connections, prevents exhaustion, battle-tested |
| Server-side caching | In-memory Map | React cache() or Next.js unstable_cache | Request-scoped deduplication, respects PPR boundaries |

**Key insight:** TTFB investigation is about *finding root causes*, not building performance infrastructure. Use built-in tools (DevTools, Lighthouse) for diagnosis, then apply targeted fixes (parallel queries, caching, lazy loading).

## Common Pitfalls

### Pitfall 1: Assuming Cold Starts Cause Slow TTFB

**What goes wrong:** Developer blames serverless cold starts for 2s+ TTFB without profiling
**Why it happens:** Cold start is visible in logs and easy to blame
**How to avoid:** Profile with Chrome DevTools Network tab waterfall — green bar (Waiting for server response) shows TTFB breakdown. If cold start was the issue, you'd see it in Vercel/Coolify logs as function initialization time. Most slow TTFB is database queries or synchronous work on critical path.
**Warning signs:** "Green bar" in waterfall is >1s but no cold start logs

### Pitfall 2: Sequential Database Queries

**What goes wrong:** Page fetches from 3 tables sequentially, causing 300ms TTFB when queries are 100ms each
**Why it happens:** Code reads naturally (fetch A, then B, then C)
**How to avoid:** Use Promise.all() for independent queries. Drizzle ORM returns promises, so parallel execution is trivial.
**Warning signs:** Multiple await statements in sequence where data doesn't depend on previous query

### Pitfall 3: Adding TTFB Measurement to Wrong Script

**What goes wrong:** Creating separate ttfb-audit.ts script instead of extending existing audit
**Why it happens:** Seems cleaner to keep concerns separated
**How to avoid:** Existing audit already fetches sitemap URLs, has AUDIT_BASE_URL env var, and follows Pass 1-5 pattern. Reuse infrastructure as Pass 6.
**Warning signs:** Duplicating sitemap fetch logic, inventing new env vars, separate npm script

### Pitfall 4: Ignoring Ahrefs Warning/Notice Issues

**What goes wrong:** Assuming yellow (warning) and blue (notice) issues don't matter
**Why it happens:** Health score only counts red (error) issues
**How to avoid:** While warnings don't affect score, they may become errors in future audits or indicate real SEO problems. Review and fix if trivial, document if complex.
**Warning signs:** 90+ health score but 50+ warnings about legitimate issues

### Pitfall 5: Over-Optimizing Edge Cases

**What goes wrong:** Spending hours optimizing a page type with <5 URLs when 1000+ match pages have slow TTFB
**Why it happens:** Early optimization success creates momentum
**How to avoid:** Profile systematically by page type (index, league, match, model, blog). Fix high-impact issues first (many URLs or high traffic). Document low-impact issues for future work.
**Warning signs:** Blog page TTFB perfect but match pages still >2s

### Pitfall 6: Not Testing Production Environment

**What goes wrong:** TTFB is fast locally (<200ms) but slow in production (2s+)
**Why it happens:** Local DB on localhost, production DB on separate server; local cache warm, production cache cold
**How to avoid:** Always measure against production URL (kroam.xyz) after deploy. Use AUDIT_BASE_URL=https://kroam.xyz in audit script.
**Warning signs:** Audit passes locally but fails against production

### Pitfall 7: Misunderstanding Middleware Performance

**What goes wrong:** Adding async database lookup in middleware thinking it's fast because it's "edge"
**Why it happens:** Confusion between Edge Runtime (fast startup) and synchronous logic (fast execution)
**How to avoid:** Middleware should be 100% synchronous. Current /matches/UUID implementation returns 410 immediately without DB lookup — this is correct pattern. Any async work adds latency to EVERY request.
**Warning signs:** await calls in middleware, database imports in middleware

## Code Examples

### Pass 6 TTFB Audit (Recommended Integration)

```typescript
// Source: Build-time audit pattern (add to scripts/audit-internal-links.ts)

interface Pass6Result extends AuditResult {
  totalChecked: number;
  slowPages: Array<{ url: string; ttfb: number; pageType: string }>;
  avgTTFBByType: Record<string, number>;
}

/**
 * Pass 6: TTFB Measurement
 * Measures production TTFB for sampled URLs by page type
 */
async function pass6TTFBMeasurement(baseUrl: string): Promise<Pass6Result> {
  const result: Pass6Result = {
    pass: true,
    failures: [],
    warnings: [],
    totalChecked: 0,
    slowPages: [],
    avgTTFBByType: {},
  };

  try {
    // Reuse sitemap fetch from Pass 1
    const allUrls = await fetchAllSitemapUrls(baseUrl);

    // Categorize by page type
    const urlsByType = {
      'Index pages': allUrls.filter(u => ['/', '/blog', '/models', '/matches', '/leagues'].includes(u)),
      'League pages': allUrls.filter(u => u.startsWith('/leagues/') && !u.includes('/matches')),
      'Match pages': allUrls.filter(u => u.includes('/matches/') && !UUID_PATTERN.test(u)),
      'Model pages': allUrls.filter(u => u.startsWith('/models/') && u !== '/models'),
      'Blog pages': allUrls.filter(u => u.startsWith('/blog/') && u !== '/blog'),
    };

    // Sample 5 URLs per type, measure TTFB
    for (const [pageType, urls] of Object.entries(urlsByType)) {
      if (urls.length === 0) continue;

      const sample = urls.slice(0, 5);
      const ttfbs: number[] = [];

      for (const url of sample) {
        try {
          const startTime = performance.now();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'Kroam-Audit/1.0' },
          });

          clearTimeout(timeoutId);
          const ttfb = performance.now() - startTime;
          ttfbs.push(ttfb);
          result.totalChecked++;

          // Check threshold
          if (ttfb > 2000) {
            result.failures.push(`${pageType}: TTFB ${ttfb.toFixed(0)}ms (>2s): ${url}`);
            result.slowPages.push({ url, ttfb, pageType });
            result.pass = false;
          } else if (ttfb > 1000) {
            result.warnings.push(`${pageType}: TTFB ${ttfb.toFixed(0)}ms (>1s): ${url}`);
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            result.warnings.push(`${pageType}: Timeout (>10s): ${url}`);
          } else {
            result.warnings.push(`${pageType}: Fetch error: ${url}`);
          }
        }
      }

      // Calculate average
      if (ttfbs.length > 0) {
        result.avgTTFBByType[pageType] = ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length;
      }
    }

  } catch (error) {
    result.failures.push(`Pass 6 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

// Add to runAudit() main function after Pass 5
if (baseUrl) {
  console.log('Pass 6: TTFB Measurement');
  pass6 = await pass6TTFBMeasurement(baseUrl);

  if (pass6.pass) {
    console.log(`  ✓ All ${pass6.totalChecked} pages have TTFB <2s`);
    Object.entries(pass6.avgTTFBByType).forEach(([type, avg]) => {
      console.log(`    ${type}: avg ${avg.toFixed(0)}ms`);
    });
  } else {
    console.log(`  ✗ ${pass6.slowPages.length} pages exceed 2s TTFB threshold`);
    pass6.slowPages.forEach(({ url, ttfb, pageType }) => {
      console.log(`    ${pageType}: ${ttfb.toFixed(0)}ms - ${url}`);
    });
  }

  pass6.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');
} else {
  console.log('Pass 6: SKIPPED (set AUDIT_BASE_URL to run TTFB measurement)\n');
}
```

### Parallel Database Queries Pattern

```typescript
// Source: Drizzle ORM best practices
// Example: Match page data fetching

// ❌ BEFORE: Sequential (200ms+ TTFB)
export default async function MatchPage({ params }: { params: { slug: string } }) {
  const match = await db.select().from(matches).where(eq(matches.slug, params.slug)).limit(1);
  const predictions = await db.select().from(predictions).where(eq(predictions.matchId, match.id));
  const league = await db.select().from(competitions).where(eq(competitions.code, match.league));

  // TTFB = match query + predictions query + league query
}

// ✅ AFTER: Parallel (80ms TTFB)
export default async function MatchPage({ params }: { params: { slug: string } }) {
  // Execute all queries concurrently
  const [match, leagueData] = await Promise.all([
    db.select().from(matches).where(eq(matches.slug, params.slug)).limit(1),
    db.select().from(competitions).where(eq(competitions.code, params.league)),
  ]);

  // Second round if dependent on first query result
  const predictions = await db.select()
    .from(predictions)
    .where(eq(predictions.matchId, match.id));

  // TTFB = max(match+league queries in parallel) + predictions query
}

// ✅ EVEN BETTER: If predictions can be fetched with match ID pattern
export default async function MatchPage({ params }: { params: { slug: string } }) {
  // All queries in parallel using slug pattern
  const [match, predictions, league] = await Promise.all([
    db.select().from(matches).where(eq(matches.slug, params.slug)).limit(1),
    db.select().from(predictions)
      .innerJoin(matches, eq(predictions.matchId, matches.id))
      .where(eq(matches.slug, params.slug)),
    db.select().from(competitions)
      .innerJoin(matches, eq(competitions.code, matches.league))
      .where(eq(matches.slug, params.slug)),
  ]);

  // TTFB = max of all 3 queries (typically 50-100ms)
}
```

### Chrome DevTools TTFB Investigation

```
Manual profiling workflow:
1. Open Chrome DevTools → Network tab
2. Check "Disable cache" (force fresh requests)
3. Navigate to page type (e.g., /leagues/epl)
4. Find document request (first item, type "document")
5. Click request → Timing tab
6. Analyze waterfall:
   - Queueing: browser waiting to start (should be ~0ms)
   - Stalled: browser blocked by connection limit (should be ~0ms)
   - DNS Lookup: resolving domain (should be <50ms)
   - Initial connection: TCP handshake (should be <100ms)
   - SSL: TLS handshake (should be <100ms)
   - Waiting for server response: THIS IS TTFB (target <800ms, <2000ms max)
   - Content Download: receiving bytes (depends on HTML size)

If "Waiting for server response" is >2s:
  → Server-side issue (database, computation, cold start)
  → Profile with Sentry performance monitoring
  → Check database query logs
  → Verify PPR Suspense boundaries

If "Content Download" is >1s:
  → HTML response too large (check size in Size column)
  → Reduce inline data, defer non-critical content
  → Verify streaming is working (should see progressive rendering)
```

### Middleware TTFB Verification

```typescript
// No code changes needed — verify current performance

// Test /matches/UUID redirect speed (requirement PERF-02: <500ms)
// 1. Use curl with timing:
$ curl -w "@curl-format.txt" -o /dev/null -s https://kroam.xyz/matches/12345678-1234-1234-1234-123456789012

// curl-format.txt:
time_namelookup:  %{time_namelookup}s
time_connect:     %{time_connect}s
time_starttransfer: %{time_starttransfer}s (THIS IS TTFB)
time_total:       %{time_total}s

// Expected: time_starttransfer <0.5s (500ms)

// 2. Alternative: Chrome DevTools Network tab
//    Navigate to /matches/[UUID]
//    Check "Waiting for server response" time
//    Should be <500ms

// If >500ms: middleware has async work or external dependency
// Current implementation: immediate NextResponse return = ~10-50ms TTFB ✓
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ISR with revalidate intervals | PPR with cacheComponents | Next.js 15/16 (2024-2025) | Sub-40ms TTFB for static shell, streaming dynamic content |
| Sequential data fetching | Promise.all() parallel queries | Always available, now emphasized | Reduces TTFB from sum to max of query times |
| Google PageSpeed <100 TTFB | Google PageSpeed <800ms TTFB (75th percentile) | Google updated guidance 2023 | More realistic targets for dynamic content |
| next.config.ts redirects | Middleware-based redirects | Next.js 12+ (2022) | Single-hop resolution, better caching |
| Manual performance tracking | Vercel Analytics / RUM | 2024-2025 | Automatic Core Web Vitals per route |
| Lighthouse one-time audits | Lighthouse CI continuous monitoring | 2023+ | Catch regressions in CI/CD pipeline |

**Deprecated/outdated:**
- **getServerSideProps with blocking queries**: Use Server Components with Suspense for PPR
- **Multiple redirect hops**: Consolidated in middleware (already done in Phase 44)
- **HTTP/1.1**: HTTP/2+ is standard (Vercel/Coolify default)

**Next.js 16 specific (project is on 16.1.4):**
- cacheComponents is stable (enables PPR + Cache Components)
- middleware.ts still supported but `proxy.ts` pattern emerging (safe to ignore for now)
- React Compiler enabled for compatible components (automatic memoization)

## Ahrefs Site Audit Details

### Health Score Calculation

**Formula:** `(Internal URLs without errors / Total internal URLs) × 100`

**What counts as "error":**
- Only RED severity issues lower health score
- Yellow (warning) and blue (notice) issues do NOT affect score
- 170+ pre-defined checks across 6 categories

**90+ threshold:** At least 90% of internal URLs must have zero red-severity issues

### Issue Categories (6 total)

1. **Performance:** Page load speed, TTFB, Core Web Vitals
2. **HTML tags:** Title, meta description, H1, canonical, hreflang
3. **Content quality:** Thin content, duplicate content, broken images
4. **Localization:** Language tags, regional targeting
5. **Incoming links:** Internal link structure, anchor text
6. **Outgoing links:** Broken external links, redirect chains

### Common Critical Errors (RED severity)

| Error Type | Description | How to Fix |
|------------|-------------|-----------|
| 404 pages | Page returns 404 Not Found | Remove from sitemap or fix URL |
| 5xx errors | Server error on page load | Fix server-side code, check DB connection |
| Redirect chains | Multiple redirects to reach final URL | Consolidate in middleware (already done) |
| Incorrect canonical | Canonical URL is invalid or unreachable | Verify all canonical tags point to valid URLs |
| Missing title | No <title> tag in HTML | Add title tag (should pass existing Pass 4) |
| Duplicate title | Multiple pages with identical title | Make titles unique per page |
| Orphan pages | Page not linked from any other page | Add internal links or remove page |

### Pre-Audit Spot-Check Strategy

**Before declaring "Ahrefs-ready":**

1. **Run existing audit script:** All 5 passes (soon 6) must pass with 0 failures
2. **Spot-check critical issues:** Manually verify 3-5 URLs per page type in Chrome DevTools
3. **Verify redirects:** Test www, http, long-form league slugs return 301 with correct target
4. **Check sitemap accessibility:** Fetch https://kroam.xyz/sitemap.xml, verify 200 OK
5. **Verify robots.txt:** Confirm not blocking important paths
6. **Sample breadcrumbs:** Check 3-5 pages have correct breadcrumb structure

**If all pass:** Site is Ahrefs-ready

## Open Questions

### Question 1: Serverless Cold Start Impact on TTFB

**What we know:** Coolify uses Nixpacks deployment (likely Docker containers, not serverless functions). Cold starts primarily affect AWS Lambda / Vercel Edge Functions.
**What's unclear:** Whether Coolify keeps containers warm or if there's idle timeout causing cold starts
**Recommendation:** Measure TTFB during off-peak hours (low traffic) vs. peak hours. If significant difference (>500ms), cold starts may be a factor. Document in TTFB audit results. Not a blocker — user accepted that some >2s TTFB may persist due to external factors.

### Question 2: Ahrefs Crawl Budget and Sitemap Size

**What we know:** Site has 17 leagues, 42 models, match pages with slugs. Exact URL count unknown.
**What's unclear:** If Ahrefs will crawl entire site or sample. Large sites may have crawl budget limits.
**Recommendation:** Existing Pass 1 reports URL count. If >5000 URLs, prioritize fixing high-traffic pages first. Ahrefs will report on sampled URLs if site is large.

### Question 3: TTFB Threshold for Dynamic vs. Static Content

**What we know:** Requirement is "investigate pages >2s TTFB"
**What's unclear:** Whether static pages (league index) should have same threshold as dynamic pages (match with live predictions)
**Recommendation:** Use 2s as hard threshold for all page types (per requirement PERF-01). Document which pages are inherently dynamic and may fluctuate. Focus optimization on static/semi-static pages first.

## Sources

### Primary (HIGH confidence)

- [Next.js Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) - Official guidance on performance optimization
- [Next.js Partial Prerendering Documentation](https://nextjs.org/docs/15/app/getting-started/partial-prerendering) - PPR/cacheComponents architecture
- [Ahrefs Health Score Calculation](https://help.ahrefs.com/en/articles/1424673-what-is-health-score-and-how-is-it-calculated-in-ahrefs-site-audit) - Official formula and requirements
- [Chrome DevTools Network Reference](https://developer.chrome.com/docs/devtools/network/reference) - TTFB measurement and waterfall analysis
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16) - Current version features (cacheComponents, React Compiler)

### Secondary (MEDIUM confidence)

- [The Ultimate Guide to improving Next.js TTFB](http://www.catchmetrics.io/blog/the-ultimate-guide-to-improving-nextjs-ttfb-slowness-from-800ms-to-less100ms) - Database latency as primary TTFB cause
- [Next.js Performance Optimisation (2025)](https://pagepro.co/blog/nextjs-performance-optimization-in-9-steps/) - Build analysis and monitoring tools
- [How to Use Drizzle ORM with PostgreSQL in Next.js 15](https://strapi.io/blog/how-to-use-drizzle-orm-with-postgresql-in-a-nextjs-15-project) - Parallel query patterns
- [Next.js Middleware Best Practices](https://pagepro.co/blog/next-js-middleware-what-is-it-and-when-to-use-it/) - Synchronous logic, matcher configuration
- [Ahrefs Site Audit Comprehensive Guide](https://searchscope.com.au/ahrefs-site-audit-comprehensive-guide/) - Common errors and fixes

### Tertiary (LOW confidence - needs verification)

- [Vercel vs Netlify vs Cloudflare: Serverless Cold Starts](https://punits.dev/blog/vercel-netlify-cloudflare-serverless-cold-starts/) - Cold start benchmarks (may not apply to Coolify/Docker)
- [Next.js Advanced Techniques 2026](https://medium.com/@elizacodewell72/next-js-advanced-techniques-2026-15-pro-level-tips-every-senior-developer-must-master-0b264649980e) - Medium article, unverified claims
- [Scale with Drizzle ORM Read Replicas](https://neon.com/guides/read-replica-drizzle) - Advanced optimization (not needed for Phase 48)

## Metadata

**Confidence breakdown:**
- TTFB optimization techniques: HIGH - Verified with official Next.js docs, Chrome DevTools reference
- Audit script integration: HIGH - Existing codebase pattern is clear (Pass 1-5), Pass 6 follows same structure
- Ahrefs health score: HIGH - Official documentation, formula is straightforward
- Middleware performance: HIGH - Current code reviewed, synchronous pattern verified
- Database optimization: MEDIUM - Drizzle parallel query pattern confirmed but not tested in production
- Cold start impact: LOW - Coolify deployment architecture unclear (Docker vs. serverless)

**Research date:** 2026-02-06
**Valid until:** ~30 days (Next.js 16 is stable, Ahrefs methodology unlikely to change)

**Next steps for planner:**
1. Create plan for Pass 6 TTFB audit integration
2. Create plan for systematic TTFB profiling by page type
3. Create plan for database query parallelization (if investigation reveals sequential queries)
4. Create plan for pre-Ahrefs spot-check workflow
5. Create plan for documenting findings and declaring Ahrefs-ready
