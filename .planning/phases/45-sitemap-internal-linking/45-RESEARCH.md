# Phase 45: Sitemap & Internal Linking - Research

**Researched:** 2026-02-06
**Domain:** Next.js 16 sitemap generation, SEO internal linking, build-time validation
**Confidence:** HIGH

## Summary

Phase 45 focuses on improving SEO discoverability through clean sitemaps and strategic internal linking. The project already has a working sitemap implementation using Next.js Route Handlers (not the metadata API), organized as a sitemap index with sub-sitemaps by page type. Research reveals that sitemap `priority` and `changefreq` values are largely ignored by Google in 2026, but `lastmod` timestamps remain valuable. Internal linking best practices emphasize contextual links in main content (not just navigation), with 3+ internal links recommended per page to avoid orphan status. Build-time validation requires custom TypeScript scripts since Next.js lacks native orphan page detection.

**Key findings:**
- Next.js 16 supports both Route Handler (`route.ts`) and Metadata API (`sitemap.ts`) approaches; project uses Route Handlers already
- Google ignores `priority` and `changefreq` in 2026 but respects `lastmod` timestamps
- Orphan pages (< 3 internal links) hurt SEO; manual auditing required via custom scripts
- Cheerio (jQuery-like) is faster than JSDOM for HTML parsing in Node.js build scripts
- Internal links in first 2-3 paragraphs are prioritized by Google

**Primary recommendation:** Enhance existing Route Handler sitemaps with accurate `lastmod` from database, create TypeScript build-time audit script using Cheerio to crawl internal links and validate 3+ links per page, implement cross-linking widgets on model/league/match pages, and create centralized `getInternalUrl()` helper to enforce canonical slug usage.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sitemap structure:**
- Split by page type: separate sitemaps for leagues, models, matches, blog posts, static pages
- Sitemap index at /sitemap.xml referencing all sub-sitemaps
- Use lastmod from most recent prediction or result update timestamp
- Include priority/changefreq values — higher for league hubs and recent matches, lower for old matches and static pages
- Include ALL matches (no time-based filtering) — maximize indexed pages
- No /matches/UUID URLs in any sitemap

**Cross-linking widgets:**
- Model pages link to BOTH recent predictions (match pages) AND leagues covered
- League pages show top 5 most accurate models for that league with links to model pages
- Match pages link to ALL models that made predictions for that match
- Visual style: Claude's discretion based on existing design system and page context

**Orphan page rescue:**
- Link sources for model pages: leaderboard page + /models index + league pages (top-5 section) — covers 3+ inbound links
- Build-time audit script that crawls internal links and reports any page with <3 inbound links
- Audit ALL page types (models, leagues, matches, blog) — not just model pages
- Threshold: 3+ inbound links for all page types — consistent standard

**Link format & slugs:**
- Create centralized link helper (getInternalUrl) for ALL internal link types — not just league slugs
- One-time cleanup: find-and-replace all existing long-form league slugs in source code
- Audit script cross-validates sitemap URLs match canonical slug forms — no redirect-triggering URLs in sitemaps
- Audit script runs as part of build — build fails if orphan pages or bad slugs detected

### Claude's Discretion

- Cross-linking widget visual design (cards, lists, sections — match existing design system)
- Exact number of recent predictions to show on model pages
- Sitemap priority/changefreq exact values per page type
- Internal link audit script implementation approach

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Route Handlers | 16.1.5 | Dynamic sitemap generation | Already implemented, more flexible than Metadata API for complex sitemaps |
| Drizzle ORM | 0.45.1 | Query database for sitemap URLs and lastmod timestamps | Existing project ORM |
| TypeScript | 5.x | Type-safe audit scripts | Project standard |
| tsx | 4.21.0 | Run TypeScript scripts at build time | Already in devDependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cheerio | ^1.0.0 | HTML parsing for link extraction in audit script | Faster than JSDOM for non-JS HTML parsing |
| glob | Built-in Node.js | File system traversal for audit script | Finding all page files to audit |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route Handlers | Metadata API (`sitemap.ts`) | Metadata API is newer but Route Handlers offer more control for complex logic (chunked sitemaps, database queries) |
| cheerio | JSDOM | JSDOM emulates full browser but is slower and heavier; cheerio is sufficient for static HTML parsing |
| Build script | Runtime API endpoint | Build-time validation catches issues before deployment vs. runtime checks catch production issues |

**Installation:**
```bash
npm install cheerio
```

## Architecture Patterns

