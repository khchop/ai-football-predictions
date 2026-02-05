# Architecture Patterns: SEO/GEO Site Health Fixes

**Project:** BettingSoccer (kroam.xyz)
**Researched:** 2026-02-05
**Domain:** Technical SEO for Next.js 16 Sports Prediction Platform
**Confidence:** HIGH (based on comprehensive codebase analysis)

## Executive Summary

This architecture research maps **how** to fix 24 SEO issues within the **existing** Next.js 16 App Router architecture. The key finding: the codebase already has well-structured SEO primitives (centralized metadata builders, structured data schemas, dynamic sitemaps). Most fixes are **configuration corrections** or **pattern completions**, not greenfield builds.

**Critical architectural insight:** The `/matches/[id]/page.tsx` already uses `permanentRedirect()` (HTTP 308) — NOT meta refresh as initially suspected from Ahrefs data. The Ahrefs crawler may be reporting stale data or the redirect was recently fixed. This needs verification against production.

---

## Current SEO Architecture

### Layer 1: Routing & Redirects

```
┌─────────────────────────────────────────────────┐
│ next.config.ts                                   │
│ ├─ League alias redirects (308 permanent)        │
│ │  premier-league → epl, champions-league → ucl  │
│ │  europa-league → uel, la-liga → laliga         │
│ │  serie-a → seriea, ligue-1 → ligue1           │
│ └─ Match redirects via page-level permanentRedirect │
├─────────────────────────────────────────────────┤
│ src/middleware.ts                                 │
│ └─ CORS only (matcher: /api/:path*)              │
│    ⚠ No www/protocol redirects here              │
├─────────────────────────────────────────────────┤
│ Page-level redirects                             │
│ ├─ /matches/[id]/page.tsx → permanentRedirect()  │
│ │  to /leagues/{competitionId}/{match.slug}       │
│ └─ /leagues/[slug]/page.tsx → permanentRedirect() │
│    when slug is alias (not canonical ID)          │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. www.kroam.xyz → kroam.xyz uses 302 (should be 301) — needs middleware or hosting config
2. http → https uses 302 (should be 301) — hosting/Coolify config
3. Internal links still use long-form slugs that trigger 308 redirects

### Layer 2: Metadata Generation

```
┌─────────────────────────────────────────────────┐
│ src/lib/seo/metadata.ts (centralized builders)   │
│ ├─ buildMatchMetadata(match, activeModels)        │
│ │  ├─ Dynamic title (team abbrevs, 60 chars max) │
│ │  ├─ Status-based descriptions (upcoming/live/done)│
│ │  ├─ Canonical: /leagues/{compId}/{matchSlug}    │
│ │  ├─ OG type: article, Twitter: summary_large    │
│ │  └─ Noindex for matches >30 days old            │
│ ├─ generateCompetitionMetadata(comp, models)      │
│ │  ├─ Title: "{League} Predictions | N Models"    │
│ │  ├─ Dynamic OG image via /api/og/league         │
│ │  └─ Canonical: /leagues/{competitionId}         │
│ ├─ generateHomeMetadata()                         │
│ └─ generateLeaderboardMetadata(comp?, models)     │
├─────────────────────────────────────────────────┤
│ src/lib/seo/abbreviations.ts                     │
│ └─ Team/competition name shortening for titles    │
│    Manchester United → Man Utd, PSG, etc.         │
├─────────────────────────────────────────────────┤
│ src/lib/seo/constants.ts                         │
│ ├─ BASE_URL, SITE_NAME                           │
│ ├─ MAX_TITLE_LENGTH = 60                         │
│ ├─ MAX_META_DESCRIPTION_LENGTH = 155             │
│ ├─ MAX_OG_DESCRIPTION_LENGTH = 200               │
│ └─ DEFAULT_MODEL_COUNT = 35                      │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. Canonical URLs on match pages reportedly pointing to `/` — verify if metadata.ts canonical override is being applied correctly
2. Title lengths >60 chars on some pages — truncation logic exists but may have edge cases
3. Meta descriptions too short (<100 chars) on some pages — description builders may need enrichment
4. Missing H1 tags on 350 match pages — component-level issue, not metadata builder
5. OG tags incomplete on 47 pages — some page types may not call metadata builders

### Layer 3: Structured Data (JSON-LD)

