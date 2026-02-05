# Feature Landscape: SEO/GEO Site Health Fixes

**Domain:** Technical SEO for Sports Prediction Platform
**Researched:** 2026-02-05
**Context:** Fixing 24 categories of SEO issues identified by Ahrefs audit on kroam.xyz

## Executive Summary

SEO site health fixes fall into three impact tiers: **Critical** (Google explicitly penalizes, direct ranking impact), **High** (competitive advantage, affects discoverability), and **Low** (polish, indirect benefits). The 24 issues identified span all three tiers, with redirect architecture and indexation problems being the most severe.

Based on 2026 SEO research, the priority order is:
1. **Indexation blockers** (404s, noindex pages that should be indexed, orphan pages)
2. **Redirect architecture** (301 vs 302 vs meta refresh, redirect chains)
3. **Crawl efficiency** (canonical URLs, sitemap hygiene, internal linking)
4. **Content optimization** (meta tags, structured data, hreflang)
5. **Performance** (TTFB, Core Web Vitals)

---

## Table Stakes

Features users and search engines expect. Missing = penalties or invisibility.

### Critical (Direct Ranking Impact)

| Feature | Why Expected | Complexity | Phase Priority | Notes |
|---------|--------------|------------|---------------|-------|
| **HTTP 301 redirects for /matches/UUID** | Google penalizes meta refresh redirects; doesn't transfer link equity | Medium | Phase 1 | Replace 172 meta refresh + noindex with server-side 301 redirects. Current approach wastes crawl budget and loses link value. |
| **Create /models and /leagues index pages** | 110 inlinks to 404 pages is severe crawl waste | Low | Phase 1 | These pages have significant link equity but return 404. Create paginated listing pages with filtering. |
| **Fix orphan pages (65 models, 47 matches)** | Orphan pages waste crawl budget and can't rank | Medium | Phase 2 | Pages with zero internal links are invisible to crawlers. Add to internal linking widgets and index pages. |
| **Canonical URL architecture** | 177 pages with wrong canonicals confuse Google | Medium | Phase 1 | Match pages pointing to / instead of /leagues/{slug}/{match} is incorrect. Fix generateMetadata in layout files. |
| **301 redirects for www and protocol** | 302 redirects don't transfer link equity permanently | Low | Phase 1 | Change www.kroam.xyz and http redirects from 302 to 301. Should be middleware or hosting config. |
| **Add missing pages to sitemap** | 7 league pages not in sitemap = not prioritized for crawling | Low | Phase 2 | Sitemap signals importance. Missing pages get lower crawl priority. |
| **Remove non-canonical pages from sitemap** | 172 /matches/UUID in sitemap but they redirect | Low | Phase 2 | Sitemaps should only contain canonical URLs. Including redirects wastes crawl budget. |

### High Priority (Indexation & Discovery)

| Feature | Why Expected | Complexity | Phase Priority | Notes |
|---------|--------------|------------|---------------|-------|
| **H1 tags on match pages** | 350 match pages missing H1 signals weak content structure | Low | Phase 2 | Google uses H1 for content understanding. Missing H1s reduce topical authority. |
| **Complete Open Graph tags** | 47 pages missing og:image reduces social sharing CTR | Low | Phase 3 | Not a direct ranking factor but affects user signals. Generate league/team badge images. |
| **Optimize meta description length** | 132 pages with <100 char descriptions underutilize SERP space | Low | Phase 3 | Google shows 150-160 chars. Short descriptions miss persuasion opportunity. |
| **Optimize meta description length (long)** | 8 pages with >160 char descriptions get truncated | Low | Phase 3 | Truncated descriptions look incomplete in SERPs, reducing CTR. |
| **Optimize title tag length** | 36 pages with >60 char titles get truncated | Low | Phase 3 | Google shows ~60 chars (575px). Truncated titles lose impact. |
| **Hreflang configuration** | Missing x-default + 4 uncrawled subdomains confuses language targeting | High | Phase 4 | Multi-language sites need hreflang to avoid duplicate content penalties. Subdomains returning 503 is critical. |
| **Fix robots.txt on subdomains** | 4 language subdomains return 503 for robots.txt | High | Phase 4 | Inaccessible robots.txt blocks crawlers completely. This is critical for es/fr/it/de subdomains. |