### Current Sitemap Structure (Already Implemented)

```
src/app/
├── sitemap.xml/route.ts          # Sitemap index
├── sitemap/
│   ├── static.xml/route.ts       # Static pages (missing /models, /leagues index)
│   ├── leagues.xml/route.ts      # League hub pages
│   ├── models.xml/route.ts       # Model pages
│   ├── blog.xml/route.ts         # Blog posts
│   └── matches/[id]/route.ts     # Match pages (chunked, 45k per sitemap)
```

**What's working:** Sitemap index correctly references all sub-sitemaps; matches are chunked to respect Google's 50k URL limit; matches use canonical `/leagues/{slug}/{match}` format (no UUID URLs).

**What needs fixing:**
- `/models` and `/leagues` index pages missing from `static.xml`
- `lastmod` uses `today` for all pages instead of actual update timestamps
- `priority` and `changefreq` values are present but arbitrary (research shows Google ignores these in 2026)

### Pattern 1: Centralized Internal Link Helper

**What:** Single source of truth for generating internal URLs to enforce canonical slug usage.

**When to use:** Everywhere an internal link is generated (components, metadata, sitemaps).

**Example:**
```typescript
// src/lib/navigation/urls.ts
export function getInternalUrl(type: 'league' | 'model' | 'match' | 'blog', params: Record<string, string>): string {
  switch (type) {
    case 'league':
      return `/leagues/${params.slug}`; // Always use canonical short slug
    case 'model':
      return `/models/${params.id}`;
    case 'match':
      return `/leagues/${params.leagueSlug}/${params.matchSlug}`;
    case 'blog':
      return `/blog/${params.slug}`;
    default:
      throw new Error(`Unknown URL type: ${type}`);
  }
}

// Usage in components
<Link href={getInternalUrl('league', { slug: 'epl' })}>Premier League</Link>

// Usage in sitemaps
const urls = leagues.map(league => ({
  url: `${BASE_URL}${getInternalUrl('league', { slug: league.id })}`,
  lastmod: league.updatedAt,
}));
```

### Pattern 2: Cross-Linking Widgets

**What:** Reusable components that show related content with internal links.

**When to use:** On entity pages (model, league, match) to improve discoverability and link equity.

**Example structures:**

**Model page widgets:**
```tsx
// Already exists: <RelatedModelsWidget /> (top 5 models)
// Need to add:
<RecentPredictionsWidget modelId={id} limit={10} />  // Links to match pages
<LeaguesCoveredWidget modelId={id} />                // Links to league pages
```

**League page widgets:**
```tsx
// Already exists: <CompetitionTopModels /> (top 5 models for league)
// Links to model pages — ALREADY IMPLEMENTED ✓
```

**Match page widgets:**
```tsx
// Need to add:
<ModelPredictionsWidget matchId={id} />  // Links to ALL models that predicted this match
```

### Pattern 3: Build-Time Internal Link Audit

**What:** Script that crawls all pages, extracts internal links, and validates each page has 3+ inbound links.

**When to use:** As part of `npm run build` before deployment.

**Example structure:**
```typescript
// scripts/audit-internal-links.ts
import { db } from '@/lib/db';
import { JSDOM } from 'jsdom'; // or cheerio for faster parsing

interface PageLink {
  from: string;
  to: string;
}

async function auditInternalLinks() {
  // 1. Fetch all page URLs from database and sitemap
  const pages = await getAllPageUrls(); // models, leagues, matches, blog

  // 2. For each page, extract internal links
  const links: PageLink[] = [];
  for (const page of pages) {
    const html = await fetchPageHtml(page); // Use Next.js build output or runtime fetch
    const internalLinks = extractInternalLinks(html);
    links.push(...internalLinks.map(to => ({ from: page, to })));
  }

  // 3. Count inbound links per page
  const inboundCounts = countInboundLinks(links);

  // 4. Find orphan pages (< 3 inbound links)
  const orphans = pages.filter(page => inboundCounts[page] < 3);

  // 5. Report and fail build if orphans found
  if (orphans.length > 0) {
    console.error(`Found ${orphans.length} orphan pages with < 3 inbound links:`);
    orphans.forEach(page => console.error(`  - ${page} (${inboundCounts[page]} links)`));
    process.exit(1);
  }

  console.log('✓ All pages have 3+ inbound links');
}
```

**Implementation challenge:** Next.js doesn't provide built-in access to rendered HTML during build. Two approaches:

