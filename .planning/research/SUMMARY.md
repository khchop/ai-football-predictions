# Research Summary: v2.6 SEO/GEO Site Health

**Milestone:** v2.6
**Researched:** 2026-02-05
**Documents:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Key Findings

### 1. Zero New Runtime Dependencies Needed (STACK)

Next.js 16 App Router provides native solutions for 95% of SEO fixes:
- `permanentRedirect()` for HTTP redirects
- `generateMetadata()` with `alternates.canonical` for canonical URLs
- `sitemap.ts` / `generateSitemaps()` for sitemap management
- `schema-dts` v1.1.5 already installed for structured data types

**Decision:** Do NOT install `next-intl`, `next-sitemap`, or validation libraries. Remove hreflang declarations instead of implementing i18n (subdomains non-functional).

### 2. Most Issues Are Configuration Fixes, Not New Features (ARCHITECTURE)

The codebase has well-structured SEO primitives:
- Centralized metadata builders in `src/lib/seo/metadata.ts`
- @graph JSON-LD pattern in `src/components/MatchPageSchema.tsx`
- Dynamic sitemaps via route handlers in `src/app/sitemap/`
- League slug alias system with 308 redirects

**Root cause of many issues:** Root layout (`src/app/layout.tsx`) likely cascading canonical URL `/` to all child pages, and declaring hreflang for non-functional subdomains.

### 3. Feature Priority: Foundation → Discoverability → Polish (FEATURES)

24 issues across 6 phases, with critical path:
1. Fix redirects + create index pages + fix canonicals (Phase 1 - highest impact)
2. Fix orphan pages + sitemap hygiene + H1 tags (Phase 2 - discoverability)
3. Meta descriptions + OG tags + internal link cleanup (Phase 3 - polish)
4. Remove hreflang declarations (Phase 4 - stop active harm)
5. TTFB optimization (Phase 5 - performance)
6. Structured data validation (Phase 6 - rich results)

### 4. Top Pitfalls to Watch (PITFALLS)

| # | Pitfall | Risk | Action |
|---|---------|------|--------|
| 1 | Canonical cascading from root layout | HIGH | Remove canonical from root layout, let pages set their own |
| 2 | Hreflang pointing to 503 subdomains | HIGH | Remove language alternates immediately |
| 3 | Meta refresh may already be fixed | HIGH | Verify with `curl -I` before changing redirect code |
| 4 | Duplicate Organization schema | CONFIRMED | Deduplicate between root layout and MatchPageSchema |
| 5 | Redirect chain (www → https) | MEDIUM | Fix at infrastructure level, single-hop 301 |

---

## Architecture Overview

```
CURRENT STATE (Issues)              TARGET STATE (After fixes)
─────────────────────────           ─────────────────────────
Root layout:                        Root layout:
  canonical: / (cascades!)            canonical: REMOVED
  hreflang: 5 broken subdomains      hreflang: REMOVED
  3 JSON-LD (dupes MatchPage)         1 JSON-LD (Organization only)

/matches/[id]:                      /matches/[id]:
  permanentRedirect (308)             permanentRedirect (308) ✓
  noindex (safety net)                noindex (safety net) ✓
  Ahrefs sees meta refresh?           Verify with curl

/leagues/[slug]/[match]:            /leagues/[slug]/[match]:
  canonical → / (broken!)             canonical → self-referential ✓
  missing H1                          H1: "{Home} vs {Away}" ✓
  short descriptions                  enriched descriptions ✓

/models: 404                        /models: index page ✓
/leagues: 404                       /leagues: index page ✓

Sitemaps: no index, has UUIDs      Sitemaps: index + clean URLs ✓
Internal: 35 links to redirects    Internal: direct short slugs ✓
Orphans: 65 models, 47 matches     Orphans: linked from index pages ✓
www redirect: 302                   www redirect: 301 ✓
```

---

## Recommended Implementation Order

### Phase 1: Foundation (Critical - Highest ROI)
- Remove canonical and hreflang from root layout
- Create /models and /leagues index pages (fix 404s)
- Verify match redirect behavior (308 vs meta refresh)
- Fix www/protocol redirects (302 → 301)
- Add H1 tags to match pages

### Phase 2: Sitemap & Internal Linking
- Create sitemap index file
- Remove non-canonical /matches/UUID from sitemaps
- Add missing league pages to sitemap
- Fix internal links to use short-form slugs
- Add cross-linking widgets (models ↔ leagues ↔ matches)

### Phase 3: Content Optimization
- Optimize meta descriptions (too short/too long)
- Optimize title tag lengths
- Complete Open Graph tags on all pages
- Enrich index page content

### Phase 4: Structured Data
- Deduplicate Organization/WebSite schemas
- Fix SportsEvent validation errors
- Fix Article/FAQPage validation errors
- Add CollectionPage schema to index pages

### Phase 5: Performance (if time permits)
- Investigate TTFB on slow pages (28 pages, 2-7s)
- Database query optimization or caching strategy

---

## Risk Assessment

| Category | Risk Level | Key Concern | Mitigation |
|----------|-----------|-------------|------------|
| Redirect changes | Medium | Breaking production traffic | Verify with curl before/after |
| Canonical fixes | Low | Root layout removal is simple | Test with next build |
| Index pages | Low | Standard Next.js pages | No existing code affected |
| Hreflang removal | Low | One-line deletion | Improves SEO immediately |
| Structured data | Medium | Regressions in rich results | Fix incrementally, validate |
| Sitemap changes | Low | Crawl budget storm | Stage across deploys |

**Overall assessment:** Low-medium risk. Most changes are additive or corrective. The riskiest change (canonical fix) has a clear root cause and simple fix.

---

## Scope

**In scope:** All 24 Ahrefs-identified issues
**Out of scope:** i18n implementation (deferred — remove broken hreflang instead), new language content
**Dependencies:** Coolify access may be needed for www/protocol redirect fix
**Estimated phases:** 4-5 (structured data and performance could be combined or split)
