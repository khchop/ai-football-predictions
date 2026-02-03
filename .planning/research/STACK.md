# Stack Research: v2.2 Match Page Rewrite

**Domain:** SEO/GEO-optimized match pages for AI Football Predictions Platform
**Researched:** 2026-02-03
**Overall Confidence:** HIGH

---

## Executive Summary

The existing stack is well-suited for SEO/GEO-optimized match pages. Next.js 16.1.4 with PPR, React 19.2.3, and schema-dts 1.1.5 already provide the foundation. The codebase has comprehensive JSON-LD structured data implementation using `@graph` patterns.

**Key Finding:** No new packages required. Focus is on configuration changes and content structure improvements, not stack additions.

---

## Recommended Stack

### Core Framework (KEEP AS-IS)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 16.1.4 | SSR/SSG with PPR, metadata API | Current - verified |
| React | 19.2.3 | Component rendering | Current - verified |
| Tailwind CSS | 4.x | Styling | Current - verified |
| schema-dts | 1.1.5 | TypeScript types for JSON-LD | Current - verified |

**Rationale:** Next.js 16 has native support for streaming metadata, which improves perceived performance without blocking UI rendering. The `generateMetadata` function is already properly implemented in the codebase.

### Structured Data (ENHANCE EXISTING)

| Technology | Version | Purpose | Action |
|------------|---------|---------|--------|
| schema-dts | 1.1.5 | Schema.org TypeScript types | Keep - already installed |

**Note:** The existing `schema-dts` package provides TypeScript types for all required Schema.org types (SportsEvent, FAQPage, NewsArticle, BreadcrumbList). No additional schema packages needed.

### No New Packages Required

The existing stack already includes everything needed:

- **Metadata:** Next.js built-in `generateMetadata` function
- **JSON-LD:** Native JSON.stringify with XSS sanitization
- **Schema Types:** schema-dts provides all types
- **Content Structure:** React Server Components
- **Caching:** Next.js PPR + Suspense boundaries

---

## Schema.org Types for Match Pages

### Current Implementation (Working Well)

The codebase already implements a comprehensive `@graph` structure in `src/lib/seo/schema/graph.ts`:

```typescript
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", ... },     // Site identity
    { "@type": "SportsEvent", ... },      // Match data
    { "@type": "NewsArticle", ... },      // Content metadata
    { "@type": "BreadcrumbList", ... }    // Navigation
  ]
}
```

### Schema Types to ADD to @graph

| Type | Purpose | Priority |
|------|---------|----------|
| FAQPage | Auto-generated FAQ from match data | HIGH - critical for GEO |
| WebPage | Page-level metadata with speakable | MEDIUM - improves AI parsing |

**FAQPage Addition:** The `MatchFAQSchema.tsx` component exists but renders separately. For v2.2, integrate FAQPage into the main `@graph` array for unified structured data.

### SportsEvent Properties (Current vs. Optimal)

| Property | Current | Optimal | Notes |
|----------|---------|---------|-------|
| `@type` | SportsEvent | SportsEvent | Correct |
| `name` | "{Home} vs {Away}" | "{Home} vs {Away}" | Correct |
| `startDate` | ISO 8601 | ISO 8601 | Correct |
| `eventStatus` | EventScheduled | EventScheduled/EventPostponed | Add postponed handling |
| `homeTeam` | SportsTeam | SportsTeam | Correct |
| `awayTeam` | SportsTeam | SportsTeam | Correct |
| `competitor` | Array | Array | Correct |
| `homeTeamScore` | number (when finished) | number | Correct |
| `awayTeamScore` | number (when finished) | number | Correct |
| `location` | Place | Place with address | Already has address |
| `sport` | "Football" | "https://schema.org/Football" | Consider URL form |

### EventStatus Values (schema.org official)

| Value | When to Use |
|-------|-------------|
| `EventScheduled` | Match is scheduled (current default) |
| `EventPostponed` | Match postponed, new date TBD |
| `EventRescheduled` | Match rescheduled to new date |
| `EventCancelled` | Match cancelled |

**Current Bug:** The `mapEventStatus` function always returns `EventScheduled`. Should handle postponed/cancelled statuses from the database.

---

## Configuration Changes

### next.config.ts

No changes required. Current configuration is optimal:

```typescript
{
  cacheComponents: true, // PPR enabled
  experimental: {
    viewTransition: true,
  },
  // images config already set for api-sports.io
  // redirects already handle league URL normalization
}
```

### robots.txt / Sitemap

The existing implementation is correct. No changes needed for:
- `robots: { index: true, follow: true }` for active matches
- `robots: { index: false, follow: true }` for matches > 30 days old

### Headers for AI Crawlers

**Recommendation:** Add custom headers for AI bot identification (optional, low priority):

```typescript
// next.config.ts - headers section (if needed)
async headers() {
  return [
    {
      source: '/matches/:path*',
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'index, follow, max-snippet:-1, max-image-preview:large',
        },
      ],
    },
  ];
}
```