1. **Static analysis:** Parse TSX/JSX files directly to extract `<Link>` components (fragile, misses dynamic links)
2. **Runtime crawling:** Start dev server, crawl all URLs, parse HTML with Cheerio (slower but accurate)

Recommended: Runtime crawling with Cheerio for accuracy.

### Anti-Patterns to Avoid

- **Hardcoding full URLs in components:** Use `getInternalUrl()` helper instead of string concatenation
- **Long-form slugs in internal links:** Always use canonical short slugs (`epl` not `premier-league`)
- **Mixing sitemap approaches:** Don't combine Route Handlers (`route.ts`) with Metadata API (`sitemap.ts`) — choose one
- **Ignoring lastmod:** Don't use `new Date()` for all pages; fetch actual update timestamps from database
- **Navigation-only internal links:** Google prioritizes contextual links in main content over footer/nav links

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing for link extraction | Regex-based HTML parser | Cheerio or JSDOM | HTML is not regular; regex parsers break on edge cases (nested tags, attributes) |
| Sitemap XML generation | Manual XML string building | Next.js Route Handlers with typed return | Route Handlers auto-generate valid XML; manual strings prone to syntax errors |
| URL slug normalization | Custom slugify with string replacements | Existing `LEAGUE_SLUG_REDIRECTS` in middleware | Already maps aliases to canonical slugs; don't duplicate logic |
| Database timestamp queries | String date manipulation | Drizzle ORM with proper date fields | ORM handles type safety and SQL injection prevention |

**Key insight:** Next.js provides robust sitemap APIs (Route Handlers and Metadata API); don't invent custom XML generation. For link auditing, mature HTML parsers exist; regex HTML parsing is notoriously fragile.

## Common Pitfalls

### Pitfall 1: Using `priority` and `changefreq` as Search Ranking Factors

**What goes wrong:** Developers spend time fine-tuning `priority` values thinking it affects search rankings.

**Why it happens:** Old SEO advice (pre-2015) suggested these tags influenced crawl behavior. Modern search engines (Google, Bing) ignore them.

**How to avoid:** Include `priority` and `changefreq` for spec compliance, but don't expect SEO impact. Focus effort on accurate `lastmod` timestamps and internal linking structure instead.

**Warning signs:** Build logic has complex rules for calculating priority values; team debates "ideal" changefreq for page types.

