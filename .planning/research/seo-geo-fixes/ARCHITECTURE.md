# Architecture Patterns: SEO/GEO Site Health Fixes

**Project:** bettingsoccer (kroam.xyz)
**Researched:** 2026-02-05
**Confidence:** HIGH

## System Overview

The Next.js 16 App Router architecture uses a file-system based routing pattern with dynamic routes, canonical URL enforcement via `permanentRedirect()`, and centralized metadata generation via `generateMetadata()`. SEO fixes integrate into existing patterns rather than requiring architectural rewrites.

**Current architecture strengths:**
- **Dynamic routing** - `/leagues/[slug]` and `/leagues/[slug]/[match]` already operational
- **Canonical enforcement** - League pages redirect aliases to canonical IDs (e.g., `premier-league` → `epl`)
- **Metadata API** - Next.js built-in `generateMetadata()` used throughout
- **Structured data** - JSON-LD schemas already implemented in components
- **Sitemap generation** - Dynamic XML generation via route handlers

**Architectural gaps (Ahrefs audit):**
1. Missing index pages (`/models` and `/leagues` return 404)
2. Meta refresh redirects instead of HTTP 301 (`/matches/[id]`)
3. Canonical URL chains (`/leagues/slug/match` → `/matches/UUID` → `/`)
4. Internal links use long-form slugs that trigger 308 redirects
5. Sitemap includes non-canonical URLs
6. Structured data validation errors (2834+ issues)
7. Missing H1 tags on 350+ match pages
8. Hreflang references uncrawlable subdomains
9. Incomplete Open Graph tags
10. Orphaned model pages (no internal links)

## Integration Points with Existing Components

### 1. Index Pages (New Components)

**Create:** `src/app/leagues/page.tsx` and `src/app/models/page.tsx`

**Integration:**
- Reuse existing queries: `getDb()`, `COMPETITIONS` config, `models` table
- Follow existing metadata pattern from `src/app/page.tsx`
- Use existing UI components: `Card`, `Link`, breadcrumbs
- Reference sitemap files for URL consistency

**Dependencies:**
- `src/lib/football/competitions.ts` - COMPETITIONS array
- `src/lib/db/index.ts` - Database queries
- `src/components/ui/card.tsx` - Card components
- `src/lib/seo/metadata.ts` - Metadata builders

### 2. Match Redirect Fix (Modify Existing)

**Current:** `/matches/[id]/page.tsx` uses `permanentRedirect()` (HTTP 301) ✓

**Issue:** Metadata returns "Redirecting..." with noindex, creating canonical confusion

**Fix:** The redirect itself is correct (already HTTP 301), but metadata should point to canonical URL

**Modified file:** `src/app/matches/[id]/page.tsx`
- Update `generateMetadata()` to set canonical to `/leagues/[slug]/[match]`
- Keep redirect logic as-is (already proper HTTP 301)

### 3. Canonical URL Strategy (Modify Metadata)

**Current canonical chain:**
```
/leagues/epl/arsenal-vs-chelsea → canonical: /matches/UUID
/leagues/epl/arsenal-vs-chelsea → canonical: self
/matches/UUID → canonical: /leagues/epl/arsenal-vs-chelsea (via redirect)
```

**Target canonical:**
```
/leagues/epl/arsenal-vs-chelsea → canonical: self
/matches/UUID → canonical: /leagues/epl/arsenal-vs-chelsea (via redirect)
```

**Modified files:**
- `src/app/leagues/[slug]/[match]/page.tsx` - Set canonical to self
- `src/lib/seo/metadata.ts` - Remove `/matches/` canonical logic

**Integration:** Uses existing Next.js `alternates.canonical` in metadata

### 4. Internal Link Generation (Modify Components)

**Problem:** Links use `competition.slug` which may be alias (e.g., `premier-league`)

**Fix:** Normalize to `competition.id` before generating URLs

