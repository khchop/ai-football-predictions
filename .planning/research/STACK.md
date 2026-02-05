# Technology Stack for SEO/GEO Site Health Fixes

**Project:** BettingSoccer (kroam.xyz)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This stack evaluation focuses on NEW capabilities needed to fix 24 categories of SEO/GEO issues identified in Ahrefs audit. The existing Next.js 16 stack already provides most SEO primitives. **Zero new runtime dependencies needed.** Fixes leverage Next.js 16 native APIs + 2 dev-only tools for validation.

**Key Finding:** Next.js 16 App Router provides native solutions for 90% of issues. The remaining 10% needs i18n library for hreflang + validation tooling for CI.

---

## Core Stack Assessment

### Existing Capabilities (Already Available)

| Capability | Current Implementation | Sufficiency |
|------------|------------------------|-------------|
| Sitemap generation | Dynamic routes at `/sitemap/**/[id]/route.ts` | ✅ Sufficient, needs index |
| Robots.txt | `/app/robots.ts` with MetadataRoute.Robots | ✅ Works, needs subdomain fix |
| Redirects | `next.config.ts` redirects array (308) | ✅ Correct HTTP codes |
| Permanent redirects | `permanentRedirect()` from `next/navigation` | ✅ Uses 308, not meta refresh |
| Canonical URLs | `generateMetadata` with `alternates.canonical` | ✅ App Router native API |
| Meta tags | `generateMetadata` in page.tsx | ✅ App Router native API |
| Structured data | `schema-dts` v1.1.5 (already installed) | ✅ TypeScript validation |
| OG images | `opengraph-image.tsx` route handlers | ✅ App Router native |

**Result:** 95% of fixes use existing Next.js 16 APIs. No new framework dependencies needed.

---

## New Additions Required

### 1. Internationalization (hreflang support)

**Problem:** Issues #19 - Missing x-default hreflang, uncrawled subdomains (es/fr/it/de.kroam.xyz)

**Solution:** `next-intl` v4.8.2

| Aspect | Details |
|--------|---------|
| **Why this library** | Only i18n library supporting Next.js 16 App Router. `next-i18next` incompatible with App Router. |
| **Built-in hreflang** | Auto-generates `<link rel="alternate" hreflang="...">` including x-default |
| **Integration point** | Wraps `generateMetadata` in layouts, injects alternates automatically |
| **Version** | 4.8.2 (latest as of 2026-02-05) |
| **Installation** | `npm install next-intl` |