This signals to crawlers (including GPTBot, ClaudeBot, PerplexityBot) that full content snippets are allowed.

---

## GEO Optimization Requirements

### Content Structure for AI Citations

Based on 2026 GEO research, content should be structured in "200-400 word semantic blocks that can stand alone as answers."

**Current Implementation Gap:** The `MatchContentSection` component renders long-form content without explicit semantic chunking.

**Recommendation:** Structure content with clear H2/H3 question headers that match FAQ questions:

```html
<article>
  <h1>Man Utd vs Liverpool Prediction</h1>

  <section aria-label="summary">
    <p>AI predicts Manchester United 2-1 Liverpool...</p>  <!-- First 100 words = answer -->
  </section>

  <h2>Who will win Man Utd vs Liverpool?</h2>
  <p>Based on 35 AI models, 67% predict a Manchester United win...</p>

  <h2>What is the predicted score?</h2>
  <p>The consensus prediction is 2-1 to Manchester United...</p>
</article>
```

### Blockquote Pattern (Already Implemented)

The `PredictionInsightsBlockquote.tsx` component correctly uses `<blockquote>` for citable AI insights. This pattern should be maintained and expanded.

### Statistics Addition (HIGH IMPACT)

Research shows statistics addition improves GEO visibility by 22-37%. The codebase already includes:
- Model prediction counts ("35 AI models")
- Win percentage calculations
- Average predicted scores

**Recommendation:** Make statistics more prominent with explicit numerical formatting.

---

## What NOT to Add

### DO NOT Add: next-seo package

**Why:** Next.js 16 has built-in metadata API that supersedes next-seo. Mixing them causes duplicate tags and conflicts.

**Current status:** Correctly using Next.js native metadata.

### DO NOT Add: react-helmet or similar

**Why:** Server Components don't support client-side head manipulation. The `generateMetadata` pattern is the correct approach.

### DO NOT Add: Additional schema packages

**Why:** `schema-dts` already provides comprehensive TypeScript types for all Schema.org types. Adding `schema-org-json-ld` or similar would duplicate functionality.

### DO NOT Add: Structured data validation at runtime

**Why:** JSON-LD validation should be done at build time or via Google's Rich Results Test, not in production code. Runtime validation adds bundle size with no user benefit.

### DO NOT Add: Client-side structured data injection

**Why:** Search engines prefer server-rendered JSON-LD. Client-side injection via JavaScript is less reliable and may not be indexed correctly.

### DO NOT Add: AMP (Accelerated Mobile Pages)

**Why:** Google no longer requires AMP for Top Stories. Next.js 16 with PPR provides comparable or better performance. AMP adds complexity without SEO benefit in 2026.

### DO NOT Change: schema-dts to newer version

**Why:** Version 1.1.5 is current (verified via npm). The package is stable and matches schema.org specifications.

---

## File-by-File Recommendations

### Files to Modify (v2.2)

| File | Change | Priority |
|------|--------|----------|
| `src/lib/seo/schema/graph.ts` | Add FAQPage to @graph array | HIGH |
| `src/lib/seo/schema/sports-event.ts` | Handle EventPostponed/EventCancelled | MEDIUM |
| `src/components/match/MatchFAQSchema.tsx` | Expand FAQ questions, integrate with @graph | HIGH |
| `src/lib/seo/types.ts` | Add postponed/cancelled to MatchStatus | LOW |

### Files to Keep Unchanged

| File | Reason |
|------|--------|
| `next.config.ts` | Already optimal |
| `package.json` | No new dependencies needed |
| `src/lib/seo/metadata.ts` | Well-implemented metadata generation |
| `src/lib/seo/constants.ts` | Correct length limits and defaults |

---

## Summary Table

| Category | Recommendation | Confidence |
|----------|---------------|------------|
| Core Stack | Keep as-is | HIGH |
| Schema Types | Add FAQPage to @graph | HIGH |
| New Packages | None required | HIGH |
| Configuration | Minor eventStatus enhancement | HIGH |
| Content Structure | Add semantic H2/H3 patterns | HIGH |
| Anti-patterns | Avoid next-seo, AMP, client-side JSON-LD | HIGH |

---

## Sources

### Official Documentation
- [Next.js generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Verified current
- [Schema.org SportsEvent](https://schema.org/SportsEvent) - Official specification
- [Schema.org EventStatusType](https://schema.org/EventStatusType) - EventScheduled, EventPostponed, etc.

### GEO Research (2026)
- [GEO Trends 2026](https://webdesignerindia.medium.com/geo-trends-2026-generative-engine-optimization-992ffa83b186) - Market trends
- [GEO Best Practices](https://www.digitalauthority.me/resources/generative-engine-optimization-best-practices/) - Implementation patterns
- [What is GEO 2026](https://discoveredlabs.com/blog/what-is-geo-generative-engine-optimization-explained-2026) - Technical recommendations
- [Next.js SEO 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition) - Framework-specific guidance

### Package Verification
- `npm view schema-dts version` - Confirmed 1.1.5 is current
- package.json analysis - Confirmed all versions current