**Modified files:**
- `src/components/match-card.tsx` - Line 87-88 (match URL generation)
- `src/components/competition/recent-predictions-widget.tsx` - Line 30 (use `competition.id`)
- Any component with `href` containing `/leagues/${competition.slug}`

**Pattern:**
```typescript
// BEFORE
const matchUrl = `/leagues/${match.competition.slug}/${match.slug}`;

// AFTER
const matchUrl = `/leagues/${match.competition.id}/${match.slug}`;
```

**Integration:** Competition data already includes `id` field from `getCompetitionByIdOrAlias()`

### 5. Sitemap Cleanup (Modify Route Handlers)

**Current:** Sitemap includes `/matches/UUID` URLs that redirect

**Fix:** Remove `/matches/` sitemap entirely; keep only canonical match URLs

**Modified files:**
- `src/app/sitemap/matches/[id]/route.ts` - Already uses canonical `/leagues/` URLs ✓
- `src/app/sitemap.xml/route.ts` or root sitemap index - Verify no `/matches/` references

**Integration:** Match sitemap already queries correct data; verify output

### 6. Structured Data Fixes (Modify Schema Components)

**Issues (2834+ validation errors):**
- Missing required properties
- Invalid property types
- Mismatched @id references
- Schema-visual parity violations

**Modified files:**
- `src/components/MatchPageSchema.tsx` - Already correct with Article schema + dates
- `src/lib/seo/schema/sports-event.ts` - Verify SportsEvent properties
- `src/lib/seo/schema/competition.ts` - Verify SportsOrganization schema
- `src/lib/seo/schema/breadcrumb.ts` - Verify BreadcrumbList format