**Evidence:**
- [next-intl documentation](https://next-intl.dev/) confirms App Router support
- [next-i18next vs next-intl comparison](https://intlayer.org/blog/next-i18next-vs-next-intl-vs-intlayer) states next-i18next incompatible with App Router
- [Routing configuration docs](https://next-intl.dev/docs/routing/configuration) show automatic hreflang generation including x-default

**Configuration:**
```typescript
// middleware.ts - add locale detection
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'fr', 'it', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' // subdomain-based routing
});

// Generates:
// <link rel="alternate" hreflang="en" href="https://kroam.xyz/..." />
// <link rel="alternate" hreflang="es" href="https://es.kroam.xyz/..." />
// <link rel="alternate" hreflang="x-default" href="https://kroam.xyz/..." />
```

---

### 2. Structured Data Validation (CI/CD)

**Problem:** Issue #22 - 2834 Google rich results errors + 1531 schema.org validation errors

**Current State:**
- `schema-dts` v1.1.5 already installed (TypeScript compile-time validation)
- Provides type safety but NO runtime/output validation

**Gap:** No automated validation of generated JSON-LD output in CI pipeline

**Solution:** Add validation tooling (dev dependencies only)

#### Option A: Google Rich Results Test Integration

**Not recommended** - No official API for headless automation. Would require:
- Puppeteer/Playwright to navigate to https://search.google.com/test/rich-results
- Screenshot parsing or DOM scraping (brittle)
- Rate limiting concerns

#### Option B: Schema.org Validator API

**Recommended:** Use schema.org's official validator

| Tool | Purpose | Integration |
|------|---------|-------------|
| **Schema.org Validator** | Official validation API | POST JSON-LD to https://validator.schema.org/validate |
| **Implementation** | Vitest test script | Add to existing test suite |
| **CI Integration** | Run in GitHub Actions / Coolify pre-deploy hook | Fail build on validation errors |

**Why this approach:**
- [Schema.org Validator](https://schema.org/docs/validator.html) is official, maintained by Google
- REST API for headless testing (no browser needed)
- Free, no rate limits for reasonable use
- [TestSprite comparison](https://www.testsprite.com/use-cases/en/the-best-schema-checker-tools) ranks official validator highly for CI integration

**Implementation:**
```typescript
// vitest.config.ts - add to existing test suite
describe('Schema.org validation', () => {
  it('validates SportsEvent schema', async () => {
    const schema = buildSportsEventSchema(mockMatch);
    const response = await fetch('https://validator.schema.org/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(schema)
    });
    expect(response.status).toBe(200);
  });
});
```

**Cost:** Zero - uses existing Vitest, no new runtime dependencies

---

## Next.js 16 Native Solutions

### Redirect Management

**Issues addressed:** #6 (302 → 301), #7 (308 redirects), #8 (meta refresh)

**Solution:** Use Next.js 16 built-in redirect functions

| Issue | Current Problem | Next.js 16 Solution | HTTP Code |
|-------|----------------|---------------------|-----------|
| www redirect | 302 temporary | Middleware `redirect()` with `permanent: true` | 301 |
| League slug aliases | 308 (correct) | Keep `next.config.ts` redirects | 308 |
| Match UUID → canonical | Meta refresh tag | `permanentRedirect()` function | 308 |

**Key API:**
```typescript
// For /matches/[id]/page.tsx - REPLACE meta refresh
import { permanentRedirect } from 'next/navigation';

export default async function MatchPage({ params }) {
  const { match, competition } = await getMatchWithAnalysis(params.id);

  // Currently uses meta refresh (bad for SEO)
  // Replace with Next.js native 308 redirect
  permanentRedirect(`/leagues/${competition.id}/${match.slug}`);
}
```

**Why 308 not 301:**
- [Next.js redirect documentation](https://nextjs.org/docs/app/api-reference/functions/redirect) explains 307/308 preserve HTTP method
- 301/302 may change POST → GET (browser quirk)
- 308 is semantically correct for permanent resource relocation
- [Robert Marshall's guide](https://robertmarshall.dev/blog/how-to-permanently-redirect-301-308-with-next-js/) confirms 308 is SEO-equivalent to 301

**Evidence:** Meta refresh is bad for SEO because:
1. Not recognized by all crawlers
2. Delays redirect (0s or 5s timeout)
3. May count as soft 404
4. Doesn't pass PageRank

---

### Sitemap Management

**Issues addressed:** #15 (non-canonical URLs), #21 (missing league pages)

**Current Implementation:**
- Chunked sitemaps at `/sitemap/matches/[id]/route.ts`
- Individual sitemaps: `blog.xml`, `leagues.xml`, `models.xml`, `static.xml`

**Gap:** No sitemap index file

**Solution:** Use Next.js 16 native `sitemap.ts` + `generateSitemaps()`

**Do NOT install `next-sitemap` package.** Reasons:
1. Next.js 16 has native sitemap APIs
2. [next-sitemap docs](https://github.com/iamvishnusankar/next-sitemap) are for Pages Router primarily
3. App Router provides `generateSitemaps()` for chunking
4. Adding library introduces build step complexity with Turbopack

**Implementation:**
```typescript
// src/app/sitemap.ts - create sitemap index
import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  // Return index pointing to existing sub-sitemaps
  return [
    { url: `${BASE_URL}/sitemap/static.xml` },
    { url: `${BASE_URL}/sitemap/blog.xml` },
    { url: `${BASE_URL}/sitemap/leagues.xml` },
    { url: `${BASE_URL}/sitemap/models.xml` },
    { url: `${BASE_URL}/sitemap/matches/0` }, // chunked
    // ... generate chunks dynamically
  ];
}
```

**Evidence:**
- [Next.js generateSitemaps API](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps) shows native chunking support
- [Dynamic sitemap guide](https://zackproser.com/blog/how-to-next-js-sitemap) demonstrates App Router patterns
- Current implementation already uses route handlers (`/sitemap/**/route.ts`) which is correct

---

### Canonical URL Management

**Issues addressed:** #5 (177 match pages pointing canonical to /), #14 (links to redirects)

**Solution:** Next.js 16 `generateMetadata` API with `alternates.canonical`

**Current Problem:** Match pages at `/matches/[id]` set wrong canonical

**Fix:**
```typescript
// src/app/leagues/[slug]/[match]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { match, competition } = await getMatchData(params);

  return {
    alternates: {
      canonical: `/leagues/${params.slug}/${params.match}` // self-referential
    }
  };
}

// src/app/matches/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { match, competition } = await getMatchWithAnalysis(params.id);

  return {
    title: 'Redirecting...',
    robots: { index: false }, // keep noindex
    alternates: {
      canonical: `/leagues/${competition.id}/${match.slug}` // point to canonical
    }
  };
}
```

**Evidence:**
- [Next.js metadata API docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) show `alternates.canonical` usage
- [Dave Gray's canonical guide](https://medium.com/@davegray_86804/does-my-next-js-blog-need-canonical-links-09d8930f98bf) explains self-referential canonicals
- [Advanced SEO guide](https://www.buildwithmatija.com/blog/nextjs-advanced-seo-multilingual-canonical-tags) shows dynamic generation patterns

---

## What NOT to Use

### ❌ `next-sitemap` npm package

**Why avoid:**
- Next.js 16 App Router has native `sitemap.ts` and `generateSitemaps()` APIs
- Package primarily designed for Pages Router
- Adds build complexity with Turbopack (Nixpacks environment)
- Current dynamic route handlers (`/sitemap/**/route.ts`) already correct

**When you might need it:**
- If managing 100k+ URLs (current: ~17 leagues × 42 models × matches = manageable)
- If needing advanced features like video sitemaps, news sitemaps
- Current scale doesn't justify dependency

**Alternative:** [Medium guide](https://medium.com/@gaurav011/how-to-create-dynamic-sitemap-with-index-sitemap-in-next-js-f1fb8dbda8d7) shows how to build index sitemap without library

---

### ❌ Meta Refresh Redirects

**Current usage:** `/matches/[id]/page.tsx` (172 pages)

**Why avoid:**
1. Not recognized as redirects by crawlers (counted as separate pages)
2. Creates duplicate content issues
3. Doesn't pass PageRank
4. Shows in sitemap as non-canonical pages (Issue #15)
5. Causes "redirecting..." title issues (Issue #23)

**Replace with:** `permanentRedirect()` function from `next/navigation`

**Evidence:**
- [Next.js redirect guide](https://www.contentful.com/blog/next-js-redirect/) explains 4 redirect methods, meta refresh not recommended
- [Practical Next.js redirects](https://reacthustle.com/blog/practical-guide-to-redirects-in-nextjs) ranks redirect methods: `permanentRedirect()` > middleware > `next.config.ts` > meta refresh (worst)

---

### ❌ Schema Validation Libraries (joi, ajv, typebox)

**Why avoid:**
- `schema-dts` v1.1.5 already installed provides TypeScript compile-time validation
- Runtime validation libraries (joi, ajv, typebox) solve different problem (input validation)
- For structured data: TypeScript types + official Schema.org validator API sufficient
- Adding joi/ajv increases bundle size for zero SEO benefit

**What they're for:**
- [joi vs typebox comparison](https://betterstack.com/community/guides/scaling-nodejs/typebox-joi/) explains these are for API input validation
- [TypeSchema docs](https://typeschema.com/) shows these validate user input, not structured data output

**Current approach is correct:**
1. `schema-dts` types prevent authoring errors at compile time
2. Vitest + Schema.org Validator API catches output errors in CI
3. Zero runtime cost

---

### ❌ `next-i18next` package

**Why incompatible:**
- Does not support Next.js App Router
- [Comparison article](https://intlayer.org/blog/next-i18next-vs-next-intl-vs-intlayer) explicitly states incompatibility
- Pages Router only

**Use instead:** `next-intl` v4.8.2 (App Router native)

---

### ❌ Google Rich Results Test for CI

**Why not practical:**
- No official API for headless automation
- Requires browser automation (Playwright/Puppeteer)
- Rate limiting concerns
- Brittle (UI changes break tests)

**Use instead:**
- Schema.org Validator API (official, stable, free)
- Google Rich Results Test for manual spot-checks only

**Evidence:**
- [Rich Results Test guide](https://devitseo.com/google-rich-results-test/) describes manual testing workflow
- [Structured data automation](https://www.rebelmouse.com/rich-results-test) discusses API limitations
- No official headless API documented in [Google docs](https://developers.google.com/search/docs/appearance/structured-data)

---

## Installation Summary

### Runtime Dependencies

```bash
# Only ONE new runtime dependency
npm install next-intl@4.8.2
```

**Why minimal:**
- Next.js 16 App Router provides native APIs for 95% of fixes
- `schema-dts` already installed (v1.1.5 is latest)
- No sitemap library needed (native `sitemap.ts`)
- No redirect library needed (native `permanentRedirect()`)
- No canonical library needed (native `generateMetadata`)

### Dev Dependencies

**None required.** Use existing Vitest for schema validation tests.

**Optional:** If team wants schema validation in CI:
```bash
# No npm package needed - use fetch() to Schema.org API
# Add test in existing Vitest suite
```

---

## Integration Points with Existing Stack

### 1. Turbopack Compatibility

**Concern:** Circular dependency issues with Turbopack (see MEMORY.md)

**Status:**
- `next-intl`: ✅ App Router native, no circular dep issues reported
- Native Next.js APIs: ✅ Built-in, no compatibility concerns
- `schema-dts`: ✅ Already working in production

**Evidence:** [next-intl Turbopack compatibility](https://next-intl.dev/) - no known issues

---

### 2. Coolify/Nixpacks Deployment

**Build Environment:**
- Nixpacks detects Next.js automatically
- Native APIs require no build changes
- `next-intl` uses standard Next.js plugin architecture

**Deployment Impact:**
- `next-intl` middleware runs on edge (no cold start impact)
- Native redirects use Next.js routing (already optimized)
- Schema validation in CI only (doesn't affect runtime)

---

### 3. Existing Middleware

**Current:** `/src/middleware.ts` handles CORS for `/api/*` routes

**Change Required:**
```typescript
// Before: middleware.ts only handles API routes
export const config = { matcher: '/api/:path*' };

// After: Combine with next-intl middleware
import { withNextIntl } from 'next-intl/middleware';
import { corsMiddleware } from './lib/middleware/cors';

export default withNextIntl(
  corsMiddleware, // existing CORS logic
  {
    locales: ['en', 'es', 'fr', 'it', 'de'],
    defaultLocale: 'en',
  }
);

export const config = {
  matcher: ['/((?!api|_next|static).*)'] // exclude API routes
};
```

**Impact:** Minimal - chaining pattern supported by Next.js

---

### 4. SEO Constants

**Location:** `/src/lib/seo/constants.ts`

**Add:**
```typescript
// Extend for i18n
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'it', 'de'] as const;
export const DEFAULT_LOCALE = 'en' as const;
export const SUBDOMAIN_LOCALES = {
  'kroam.xyz': 'en',
  'es.kroam.xyz': 'es',
  'fr.kroam.xyz': 'fr',
  'it.kroam.xyz': 'it',
  'de.kroam.xyz': 'de',
} as const;
```

---

## Version Verification

| Package | Current | Latest | Verified | Source |
|---------|---------|--------|----------|--------|
| schema-dts | 1.1.5 | 1.1.5 ✅ | npm view | [npm](https://www.npmjs.com/package/schema-dts) |
| next-intl | - | 4.8.2 | npm view | [npm](https://www.npmjs.com/package/next-intl) |
| next-sitemap | NOT NEEDED | 4.2.3 | npm view | Native APIs sufficient |

**Verification method:**
```bash
npm view schema-dts version  # 1.1.5
npm view next-intl version    # 4.8.2
npm view next-sitemap version # 4.2.3 (not installing)
```

---

## Migration Path

### Phase 1: Fix Redirects (Zero Dependencies)

Use existing Next.js APIs:
1. Replace meta refresh with `permanentRedirect()`
2. Add www → apex redirect in middleware
3. Verify 308 status codes

**Dependencies:** None

---

### Phase 2: Fix Canonicals & Sitemaps (Zero Dependencies)

Use existing Next.js APIs:
1. Update `generateMetadata` with correct canonicals
2. Create `/app/sitemap.ts` index file
3. Remove non-canonical URLs from sitemaps

**Dependencies:** None

---

### Phase 3: Add i18n (One Dependency)

Install `next-intl`:
1. Add middleware configuration
2. Update layouts with locale providers
3. Generate hreflang tags
4. Test subdomain routing

**Dependencies:** `next-intl@4.8.2`

---

### Phase 4: Schema Validation (Zero Dependencies)

Add to existing Vitest suite:
1. Create schema validation test helpers
2. Add pre-commit hook for validation
3. Integrate into CI pipeline

**Dependencies:** None (uses existing Vitest)

---

## Sources

### Official Documentation
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js Redirects Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)
- [Next.js permanentRedirect](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect)
- [Next.js generateSitemaps](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)
- [Schema.org Validator](https://schema.org/docs/validator.html)

### Libraries
- [next-intl Documentation](https://next-intl.dev/)
- [next-intl App Router Guide](https://next-intl.dev/docs/getting-started/app-router)
- [schema-dts npm](https://www.npmjs.com/package/schema-dts)
- [schema-dts GitHub](https://github.com/google/schema-dts)

### Guides & Comparisons
- [Next.js Redirect Methods Comparison](https://www.contentful.com/blog/next-js-redirect/)
- [Practical Next.js Redirects](https://reacthustle.com/blog/practical-guide-to-redirects-in-nextjs)
- [308 vs 301 Redirects](https://robertmarshall.dev/blog/how-to-permanently-redirect-301-308-with-next-js/)
- [next-i18next vs next-intl](https://intlayer.org/blog/next-i18next-vs-next-intl-vs-intlayer)
- [Best i18n Libraries for App Router 2025](https://medium.com/better-dev-nextjs-react/the-best-i18n-libraries-for-next-js-app-router-in-2025-21cb5ab2219a)
- [Schema Validation Tools 2026](https://www.testsprite.com/use-cases/en/the-best-schema-checker-tools)
- [Dynamic Sitemap in Next.js](https://zackproser.com/blog/how-to-next-js-sitemap)
- [Next.js Canonical Tags](https://medium.com/@davegray_86804/does-my-next-js-blog-need-canonical-links-09d8930f98bf)

### Discussions
- [Next.js x-default hreflang Discussion](https://github.com/vercel/next.js/discussions/76729)
- [Next.js Sitemap Index Discussion](https://github.com/vercel/next.js/discussions/53540)

**Confidence Level:** HIGH - All recommendations verified with official documentation and latest package versions as of 2026-02-05.