```
┌─────────────────────────────────────────────────┐
│ src/components/MatchPageSchema.tsx                │
│ └─ @graph pattern (single script, multiple entities)│
│    ├─ Organization (@id: kroam.xyz#organization)  │
│    ├─ WebSite                                     │
│    ├─ SportsEvent (teams, scores, venue)          │
│    ├─ WebPage                                     │
│    ├─ Article (GEO: datePublished, dateModified)  │
│    ├─ FAQPage (AI-generated match FAQs)           │
│    └─ BreadcrumbList (4-level hierarchy)          │
├─────────────────────────────────────────────────┤
│ src/lib/seo/schema/                              │
│ ├─ sports-event.ts (SportsEvent with teams/scores)│
│ ├─ article.ts (speakable property for voice)      │
│ ├─ breadcrumb.ts (match/league/blog/model crumbs) │
│ └─ competition.ts (areaServed geographic mapping)  │
├─────────────────────────────────────────────────┤
│ src/app/layout.tsx (root layout)                 │
│ └─ 3 static JSON-LD scripts                      │
│    ├─ Organization                                │
│    ├─ WebSite                                     │
│    └─ SoftwareApplication                         │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. 2834 Google Rich Results validation errors — likely missing required properties or type mismatches
2. 1531 Schema.org validation errors — structural issues in @graph pattern or entity references
3. Duplicate Organization schema (root layout + MatchPageSchema) — may cause conflicts

### Layer 4: Sitemaps

```
┌─────────────────────────────────────────────────┐
│ src/app/sitemap/ (route handlers)                │
│ ├─ static.xml/route.ts (home, about, etc.)       │
│ ├─ leagues.xml/route.ts (club competitions)       │
│ ├─ matches/[id]/route.ts (chunked, 45k per chunk)│
│ ├─ blog.xml/route.ts (published posts)            │
│ └─ models.xml/route.ts (all models)               │
│                                                   │
│ ⚠ Missing: sitemap index file (sitemap.xml)      │
│ ⚠ Issue: /matches/UUID pages in sitemap           │
│    (should only have /leagues/{slug}/{match})     │
│ ⚠ Issue: 7 league pages missing from sitemap      │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. No sitemap index at `/sitemap.xml` — robots.txt references it but it may not exist
2. Non-canonical /matches/UUID pages included in sitemaps
3. Some league pages missing (non-club competitions?)

### Layer 5: Internal Linking