**Source:** [XML Sitemap Priority & Changefreq Best Practices](https://slickplan.com/blog/xml-sitemap-priority-changefreq) (verified 2026)

### Pitfall 2: Orphan Pages from Missing Internal Links

**What goes wrong:** Pages exist in sitemap but have zero or few internal links, leading to poor discoverability and no search indexing.

**Why it happens:** Teams focus on sitemap coverage but neglect internal link architecture; new page types added without updating cross-linking logic.

**How to avoid:** Implement build-time audit script that fails if any page has < 3 inbound links; mandate internal link widgets on all entity pages.

**Warning signs:** New model pages have no links from leaderboard or league pages; match pages don't link back to models.

**Source:** [Are Orphan Pages the Hidden SEO Problem to Fix in 2026?](https://www.clickrank.ai/orphan-pages-how-to-fix/)

### Pitfall 3: Stale `lastmod` Timestamps

**What goes wrong:** All sitemap entries show same date (today's date) instead of actual content update timestamps, reducing crawl efficiency.

**Why it happens:** Developers use `new Date()` for all entries instead of querying database for actual update times.

**How to avoid:** Join sitemap queries with tables that track updates (e.g., `predictions.updatedAt`, `matches.updatedAt`); use `lastmod` from database, not system time.

**Warning signs:** All sitemap entries have identical `lastmod` values; search console shows frequent re-crawls of unchanged pages.

**Source:** [Lastmod, Priority, and Changefreq - Nuxt Sitemap](https://nuxtseo.com/docs/sitemap/advanced/loc-data)

### Pitfall 4: Inconsistent Slug Usage Triggering Redirects

**What goes wrong:** Internal links use long-form slugs (`/leagues/premier-league`) which trigger 308 redirects to canonical slugs (`/leagues/epl`), wasting crawl budget.

**Why it happens:** Multiple code paths generate URLs (components, sitemaps, metadata) without centralized slug logic; developers copy-paste URLs from browser.

**How to avoid:** Create `getInternalUrl()` helper that enforces canonical slugs; audit all existing code for hardcoded long-form slugs; validate sitemap URLs match canonical forms.

**Warning signs:** Redirect logs show high volume of `/leagues/premier-league` → `/leagues/epl` redirects; search console reports redirect chains.

**Source:** User's existing middleware (`LEAGUE_SLUG_REDIRECTS`) shows this is a known issue.

### Pitfall 5: Build-Time Database Queries with PPR

**What goes wrong:** `generateStaticParams()` with database queries causes build-time failures when database is unavailable during static generation.

**Why it happens:** Next.js Partial Prerendering (PPR) expects static params at build time, but project uses runtime database for dynamic data.

**How to avoid:** Avoid `generateStaticParams()` for database-backed routes; rely on on-demand ISR with revalidation instead; use Route Handlers for sitemaps (dynamic).

**Warning signs:** Build fails with "database connection error"; pages require database access but are marked static.

**Source:** User's league page already removed `generateStaticParams()` for this reason (line 21-22 comment in `src/app/leagues/[slug]/page.tsx`).

## Code Examples

Verified patterns from official sources and existing codebase:

### Sitemap with Accurate lastmod (Route Handler)

```typescript
// src/app/sitemap/models.xml/route.ts
import { BASE_URL } from '@/lib/seo/constants';
import { getDb, models, predictions } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(): Promise<Response> {
  const db = getDb();

  // Join with predictions to get most recent update timestamp per model
  const allModels = await db
    .select({
      id: models.id,
      lastPredictionUpdate: sql<string>`MAX(${predictions.updatedAt})`,
    })
    .from(models)
    .leftJoin(predictions, eq(predictions.modelId, models.id))
    .groupBy(models.id)
    .orderBy(desc(sql`MAX(${predictions.updatedAt})`));

  const urls = allModels.map(model => ({
    url: `${BASE_URL}/models/${model.id}`,
    lastmod: model.lastPredictionUpdate || new Date().toISOString().split('T')[0],
    changefreq: 'daily', // Ignored by Google but included for spec compliance
    priority: 0.7,       // Ignored by Google but included for spec compliance
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

### Cross-Linking Widget for Model Pages

```typescript
// src/components/model/leagues-covered-widget.tsx
import { getDb, predictions, matches, competitions } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { getInternalUrl } from '@/lib/navigation/urls';

interface LeaguesCoveredWidgetProps {
  modelId: string;
}

export async function LeaguesCoveredWidget({ modelId }: LeaguesCoveredWidgetProps) {
  const db = getDb();

  // Get unique competitions this model has predicted
  const leagues = await db
    .selectDistinct({
      id: competitions.id,
      name: competitions.name,
      predictionCount: sql<number>`COUNT(DISTINCT ${predictions.id})`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(predictions.modelId, modelId))
    .groupBy(competitions.id, competitions.name)
    .orderBy(desc(sql`COUNT(DISTINCT ${predictions.id})`))
    .limit(8);

  if (leagues.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Leagues Covered
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {leagues.map(league => (
            <Link
              key={league.id}
              href={getInternalUrl('league', { slug: league.id })}
              className="px-3 py-2 rounded-lg border border-border/50 hover:bg-accent transition-colors text-sm"
            >
              {league.name}
              <span className="text-xs text-muted-foreground ml-2">
                ({league.predictionCount})
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Build-Time Audit Script

```typescript
// scripts/audit-internal-links.ts
import * as cheerio from 'cheerio';
import { getDb, models, matches, blogPosts, competitions } from '@/lib/db';
import { eq, isNotNull } from 'drizzle-orm';

interface Page {
  url: string;
  type: 'model' | 'league' | 'match' | 'blog' | 'static';
}

async function getAllPages(): Promise<Page[]> {
  const db = getDb();
  const pages: Page[] = [];

  // Static pages
  const staticPages = ['/', '/about', '/leaderboard', '/matches', '/blog', '/methodology', '/models', '/leagues'];
  pages.push(...staticPages.map(url => ({ url, type: 'static' as const })));

  // Model pages
  const allModels = await db.select({ id: models.id }).from(models);
  pages.push(...allModels.map(m => ({ url: `/models/${m.id}`, type: 'model' as const })));

  // League pages
  const allLeagues = await db.select({ id: competitions.id }).from(competitions);
  pages.push(...allLeagues.map(l => ({ url: `/leagues/${l.id}`, type: 'league' as const })));

  // Match pages
  const allMatches = await db
    .select({ slug: matches.slug, competitionId: matches.competitionId })
    .from(matches)
    .where(isNotNull(matches.slug));
  pages.push(...allMatches.map(m => ({ url: `/leagues/${m.competitionId}/${m.slug}`, type: 'match' as const })));

  // Blog pages
  const allBlogPosts = await db.select({ slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.status, 'published'));
  pages.push(...allBlogPosts.map(b => ({ url: `/blog/${b.slug}`, type: 'blog' as const })));

  return pages;
}

async function fetchPageHtml(url: string): Promise<string> {
  // Fetch from local Next.js dev server or build output
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}${url}`);
  return response.text();
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Only internal links (relative or same domain)
    if (href.startsWith('/') || href.startsWith(baseUrl)) {
      const path = href.startsWith('/') ? href : new URL(href).pathname;
      links.push(path);
    }
  });

  return links;
}

async function auditInternalLinks() {
  console.log('🔍 Auditing internal links...');

  const pages = await getAllPages();
  console.log(`📄 Found ${pages.length} pages to audit`);

  const inboundLinks: Record<string, Set<string>> = {};
  pages.forEach(page => inboundLinks[page.url] = new Set());

  // For each page, extract links and count inbound
  for (const page of pages) {
    try {
      const html = await fetchPageHtml(page.url);
      const links = extractInternalLinks(html, process.env.BASE_URL || 'http://localhost:3000');

      links.forEach(link => {
        if (inboundLinks[link]) {
          inboundLinks[link].add(page.url);
        }
      });
    } catch (error) {
      console.warn(`⚠️  Failed to fetch ${page.url}: ${error.message}`);
    }
  }

  // Find orphan pages (< 3 inbound links)
  const orphans = pages.filter(page => inboundLinks[page.url].size < 3);

  if (orphans.length > 0) {
    console.error(`\n❌ Found ${orphans.length} orphan pages with < 3 inbound links:\n`);
    orphans.forEach(page => {
      console.error(`  ${page.url} (${inboundLinks[page.url].size} links)`);
      if (inboundLinks[page.url].size > 0) {
        console.error(`    From: ${[...inboundLinks[page.url]].join(', ')}`);
      }
    });
    process.exit(1);
  }

  console.log('✅ All pages have 3+ inbound links');
}

auditInternalLinks().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
```

**Usage in package.json:**
```json
{
  "scripts": {
    "audit:links": "tsx scripts/audit-internal-links.ts",
    "build": "npm run audit:links && next build"
  }
}
```

### Centralized URL Helper

```typescript
// src/lib/navigation/urls.ts
import { COMPETITIONS, getCompetitionById } from '@/lib/football/competitions';

export type InternalUrlType = 'league' | 'model' | 'match' | 'blog' | 'static';

export interface InternalUrlParams {
  slug?: string;
  id?: string;
  leagueSlug?: string;
  matchSlug?: string;
}

/**
 * Get canonical internal URL for a page type.
 * Enforces short-form league slugs and proper URL structure.
 *
 * @param type - Page type
 * @param params - URL parameters
 * @returns Canonical path (relative, no domain)
 */
export function getInternalUrl(type: InternalUrlType, params: InternalUrlParams): string {
  switch (type) {
    case 'league': {
      if (!params.slug) throw new Error('League slug required');
      // Ensure canonical short slug (e.g., "epl" not "premier-league")
      const competition = getCompetitionById(params.slug);
      if (!competition) throw new Error(`Unknown league slug: ${params.slug}`);
      return `/leagues/${competition.id}`;
    }
    case 'model': {
      if (!params.id) throw new Error('Model ID required');
      return `/models/${params.id}`;
    }
    case 'match': {
      if (!params.leagueSlug || !params.matchSlug) throw new Error('League and match slugs required');
      return `/leagues/${params.leagueSlug}/${params.matchSlug}`;
    }
    case 'blog': {
      if (!params.slug) throw new Error('Blog slug required');
      return `/blog/${params.slug}`;
    }
    case 'static': {
      if (!params.slug) throw new Error('Static page slug required');
      return params.slug;
    }
    default:
      throw new Error(`Unknown URL type: ${type}`);
  }
}

/**
 * Get full absolute URL (for sitemaps, metadata)
 */
export function getAbsoluteUrl(type: InternalUrlType, params: InternalUrlParams): string {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kroam.xyz';
  return `${BASE_URL}${getInternalUrl(type, params)}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-sitemap` package | Next.js native Route Handlers | Next.js 13 (2023) | Reduced dependencies; more control over sitemap logic |
| `priority` and `changefreq` as ranking signals | Ignored by Google, focus on `lastmod` | Google ~2015-2020 | Simplifies sitemap generation; focus on accurate timestamps |
| Static sitemap files | Dynamic sitemaps from database | Ongoing | Always up-to-date URLs; no manual XML editing |
| Navigation-only internal links | Contextual links in main content | Google core updates 2021-2023 | Better link equity distribution; prioritize in-content links |
| Manual orphan page detection | Automated link audits in CI/CD | Modern DevOps (2020+) | Catches orphan pages before deployment |

**Deprecated/outdated:**
- **next-sitemap package:** Not needed; Next.js 16 provides Route Handlers and Metadata API for sitemaps
- **Static XML files:** Dynamic sitemaps from database are always current and scale better
- **Sitemap `priority` and `changefreq` as SEO factors:** Google confirmed these are ignored; include for spec compliance only

## Open Questions

Things that couldn't be fully resolved:

1. **Build-time vs. runtime link auditing**
   - What we know: Next.js doesn't provide built-in build-time HTML access; runtime crawling requires starting dev server during build
   - What's unclear: Whether Vercel/Coolify build environments allow spawning dev server during build for crawling
   - Recommendation: Start with static analysis (parse TSX for `<Link>` components); upgrade to runtime crawling if static approach misses dynamic links

2. **Exact crawl budget impact of priority/changefreq**
   - What we know: Google ignores priority/changefreq for ranking but unclear if they affect crawl rate
   - What's unclear: Whether removing these tags entirely vs. including default values affects crawl efficiency
   - Recommendation: Include tags with conservative values (per user decision) to stay compliant with sitemap spec

3. **Handling match page scale (thousands of pages)**
   - What we know: Current implementation chunks matches into 45k URLs per sitemap; sitemap index references chunks
   - What's unclear: Whether 3+ inbound links per match is realistic at scale (hundreds of new matches weekly)
   - Recommendation: Match pages link to models (many-to-many via predictions), league pages, and /matches index — likely covers 3+ links naturally

4. **Orphan threshold optimization**
   - What we know: User decided on 3+ inbound links threshold
   - What's unclear: Whether 3 is optimal vs. 5 or 10 for pages with varying importance
   - Recommendation: Start with 3 as user specified; monitor search console coverage data to adjust if needed

## Sources

### Primary (HIGH confidence)

- [Next.js v16.1.5 Sitemap Generation API](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/04-functions/generate-sitemaps.mdx) - Official Next.js documentation
- [Next.js Route Handlers for Sitemaps](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.mdx) - Official Next.js metadata API
- User's existing sitemap implementation at `src/app/sitemap.xml/route.ts` and sub-sitemaps
- User's middleware with `LEAGUE_SLUG_REDIRECTS` at `src/middleware.ts`
- User's existing `RelatedModelsWidget` at `src/components/model/related-models-widget.tsx`

### Secondary (MEDIUM confidence)

- [Internal Linking Strategy: Complete SEO Guide for 2026](https://www.ideamagix.com/blog/internal-linking-strategy-seo-guide-2026/) - SEO best practices
- [Are Orphan Pages the Hidden SEO Problem to Fix in 2026?](https://www.clickrank.ai/orphan-pages-how-to-fix/) - Orphan page impact
- [Internal Links: SEO Best Practices for Internal Linking (2026) - Shopify](https://www.shopify.com/blog/internal-links-seo) - Internal link guidelines
- [XML Sitemap Priority & Changefreq Best Practices](https://slickplan.com/blog/xml-sitemap-priority-changefreq) - Sitemap tag usage
- [Lastmod, Priority, and Changefreq - Nuxt Sitemap](https://nuxtseo.com/docs/sitemap/advanced/loc-data) - Timestamp importance

### Tertiary (LOW confidence)

- [Cheerio Documentation](https://cheerio.js.org/) - HTML parsing library
- [Cheerio vs JSDOM Comparison](https://npm-compare.com/cheerio,jsdom,node-html-parser,parse5) - Parser performance
- [Sitemap Links TypeScript Library](https://www.npmjs.com/package/sitemap-links-ts) - Sitemap crawling utility (not needed, example only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js Route Handlers verified in v16.1.5 docs; existing implementation validated
- Architecture: HIGH - Sitemap structure exists; cross-linking patterns clear from existing widgets; build scripts standard Node.js
- Pitfalls: HIGH - Google's ignore of priority/changefreq verified across multiple sources; orphan page SEO impact well-documented

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - Next.js APIs stable; SEO best practices evolve slowly)