---

## Differentiators

Features that set the site apart. Not expected, but improve competitive position.

### Performance Optimization

| Feature | Value Proposition | Complexity | Phase Priority | Notes |
|---------|-------------------|------------|---------------|-------|
| **TTFB optimization for slow pages** | 28 pages with 2-7s TTFB hurt Core Web Vitals score | High | Phase 5 | TTFB >600ms is penalized. Requires database query optimization, caching strategy, or static generation. |
| **Reduce redirect chains** | 1 chain (http://www → https://www → https://) wastes time | Low | Phase 1 | Each redirect adds 200-500ms. Single-hop redirects improve UX and rankings. |

### Content Quality Signals

| Feature | Value Proposition | Complexity | Phase Priority | Notes |
|---------|-------------------|------------|---------------|-------|
| **Fix structured data validation errors** | 2834+1531 errors reduce rich result eligibility | Medium-High | Phase 6 | Google won't show rich results with schema errors. Requires validation against schema.org and Google's specific requirements. |
| **Increase internal link density** | 127+ pages with only 1 dofollow link are weak | Medium | Phase 2 | Pages with 3-5 internal links from relevant pages gain authority. Improves crawl depth distribution. |
| **Eliminate internal links to redirect targets** | 30 pages linking to URLs that redirect | Low | Phase 3 | Direct links are more efficient. Reduces redirect overhead for users and crawlers. |

### Architecture Improvements

| Feature | Value Proposition | Complexity | Phase Priority | Notes |
|---------|-------------------|------------|---------------|-------|
| **Optimize league slug redirect strategy** | 35 internal links use long-form slugs that 308 redirect | Low | Phase 3 | Update internal link generation to use short-form slugs directly. Reduces redirect overhead. |
| **Fix redirect approach for match UUID pages** | 172 pages using meta refresh instead of HTTP redirect | Medium | Phase 1 | Same issue as critical fix above. Consolidates redirect strategy. |
| **Fix "Redirecting..." titles** | 172 /matches/UUID pages with poor title before redirect | Low | Phase 1 | Cosmetic but affects user experience for slow connections. |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in SEO optimization.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Blocking /matches/UUID entirely** | URL exists in backlinks and search index | 301 redirect to canonical league URL, don't 404 or 410 |
| **Aggressive pagination limits on index pages** | Reduces discoverability of deep content | Paginate but keep all pages indexable with self-referencing canonical tags |
| **Noindex on paginated pages** | Google no longer uses rel=prev/next, needs each page indexable | Each paginated page should be indexable with its own canonical |
| **Canonical consolidation of similar matches** | Each match is unique content, shouldn't point to generic page | Canonical should point to the page itself or the preferred URL for that specific match |
| **Meta refresh with delay >0 seconds** | Google may not follow, wastes time | Use instant meta refresh (0 seconds) only as fallback if HTTP redirect impossible |
| **Removing structured data due to errors** | Structured data is essential for rich results | Fix validation errors rather than removing schemas entirely |
| **Over-optimization of meta descriptions** | Google rewrites 62%+ of descriptions anyway | Focus on natural, compelling copy within 150-160 chars, not keyword stuffing |
| **Blocking Googlebot from JavaScript/CSS** | Prevents Google from rendering modern web apps correctly | Only block truly sensitive paths in robots.txt |
| **Excessive internal linking** | 10+ links to same page looks spammy | 3-5 strategic links from relevant contexts is optimal |
| **Creating low-quality index pages** | Thin content on /models or /leagues hurts more than helps | Add filtering, sorting, descriptions, and unique content to index pages |

---

## Feature Dependencies

### Dependency Tree

```
Phase 1: Foundation
├─ 301 redirects for /matches/UUID (blocks orphan fixes)
├─ Create /models and /leagues index pages (enables internal linking)
├─ Fix canonical URLs (blocks sitemap cleanup)
├─ Fix www/protocol redirects (infrastructure)
└─ Eliminate redirect chains (infrastructure)

Phase 2: Discoverability
├─ Fix orphan pages (depends: index pages exist)
├─ Add H1 tags to match pages
├─ Increase internal link density (depends: index pages exist)
├─ Clean up sitemap (depends: canonical URLs fixed)
└─ Add missing pages to sitemap

Phase 3: Content Polish
├─ Optimize meta descriptions (short)
├─ Optimize meta descriptions (long)
├─ Optimize title tags
├─ Complete Open Graph tags
├─ Fix internal links to redirects (depends: redirects fixed)
└─ Optimize league slug usage

Phase 4: Multi-Language
├─ Fix robots.txt on subdomains (critical blocker)
├─ Configure hreflang (depends: subdomains accessible)
└─ Add x-default hreflang

Phase 5: Performance
└─ TTFB optimization (independent, high complexity)

Phase 6: Advanced
└─ Fix structured data validation (independent, high complexity)
```

### Critical Path

The critical path for maximum SEO impact:

1. **Fix redirect architecture** → Enables link equity flow
2. **Create index pages** → Enables internal linking strategy
3. **Fix orphan pages** → Enables crawling of all content
4. **Clean up sitemap** → Prioritizes important pages for crawling
5. **Everything else** → Incremental improvements

---

## MVP Recommendation

For immediate SEO impact (Phase 1 only):

### Must Fix (Week 1)
1. Replace meta refresh with HTTP 301 redirects for /matches/UUID (172 pages)
2. Create /models and /leagues index pages (fixes 404s with 110 inlinks)
3. Fix canonical URLs (177 pages pointing to / instead of league URL)
4. Change www/protocol redirects from 302 to 301
5. Eliminate redirect chain (http://www → https://)

### Quick Wins (Week 2)
6. Fix "Redirecting..." titles on UUID pages
7. Optimize internal link generation to use short-form league slugs

**Expected impact:**
- **Crawl budget**: 50%+ improvement (eliminating meta refresh, fixing 404s, reducing orphans)
- **Link equity**: Proper flow through 301 redirects instead of loss through meta refresh
- **Indexation**: All 172 match UUID pages properly consolidated to canonical URLs

**Defer to post-MVP:**
- Structured data fixes (complex, not blocking)
- TTFB optimization (requires infrastructure work)
- Hreflang configuration (requires subdomain access)
- H1/meta tag optimization (polish, not critical)

---

## Prioritization Matrix

### By SEO Impact (High to Low)

| Tier | Issue | Impact | Effort | ROI | Phase |
|------|-------|--------|--------|-----|-------|
| **Critical** | 404 pages (/models, /leagues) | 10 | 3 | 3.3 | 1 |
| **Critical** | Meta refresh → 301 redirects | 10 | 5 | 2.0 | 1 |
| **Critical** | Fix canonical URLs | 10 | 4 | 2.5 | 1 |
| **Critical** | Orphan pages (65 models, 47 matches) | 9 | 6 | 1.5 | 2 |
| **High** | 302 → 301 redirects (www, protocol) | 8 | 2 | 4.0 | 1 |
| **High** | Fix robots.txt on subdomains | 9 | 3 | 3.0 | 4 |
| **High** | Sitemap hygiene (add/remove pages) | 7 | 3 | 2.3 | 2 |
| **High** | Increase internal link density | 7 | 5 | 1.4 | 2 |
| **Medium** | H1 tags (350 pages) | 6 | 2 | 3.0 | 2 |
| **Medium** | Hreflang configuration | 6 | 7 | 0.9 | 4 |
| **Medium** | Structured data validation | 6 | 8 | 0.8 | 6 |
| **Medium** | TTFB optimization (28 pages) | 6 | 9 | 0.7 | 5 |
| **Low** | Meta description length (<100 chars) | 4 | 2 | 2.0 | 3 |
| **Low** | Title tag length (>60 chars) | 4 | 2 | 2.0 | 3 |
| **Low** | Meta description length (>160 chars) | 3 | 1 | 3.0 | 3 |
| **Low** | Complete Open Graph tags | 3 | 3 | 1.0 | 3 |
| **Low** | Fix internal links to redirects | 3 | 2 | 1.5 | 3 |
| **Low** | Optimize league slug usage | 2 | 2 | 1.0 | 3 |
| **Low** | Fix "Redirecting..." titles | 2 | 1 | 2.0 | 1 |
| **Low** | Eliminate redirect chains | 3 | 1 | 3.0 | 1 |

### By Implementation Effort (Low to High)

| Effort Level | Issues | Estimated Time |
|--------------|--------|----------------|
| **Low (1-2)** | Meta descriptions (long), titles, redirect chains, "Redirecting..." titles, H1 tags, www/protocol redirects, internal links to redirects, league slug usage | 1-2 hours each |
| **Medium (3-5)** | Create index pages, canonical URLs, sitemap cleanup, Open Graph tags, meta refresh → 301, robots.txt fix, internal link density | 4-8 hours each |
| **High (6-9)** | Orphan pages, hreflang, structured data, TTFB optimization | 1-3 days each |

---

## Implementation Notes

### Redirect Strategy (Phase 1)

**Current state:** `/matches/{uuid}` returns 200 with meta refresh + noindex
**Target state:** `/matches/{uuid}` returns 301 to `/leagues/{slug}/{match-slug}`

**Implementation options:**
1. **Next.js middleware** (recommended): Edge-based, fast, runs before page render
2. **API route handler**: Server-side, more flexibility but slower
3. **redirects in next.config.js**: Static redirects, good for known patterns but not dynamic UUIDs

**Recommendation:** Use Next.js middleware with database lookup or Bloom filter optimization for UUID → canonical mapping.

### Index Pages (Phase 1)

**Requirements for /models and /leagues:**
- Paginated listing (50-100 items per page)
- Each page has self-referencing canonical
- Filtering/sorting controls (with URL parameters)
- Unique H1 and meta description per page
- Breadcrumbs
- Internal links to individual model/league pages
- Schema.org CollectionPage or ItemList markup

**Don't:** Create thin, auto-generated content. Add league descriptions, model comparisons, filtering guidance.

### Canonical URL Architecture (Phase 1)

**Current issue:** Match pages at `/leagues/{slug}/{match-slug}` have canonical pointing to `/`

**Fix:** Update `generateMetadata` in match page layout:
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const canonicalUrl = `https://kroam.xyz/leagues/${params.slug}/${params.matchSlug}`;
  return {
    alternates: {
      canonical: canonicalUrl
    }
  };
}
```

**Verify:** Canonical should always point to the preferred URL for that specific content.

### Orphan Page Resolution (Phase 2)

**Strategy:**
1. Add models to /models index page (grouped by league or sorted by performance)
2. Add RelatedModelsWidget to league pages
3. Add "Prediction Models" section to match pages linking to models used
4. Update internal linking widgets to include orphan matches
5. Add "Recent Matches" section to model pages

**Target:** Every page should have 3-5 incoming internal links from relevant contexts.

### Structured Data Validation (Phase 6)

**Approach:**
1. Test with official Schema.org validator (baseline)
2. Test with Google Rich Results Test (production requirements)
3. Fix errors in priority: syntax errors → missing required properties → type mismatches
4. Validate in GSC after deployment

**Common issues:**
- Using outdated schema types (check schema.org for current types)
- Missing required properties (name, image, offers for Product)
- Incorrect property names (camelCase vs snake_case)
- Wrong data types (string vs number, date format)

---

## Complexity Estimates

| Phase | Total Issues | Estimated Effort | Risk Level |
|-------|--------------|------------------|------------|
| Phase 1: Foundation | 7 issues | 2-3 days | Medium (redirect logic, canonical mapping) |
| Phase 2: Discoverability | 5 issues | 3-4 days | Medium (orphan resolution requires content strategy) |
| Phase 3: Content Polish | 7 issues | 2-3 days | Low (mostly template updates) |
| Phase 4: Multi-Language | 3 issues | 2-3 days | High (subdomain infrastructure access required) |
| Phase 5: Performance | 1 issue | 3-5 days | High (database optimization, caching) |
| Phase 6: Advanced | 1 issue | 2-3 days | Medium (schema complexity) |
| **TOTAL** | **24 issues** | **14-21 days** | - |

---

## Success Metrics

### Phase 1 Success Criteria
- Zero 404 errors for /models and /leagues in GSC
- Zero meta refresh redirects (all 172 converted to 301)
- Zero canonical URLs pointing to /
- All www/protocol redirects return 301
- Zero redirect chains

### Phase 2 Success Criteria
- Zero orphan pages in Ahrefs audit
- All match pages have H1 tags
- Average internal link count per page >3
- All important pages in sitemap
- Zero redirect URLs in sitemap

### Phase 3 Success Criteria
- Meta descriptions 150-160 chars for all pages
- Title tags 50-60 chars for all pages
- All pages have complete Open Graph tags
- Zero internal links pointing to redirect targets

### Overall Success (All Phases)
- Ahrefs site health score >90/100
- Google Search Console: Zero indexation errors
- Average crawl rate increase of 50%+
- Structured data errors <10 (from 4365)

---

## Sources

### Redirect Architecture
- [Understanding URL Redirection: Meta Refresh vs. 301 Redirects - Oreate AI](https://www.oreateai.com/blog/understanding-url-redirection-meta-refresh-vs-301-redirects/9a7cc25432c35b063fe1c3a07e8687b4)
- [Redirects and Google Search | Google Search Central](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [What is 'meta refresh redirect' and why is it critical? | Ahrefs](https://help.ahrefs.com/en/articles/2433739-what-is-meta-refresh-redirect-and-why-is-it-considered-a-critical-issue)
- [A Guide To 301 Vs. 302 Redirects For SEO](https://www.searchenginejournal.com/301-vs-302-redirects-seo/299843/)
- [301 vs. 302 Redirect: Which to Choose for SEO and UX](https://www.semrush.com/blog/301-vs-302-redirect/)

### Canonical URLs
- [SEO: What are Canonical Tags? | Next.js](https://nextjs.org/learn/seo/canonical)
- [Set Canonical URL in Next.js - Code Concisely](https://www.codeconcisely.com/posts/nextjs-canonical-url/)
- [How to Use Canonical Tags and Hreflang in Next.js 15](https://www.buildwithmatija.com/blog/nextjs-advanced-seo-multilingual-canonical-tags)
- [Google Updates JavaScript SEO Docs With Canonical Advice](https://www.searchenginejournal.com/google-updates-javascript-seo-docs-with-canonical-advice/563545/)

### Orphan Pages & Internal Linking
- [Are Orphan Pages the Hidden SEO Problem to Fix in 2026?](https://www.clickrank.ai/orphan-pages-how-to-fix/)
- [Internal Linking Strategy: Complete SEO Guide for 2026](https://www.ideamagix.com/blog/internal-linking-strategy-seo-guide-2026/)
- [Internal Linking Structure: Complete Guide to 2026 SEO Success](https://www.clickrank.ai/effective-internal-linking-structure/)
- [Orphan Pages and Their Impact on SEO](https://neilpatel.com/blog/orphan-pages/)

### Structured Data
- [Issues - Structured Data: Validation Errors | Screaming Frog](https://www.screamingfrog.co.uk/seo-spider/issues/structured-data/validation-errors/)
- [Schema Markup Validation: Complete Guide & Tools 2026](https://koanthic.com/en/schema-markup-validation-complete-guide-tools-2026/)
- [How to Fix Schema Validation Errors](https://neilpatel.com/blog/schema-errors/)

### Hreflang
- [The Ultimate Guide to Hreflang Tag: Best Practices for SEO](https://www.weglot.com/guides/hreflang-tag)
- [Hreflang Implementation Guide: Complete Technical Reference 2026](https://www.linkgraph.com/blog/hreflang-implementation-guide/)
- [Localized Versions of your Pages | Google Search Central](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [How to Use Hreflang with Subdomains? | Flyrank](https://www.flyrank.com/blogs/seo-hub/how-to-use-hreflang-with-subdomains)

### SEO Prioritization
- [Will These 7 Winning On-Page Prioritization Strategies Elevate SEO in 2026?](https://www.clickrank.ai/on-page-prioritization/)
- [SEO strategy in 2026: Where discipline meets results](https://searchengineland.com/seo-strategy-in-2026-where-discipline-meets-results-463255)

### Index Pages
- [SEO for Category Pages: 12 Proven Ways to Optimize](https://neilpatel.com/blog/seo-category-pages/)
- [How To Use Ecommerce Category Page SEO To Drive Traffic (2026)](https://www.shopify.com/blog/ecommerce-category-page-seo)
- [11 Ways to Improve E-commerce Category Pages for SEO](https://ahrefs.com/blog/seo-ecommerce-category-pages/)

### Next.js Implementation
- [Functions: redirect | Next.js](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [Middleware in Next.js: Authentication, Redirects, and More](https://medium.com/@narayanansundar02/middleware-in-next-js-authentication-redirects-and-more-5b6a59c81291)
- [Next.js in 2026: Mastering Middleware, Server Actions, and Edge Functions](https://medium.com/@Amanda0/next-js-in-2026-mastering-middleware-server-actions-and-edge-functions-for-full-stack-d4ce24d61eea)

### TTFB Optimization
- [Optimizing TTFB in a Next.js App (step-by-step guide)](https://medium.com/@mrutyunjaya.9029/optimizing-ttfb-in-a-next-js-app-step-by-step-guide-e22d14a29868)
- [The Ultimate Guide to improving Next.js TTFB slowness](http://www.catchmetrics.io/blog/the-ultimate-guide-to-improving-nextjs-ttfb-slowness-from-800ms-to-less100ms)
- [How to Improve TTFB and Core Web Vitals in Next.js](https://medium.com/better-dev-nextjs-react/how-to-improve-ttfb-time-to-first-byte-and-core-web-vitals-in-next-js-3655891455d2)

### Meta Tags
- [Meta Title/Description Guide: 2026 Best Practices](https://www.stanventures.com/blog/meta-title-length-meta-description-length/)
- [How to Write Meta Descriptions | Google Search Central](https://developers.google.com/search/docs/appearance/snippet)
- [How to Optimize Title Tags & Meta Descriptions in 2026](https://www.straightnorth.com/blog/title-tags-and-meta-descriptions-how-to-write-and-optimize-them-in-2026/)

### Sitemap Generation
- [Metadata Files: sitemap.xml | Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Functions: generateSitemaps | Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)
- [SEO: XML Sitemaps | Next.js](https://nextjs.org/learn-pages-router/seo/crawling-and-indexing/xml-sitemaps)

### Crawl Budget
- [How to Manage Crawl Budget in Large-Scale Sites in 2026?](https://www.clickrank.ai/manage-crawl-budget/)
- [Crawl Budget Optimization: Complete Guide for 2026](https://www.linkgraph.com/blog/crawl-budget-optimization-2/)
- [Crawl Budget Management | Google Crawling Infrastructure](https://developers.google.com/crawling/docs/crawl-budget)