```
┌─────────────────────────────────────────────────┐
│ Navigation & Linking                             │
│ ├─ Breadcrumbs (src/components/navigation/)      │
│ │  └─ Home > Leagues > {Comp} > {Match}          │
│ ├─ Match cards link to /leagues/{compId}/{slug}   │
│ ├─ League hub lists upcoming/recent matches       │
│ └─ ⚠ No /models or /leagues index pages          │
│                                                   │
│ Orphan page problem:                             │
│ ├─ 65 model pages: no internal links pointing in  │
│ └─ 47 match pages: no internal links pointing in  │
│                                                   │
│ Slug system:                                      │
│ ├─ Short (canonical): epl, ucl, laliga, etc.     │
│ ├─ Long (alias): premier-league, champions-league │
│ └─ 35 internal links use long-form → 308 redirect │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. Create /models index page (currently 404, 110 inlinks)
2. Create /leagues index page (currently 404, inlinks)
3. Fix orphan pages by adding internal links from index pages and related content widgets
4. Update link generation to use short-form slugs

### Layer 6: i18n & Robots

```
┌─────────────────────────────────────────────────┐
│ src/app/robots.ts                                │
│ ├─ Default: Allow /, Disallow admin/api/_next    │
│ ├─ AI crawler whitelist (GPTBot, ClaudeBot, etc.)│
│ └─ Sitemap: https://kroam.xyz/sitemap.xml        │
├─────────────────────────────────────────────────┤
│ src/app/layout.tsx (i18n alternates)             │
│ ├─ en-US, en → kroam.xyz                         │
│ ├─ de → de.kroam.xyz                             │
│ ├─ es → es.kroam.xyz                             │
│ ├─ fr → fr.kroam.xyz                             │
│ └─ it → it.kroam.xyz                             │
│                                                   │
│ ⚠ Subdomains exist in meta but:                  │
│   - No actual content served on subdomains        │
│   - robots.txt returns 503 on all 4 subdomains   │
│   - No x-default hreflang                        │
│   - No middleware routing for locales              │
└─────────────────────────────────────────────────┘
```

**Issues to fix:**
1. Subdomains declared in hreflang but not serving content (503)
2. Missing x-default hreflang
3. Either implement subdomain content OR remove hreflang declarations

---

## Recommended Architecture Changes

### Change 1: Middleware Expansion

**Current:** CORS-only middleware for /api/* routes
**Target:** Add www/protocol redirects + optional locale detection

```
src/middleware.ts
├─ Match /api/* → CORS handling (existing)
├─ Match www.kroam.xyz → 301 to kroam.xyz (new)
├─ Match http:// → 301 to https:// (new, may be Coolify-level)
└─ Future: locale detection for subdomains
```

**Risk:** Low — middleware runs at edge, redirect logic is simple
**Alternative:** Handle www/http redirects at Coolify/Nixpacks level (preferred if possible)

### Change 2: Index Page Creation

**New pages needed:**
```
src/app/leagues/page.tsx          # League listing with descriptions
src/app/models/page.tsx           # Model listing with performance stats
```

**Architecture:** Standard Next.js App Router pages with:
- `generateMetadata()` for SEO
- Database queries for content
- Internal links to all league/model pages
- Schema.org CollectionPage/ItemList markup
- Pagination (if needed for models)

### Change 3: Sitemap Index

**New file:**
```
src/app/sitemap.ts                # Sitemap index (MetadataRoute.Sitemap)
```

**References existing sub-sitemaps:**
- /sitemap/static.xml
- /sitemap/leagues.xml
- /sitemap/models.xml
- /sitemap/blog.xml
- /sitemap/matches/0, /sitemap/matches/1, ...

### Change 4: Internal Link Enhancement

**New components/widgets:**
```
src/components/widgets/
├─ RelatedModelsWidget.tsx        # Show models on league pages
├─ RecentMatchesWidget.tsx        # Show matches on model pages
└─ LeagueNavigationWidget.tsx     # Cross-link between leagues
```

**Integration points:**
- League hub page → add RelatedModelsWidget
- Model page → add RecentMatchesWidget
- Match page → add "Models used" section

### Change 5: Hreflang Resolution

**Option A (Recommended): Remove subdomain declarations**
- Delete language alternates from root layout
- Don't install next-intl
- Simplest fix, no new complexity
- Revisit when actual translations exist

**Option B: Implement subdomain routing**
- Install next-intl
- Configure middleware for locale detection
- Serve translated content on subdomains
- High complexity, deferred to future milestone

---

## Integration Risk Assessment

| Change | Files Affected | Risk | Mitigation |
|--------|---------------|------|------------|
| Middleware expansion | 1 file | Low | Test redirect behavior with curl |
| Index pages | 2 new files | Low | Standard Next.js pages |
| Sitemap index | 1 new file | Low | Simple metadata route |
| Canonical fix | metadata.ts + page layouts | Medium | Verify with production build |
| Structured data fix | schema/*.ts + MatchPageSchema | Medium | Validate with Schema.org API |
| Internal links | 3 new widgets + page updates | Medium | Incremental, testable |
| Hreflang fix | layout.tsx | Low | Remove declarations or implement |
| H1 tags | Match page components | Low | Component-level changes |
| Meta tag optimization | metadata.ts builders | Low | Update string builders |

---

## Key Architectural Decisions

### Decision 1: Where to handle www/http redirects?

**Options:**
1. Next.js middleware (code-level control)
2. Coolify/Nixpacks configuration (infrastructure-level)
3. DNS-level (Cloudflare or similar)

**Recommendation:** Check Coolify config first. If Coolify supports redirect rules, handle there (faster, no app code). If not, use middleware.

### Decision 2: How to fix canonical URLs?

**Root cause investigation needed:** The metadata builders in `metadata.ts` already set correct canonicals. The Ahrefs report showing canonicals pointing to `/` suggests either:
1. A layout-level canonical override (root layout sets canonical to /)
2. The canonical is being set correctly but a parent layout overrides it
3. Stale Ahrefs data from before a recent fix

**Action:** Verify production canonical tags with `curl -s https://kroam.xyz/leagues/epl/some-match | grep canonical`

### Decision 3: Fix or remove hreflang?

**Current state:** Root layout declares language alternates for 5 subdomains, but subdomains return 503.

**Recommendation:** Remove hreflang declarations for now. They actively hurt SEO when pointing to non-functional subdomains. Add back when translations are implemented.

### Decision 4: How to resolve orphan pages?

**Strategy:** Hub-and-spoke model
- /models → links to all model pages (hub)
- /leagues → links to all league pages (hub)
- Each league page → links to models (cross-linking)
- Each model page → links to recent matches (cross-linking)

---

## Sources

- Codebase analysis: src/lib/seo/, src/app/sitemap/, src/middleware.ts, src/app/layout.tsx
- Next.js 16 App Router: https://nextjs.org/docs/app
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js permanentRedirect: https://nextjs.org/docs/app/api-reference/functions/permanentRedirect
- Schema.org @graph pattern: https://schema.org/docs/howwework.html