**Validation:**
- Test with [Google Rich Results Test](https://search.google.com/test/rich-results)
- Test with [Schema.org Validator](https://validator.schema.org/)

**Common fixes:**
- Add missing `description` properties
- Use `https://schema.org/EventScheduled` for `eventStatus`
- Ensure `@id` cross-references are valid URLs
- Match visible content to schema markup (schema-visual parity)

### 7. H1 Tag Addition (Modify Match Pages)

**Current:** Match pages use `<h2>` or no heading for team names

**Fix:** Add `<h1>` with match title

**Modified file:** `src/app/leagues/[slug]/[match]/page.tsx` or `src/components/match/match-layout.tsx`

**Pattern:**
```tsx
<h1 className="text-2xl font-bold">{match.homeTeam} vs {match.awayTeam}</h1>
```

**Integration:** MatchDataProvider already provides match data; add heading to layout

### 8. Hreflang Implementation (Add to Metadata)

**Current issue:** Ahrefs reports hreflang references to uncrawlable subdomains

**Recommendation:** Remove hreflang entirely unless multi-language content exists

**If multi-language needed:**
```typescript
// In generateMetadata()
alternates: {
  canonical: canonicalUrl,
  languages: {
    'en-US': '/en-US/leagues/epl',
    'es-ES': '/es-ES/leagues/epl',
  },
}
```

**Integration:** Next.js metadata API generates `<link rel="alternate" hreflang>` automatically

**Reference:** [Next.js Metadata API - alternates.languages](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

### 9. Open Graph Completion (Modify Metadata Builders)

**Missing OG tags on ~47 pages**

**Modified file:** `src/lib/seo/metadata.ts`

**Required properties:**
- `openGraph.title` ✓ (already present)
- `openGraph.description` ✓ (already present)
- `openGraph.url` ✓ (already present)
- `openGraph.images` ✓ (already present)
- `openGraph.type` - Add `'website'` or `'article'`
- `openGraph.siteName` - Add `'kroam.xyz'`

**Check all metadata builders:**
- `buildMatchMetadata()` - Line 95-123 ✓ (complete)
- `generateLeaderboardMetadata()` - Verify OG completeness
- `generateHomeMetadata()` - Verify OG completeness
- New index pages - Add complete OG tags

### 10. Model Page Internal Links (Add Links)

**Current:** 65 model pages are orphans (no internal links)

**Add links in:**
- `src/app/leagues/[slug]/league-hub-content.tsx` - Top models widget (already links ✓)
- `src/components/leaderboard-table.tsx` - Model names as links
- `src/app/models/page.tsx` (new index) - All models listed
- `src/components/competition/competition-top-models.tsx` - Line 29 ✓ (already links)

**Verify:** All components with model names have `<Link href={`/models/${modelId}`}>`

## Component Responsibilities

### New Components

| Component | Responsibility | Data Source | Integration |
|-----------|---------------|-------------|-------------|
| `src/app/leagues/page.tsx` | Leagues index | `COMPETITIONS` array | Links to `/leagues/[slug]` |
| `src/app/models/page.tsx` | Models index | `models` table query | Links to `/models/[id]` |

### Modified Components

| Component | Current Responsibility | Change | Integration Point |
|-----------|----------------------|--------|-------------------|
| `src/app/matches/[id]/page.tsx` | Redirect UUID to canonical | Update metadata canonical | Uses `getMatchWithAnalysis()` |
| `src/app/leagues/[slug]/[match]/page.tsx` | Match page render | Set canonical to self, add H1 | Uses `generateMetadata()` |
| `src/lib/seo/metadata.ts` | Metadata generation | Fix canonical logic, complete OG | Called by all pages |
| `src/components/match-card.tsx` | Match card UI | Use `competition.id` not `slug` | Receives competition data |
| `src/components/MatchPageSchema.tsx` | JSON-LD schema | Fix validation errors | Already has Article + dates ✓ |
| `src/lib/seo/schema/*.ts` | Schema builders | Validate required properties | Used by page schemas |

### Unchanged Components (Verify Only)

| Component | Responsibility | Why No Change Needed |
|-----------|---------------|---------------------|
| `src/app/sitemap/matches/[id]/route.ts` | Match sitemap | Already uses `/leagues/` URLs ✓ |
| `src/components/competition/competition-top-models.tsx` | Model links | Already links to `/models/` ✓ |
| `src/lib/football/competitions.ts` | Competition config | Provides `id` and `aliases` ✓ |

## Data Flow

### URL Canonical Flow (Target State)

```
User enters URL → Next.js routing → Canonical enforcement → Metadata generation → Render

Examples:
1. /leagues/premier-league → permanentRedirect → /leagues/epl (308)
2. /leagues/epl → render with canonical: self
3. /leagues/epl/arsenal-chelsea → render with canonical: self
4. /matches/UUID → permanentRedirect → /leagues/epl/arsenal-chelsea (301)
```

### Internal Link Generation Flow

```
Component render → Competition data → Normalize to competition.id → Generate href

// match-card.tsx
const matchUrl = match.slug && match.competition.id
  ? `/leagues/${match.competition.id}/${match.slug}` // Uses ID, not slug
  : `/matches/${match.id}`;
```

### Metadata Generation Flow

```
Page request → generateMetadata() → Competition/Match data → Metadata builder → Response

// leagues/[slug]/[match]/page.tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, match } = await params;
  const competitionConfig = getCompetitionByIdOrAlias(slug);
  const result = await getMatchBySlug(competitionConfig?.id || slug, match);

  return buildMatchMetadata(seoData, activeModels); // Centralized builder
}
```

### Structured Data Flow

```
Page render → Schema component → Data aggregation → JSON-LD @graph → <script> tag

// MatchPageSchema.tsx
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    Organization, // Root entity
    WebSite,      // Publisher
    SportsEvent,  // The match
    WebPage,      // This page
    Article,      // Content with dates
    FAQPage,      // FAQ schema
    BreadcrumbList, // Navigation
  ],
};
```

## Architectural Patterns

### Pattern 1: Canonical URL Enforcement

**What:** Single source of truth for each resource

**Implementation:**
```typescript
// League pages - canonical is competition.id
if (slug !== competition.id) {
  permanentRedirect(`/leagues/${competition.id}`);
}

return {
  alternates: {
    canonical: `${BASE_URL}/leagues/${competition.id}`,
  },
};

// Match pages - canonical is /leagues/id/match-slug
return {
  alternates: {
    canonical: `${BASE_URL}/leagues/${competitionId}/${matchSlug}`,
  },
};
```

**Why it works:** Next.js `permanentRedirect()` sends HTTP 301; metadata canonical signals to search engines

**Reference:** [Next.js permanentRedirect](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect) (verified 2026-02-05)

### Pattern 2: Alias Normalization at Data Layer

**What:** Convert aliases to canonical IDs before URL generation

**Implementation:**
```typescript
// getCompetitionByIdOrAlias returns canonical config
const competitionConfig = getCompetitionByIdOrAlias(slug);

// Always use competition.id for URLs
const url = `/leagues/${competitionConfig.id}/${match.slug}`;
```

**Why it works:** Single function controls alias resolution; components use canonical IDs

### Pattern 3: Centralized Metadata Builders

**What:** Shared functions for metadata generation

**Implementation:**
```typescript
// lib/seo/metadata.ts
export function buildMatchMetadata(match: MatchSeoData, activeModels?: number): Metadata {
  return {
    title: createTitle(match),
    description: createDescription(match, activeModels),
    openGraph: { /* complete OG tags */ },
    twitter: { /* complete Twitter tags */ },
    alternates: { canonical: `${BASE_URL}/leagues/${competitionId}/${matchSlug}` },
  };
}

// Called by pages
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const seoData = mapMatchToSeoData(matchData);
  return buildMatchMetadata(seoData, activeModels);
}
```

**Why it works:** DRY principle; consistent metadata across pages

### Pattern 4: Schema Component Composition

**What:** Reusable schema builders with @graph composition

**Implementation:**
```typescript
// components/MatchPageSchema.tsx
export function MatchPageSchema({ match, competition, url, faqs }) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganizationSchema(),
      buildWebsiteSchema(),
      buildSportsEventSchema(match),
      buildWebPageSchema(url),
      buildArticleSchema(match, contentGeneratedAt),
      buildFAQSchema(faqs),
      buildBreadcrumbSchema(breadcrumbs),
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
```

**Why it works:** Single JSON-LD script; proper entity relationships via @id; avoids validation warnings

**Reference:** [Google Structured Data @graph](https://developers.google.com/search/docs/appearance/structured-data) (verified 2026-02-05)

### Pattern 5: Dynamic Sitemap Generation

**What:** Route handlers generate XML from database

**Implementation:**
```typescript
// app/sitemap/matches/[id]/route.ts
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const matchData = await db
    .select({ matchSlug: matches.slug, competitionId: competitions.id })
    .from(matches)
    .where(isNotNull(matches.slug));

  const urls = matchData.map(match => ({
    url: `${BASE_URL}/leagues/${match.competitionId}/${match.matchSlug}`, // Canonical URL
    lastmod: match.updatedAt,
  }));

  return new Response(generateSitemapXML(urls), { headers: { 'Content-Type': 'application/xml' } });
}
```

**Why it works:** Dynamic; always in sync with database; uses canonical URLs only

## Anti-Patterns to Avoid

### Anti-Pattern 1: Meta Refresh Redirects

**What:** Using `<meta http-equiv="refresh">` instead of HTTP redirects

**Why bad:** Google treats as soft redirect (not PageRank passing); slower; worse UX

**Current state:** Already fixed (uses `permanentRedirect()`) ✓

**Instead:** Use Next.js `permanentRedirect()` or `redirect()`

**Reference:** [Next.js 16 Redirect Guide](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect)

### Anti-Pattern 2: Canonical Chains

**What:** Canonical URL points to another page that also has a canonical

**Why bad:** Google may ignore or follow incorrectly; dilutes PageRank

**Current issue:**
```
Page A canonical → Page B
Page B canonical → Page C
```

**Instead:**
```
Page A canonical → Page A (self)
Page B redirects → Page A (301)
```

**Reference:** [Google Canonical Best Practices](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) ([Next.js SEO Guide 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition))

### Anti-Pattern 3: Using Slug Aliases in Internal Links

**What:** Linking to `/leagues/premier-league` instead of `/leagues/epl`

**Why bad:** Triggers 308 redirect on every link click; wastes crawl budget

**Current issue:** Components use `competition.slug` which may be alias

**Instead:** Normalize to `competition.id` before href generation

### Anti-Pattern 4: Sitemap Including Non-Canonical URLs

**What:** Sitemap lists URLs that redirect elsewhere

**Why bad:** Wastes crawl budget; confuses search engines about canonical

**Current state:** Match sitemap already uses `/leagues/` URLs ✓

**Verify:** No `/matches/UUID` URLs in sitemap

### Anti-Pattern 5: Incomplete Schema Markup

**What:** Missing required properties, invalid types, or broken @id references

**Why bad:** Rich results not eligible; validation errors in Search Console

**Common mistakes:**
- Missing `description` in SportsEvent
- Invalid `eventStatus` URL
- Mismatched `@id` references
- Schema-visual parity violations (schema says X, page shows Y)

**Instead:**
- Validate with [Rich Results Test](https://search.google.com/test/rich-results)
- Use TypeScript types from `schema-dts`
- Ensure schema matches visible content

**Reference:** [Schema Markup Validator](https://developers.google.com/search/docs/appearance/structured-data) (verified 2026-02-05)

### Anti-Pattern 6: Orphaned Pages (No Internal Links)

**What:** Pages that exist but have no links pointing to them

**Why bad:** Search engines may not discover; users can't navigate

**Current issue:** 65 model pages have no internal links

**Instead:** Add links from:
- Index pages (`/models` listing)
- Leaderboard table (model names)
- Top performers widgets (already done ✓)

## Build Order (Suggested Sequence)

### Phase 1: Foundation (Low Risk)
**Goal:** Create index pages, fix link generation

1. **Create `/leagues/page.tsx`**
   - List all competitions from `COMPETITIONS` array
   - Add metadata, breadcrumbs, schema
   - Link to `/leagues/[slug]`

2. **Create `/models/page.tsx`**
   - Query `models` table
   - Add metadata, breadcrumbs
   - Link to `/models/[id]`

3. **Fix internal link generation**
   - Update `match-card.tsx` to use `competition.id`
   - Update `recent-predictions-widget.tsx` to use `competition.id`
   - Grep for `competition.slug` in href attributes

**Risk:** LOW - New pages, no breaking changes
**Impact:** HIGH - Fixes 404s, orphaned pages
**Validation:** Visit `/leagues` and `/models`, click links

### Phase 2: Canonical URLs (Medium Risk)
**Goal:** Fix canonical chains, metadata

4. **Update match page canonical**
   - Modify `src/app/leagues/[slug]/[match]/page.tsx`
   - Set `alternates.canonical` to self (`/leagues/${competitionId}/${matchSlug}`)

5. **Update redirect page canonical**
   - Modify `src/app/matches/[id]/page.tsx`
   - Set canonical to target (`/leagues/${competitionId}/${matchSlug}`)
   - Keep redirect as-is (already HTTP 301)

6. **Remove canonical chains in metadata.ts**
   - Review `buildMatchMetadata()` function
   - Ensure canonical points to `/leagues/` URLs, not `/matches/`

**Risk:** MEDIUM - Changes affect SEO signals
**Impact:** HIGH - Fixes canonical chains, improves rankings
**Validation:**
- Check `<link rel="canonical">` in HTML
- Verify no redirect chains with curl
- Run [Ahrefs Site Audit](https://ahrefs.com/site-audit)

### Phase 3: Structured Data (High Risk)
**Goal:** Fix validation errors, complete schemas

7. **Validate existing schemas**
   - Test match pages with [Rich Results Test](https://search.google.com/test/rich-results)
   - Document all validation errors

8. **Fix MatchPageSchema.tsx**
   - Add missing required properties
   - Fix @id cross-references
   - Verify Article schema dates

9. **Fix schema builders in `lib/seo/schema/`**
   - `sports-event.ts` - Add `description`, fix `eventStatus`
   - `competition.ts` - Verify SportsOrganization
   - `breadcrumb.ts` - Verify format

10. **Validate fixes**
    - Re-test with Rich Results Test
    - Verify schema-visual parity (matches visible content)

**Risk:** HIGH - Schema errors can break rich results
**Impact:** HIGH - Fixes 2834+ validation errors
**Validation:**
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- Google Search Console Structured Data report

### Phase 4: Metadata & UI Polish (Low Risk)
**Goal:** Complete OG tags, add H1 tags

11. **Complete Open Graph tags**
    - Review all metadata builders
    - Add `openGraph.type`, `openGraph.siteName`
    - Verify images on all pages

12. **Add H1 tags to match pages**
    - Update `match-layout.tsx` or page component
    - Add `<h1>{homeTeam} vs {awayTeam}</h1>`

13. **Remove or fix hreflang**
    - If no multi-language: remove hreflang
    - If multi-language: fix to crawlable URLs

**Risk:** LOW - Cosmetic and metadata improvements
**Impact:** MEDIUM - Better social sharing, accessibility
**Validation:**
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- Check H1 with browser DevTools

### Phase 5: Verification (No Risk)
**Goal:** Confirm all fixes

14. **Sitemap verification**
    - Check `/sitemap.xml` index
    - Verify no `/matches/UUID` entries
    - Confirm all URLs return 200

15. **Link audit**
    - Verify no 308 redirects on internal links
    - Confirm model pages have inbound links
    - Check breadcrumbs use canonical URLs

16. **Final Ahrefs audit**
    - Run full site crawl
    - Compare before/after issues
    - Document improvements

**Risk:** NONE - Read-only verification
**Impact:** HIGH - Confirms success
**Validation:** Ahrefs report shows reduced issues

## Dependencies and Build Considerations

### Build-Time Dependencies
- **Database access:** Some pages need database at build (use ISR with revalidation)
- **Competition config:** `COMPETITIONS` array must be up-to-date
- **Environment vars:** `NEXT_PUBLIC_BASE_URL` must be set for canonical URLs

### Runtime Dependencies
- **Database queries:** All dynamic pages query database on-demand
- **External APIs:** None for SEO fixes
- **Caching:** Next.js ISR caching (60s revalidation on league pages)

### Testing Strategy
1. **Local development:** Test with `npm run dev`
2. **Production build:** Test with `npm run build && npm start`
3. **Schema validation:** [Rich Results Test](https://search.google.com/test/rich-results) on staging
4. **Link verification:** Screaming Frog or Ahrefs on staging
5. **Canonical verification:** `curl -I` to check HTTP status codes
6. **Deploy:** Coolify deployment with Nixpacks

### Deployment Considerations
- **Zero downtime:** All changes backward-compatible
- **Incremental rollout:** Deploy phases sequentially
- **Monitoring:** Watch Search Console for indexing changes
- **Rollback plan:** Git revert if rankings drop

## Performance Implications

### Positive Impacts
- **Fewer redirects:** Internal links use canonical URLs directly
- **Better crawl efficiency:** Sitemap contains only canonical URLs
- **Improved caching:** No redirect chains means better CDN caching

### Neutral Impacts
- **Index pages:** New pages add minimal server load (cached with ISR)
- **Metadata changes:** No performance impact (server-side only)
- **Schema updates:** Minimal HTML size increase

### Monitoring
- **Core Web Vitals:** Should remain unchanged
- **Time to First Byte (TTFB):** Monitor on new index pages
- **Largest Contentful Paint (LCP):** Verify images load on index pages

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (verified 2026-02-05):
  - `src/app/leagues/[slug]/page.tsx` - Canonical enforcement
  - `src/app/matches/[id]/page.tsx` - Redirect implementation
  - `src/lib/seo/metadata.ts` - Metadata builders
  - `src/components/MatchPageSchema.tsx` - Schema implementation
  - `next.config.ts` - Redirect configuration
- [Next.js 16 App Router Documentation](https://nextjs.org/docs/app) - Official Next.js docs
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Official metadata reference
- [Google Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data) - Official Google docs (verified 2026-02-05)

### Secondary (MEDIUM confidence)
- [Next.js SEO Optimization Guide (2026 Edition)](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition) - Canonical best practices
- [Mike Bifulco: Self-Healing URLs in Next.js](https://mikebifulco.com/posts/self-healing-urls-nextjs-seo) - Canonical implementation patterns
- [Build with Matija: Canonical Tags in Next.js 15](https://www.buildwithmatija.com/blog/nextjs-advanced-seo-multilingual-canonical-tags) - Hreflang implementation
- [Schema.org Validator](https://validator.schema.org/) - Structured data testing tool
- Ahrefs audit report (user-provided) - Issue identification

### Verified Techniques
- **Canonical enforcement:** `permanentRedirect()` sends HTTP 301 ✓
- **Metadata API:** `alternates.canonical` generates `<link rel="canonical">` ✓
- **Schema @graph:** Single JSON-LD script with entity graph ✓
- **Dynamic sitemaps:** Route handlers with database queries ✓

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Canonical URLs | HIGH | Existing implementation verified; Next.js docs confirm approach |
| Internal links | HIGH | Codebase analysis shows clear pattern; fix is straightforward |
| Index pages | HIGH | Standard Next.js pattern; COMPETITIONS array already exists |
| Structured data | MEDIUM | Schema validation needed; 2834 errors suggest complexity |
| Hreflang | LOW | Unclear if multi-language needed; recommend removal |
| Build order | HIGH | Sequenced by risk; each phase independently testable |

## Open Questions

1. **Hreflang strategy:** Should multi-language support be added, or remove hreflang entirely?
   - **Recommendation:** Remove hreflang unless multi-language content exists
   - **Validation:** Check if language subdomains are planned

2. **Sitemap pagination:** 45,000 matches per chunk - is this optimal?
   - **Current:** `CHUNK_SIZE = 45000` in `sitemap/matches/[id]/route.ts`
   - **Recommendation:** Google limit is 50,000 URLs; current is safe

3. **Schema validation priority:** Which errors fix first?
   - **Recommendation:** Run Rich Results Test, fix errors (not warnings) first
   - **Order:** SportsEvent > Article > FAQPage > BreadcrumbList

4. **Model page discoverability:** Are leaderboard links sufficient?
   - **Current:** Top models widget links to models
   - **Gap:** Lower-ranked models may be orphaned
   - **Recommendation:** Add `/models` index page listing all models

## Next Steps for Roadmap Creation

This research enables roadmap creation with:

1. **Phase structure:** 5 phases (Foundation → Canonical → Schema → Polish → Verification)
2. **Risk assessment:** Each phase tagged with risk level
3. **Dependencies:** Build order respects component dependencies
4. **Validation:** Clear testing criteria for each phase
5. **Rollback plan:** Git-based, zero downtime deployment

**Suggested milestone structure:**
- Milestone 1: Index pages + link fixes (LOW risk, HIGH impact)
- Milestone 2: Canonical URLs (MEDIUM risk, HIGH impact)
- Milestone 3: Structured data (HIGH risk, HIGH impact)
- Milestone 4: Metadata polish (LOW risk, MEDIUM impact)
- Milestone 5: Verification (ZERO risk, HIGH value)

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need research
- Phase 2: Verify canonical logic with Google docs
- Phase 3: Likely needs deeper research (schema validation complexity)
- Phase 4: Standard patterns, unlikely to need research
- Phase 5: Tooling research (Ahrefs, Screaming Frog setup)
