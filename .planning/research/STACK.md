# Technology Stack for UI/UX Rebuild

**Project:** AI Football Predictions - UI/UX Overhaul
**Researched:** 2026-02-02
**Focus:** Speed, SEO, GEO optimization

## Current Stack (Validated - No Changes Needed)

These are already in place and working well:

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 16.1.4 | Keep (latest is 16.1.6, minor patch) |
| React | 19.2.3 | Keep |
| Tailwind CSS | 4.x | Keep |
| shadcn/ui | Current | Keep |
| schema-dts | 1.1.5 | Keep (latest, actively used) |
| PostgreSQL | - | Keep |
| Redis | - | Keep |
| BullMQ | 5.34.3 | Keep |
| Sentry | 10.36.0 | Keep |

## Recommended Stack Changes

### 1. Enable Next.js 16 Cache Components + PPR

**What:** Enable `cacheComponents: true` in next.config.ts
**Why:** Unlocks Partial Prerendering (PPR) and explicit `"use cache"` directive
**Performance gain:** 60-80% TTFB reduction on mixed-content pages

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true, // Enables PPR + Cache Components
  // ... existing config
};
```

**No new dependencies required.** This is built into Next.js 16.

**Source:** [Next.js 16 Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)

---

### 2. Enable View Transitions API

**What:** Enable `experimental.viewTransition: true` in next.config.ts
**Why:** Native browser transitions for page navigation (GPU-accelerated, 60fps)
**User experience:** Smooth visual transitions without JavaScript animation overhead

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // ... existing config
};
```

**No new dependencies required.** Native browser API + React 19 integration.

**Browser support:** Chrome, Edge, Safari 18+ (progressive enhancement - falls back gracefully)

**Source:** [Next.js View Transitions](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition)

---

### 3. Native Sitemap Generation (Remove next-sitemap)

**What:** Replace next-sitemap with Next.js native sitemap.ts
**Why:**
- next-sitemap is a build-time tool; native sitemaps support ISR/dynamic generation
- One less dependency to maintain
- Better integration with App Router

**Current:** next-sitemap 4.2.3 installed
**Recommended:** Remove, use native `src/app/sitemap.ts`

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Dynamic sitemap generation with database queries
  const matches = await getRecentMatches();
  return matches.map(match => ({
    url: `https://kroam.xyz/leagues/${match.competitionSlug}/${match.slug}`,
    lastModified: match.updatedAt,
    changeFrequency: match.status === 'upcoming' ? 'daily' : 'weekly',
    priority: match.status === 'upcoming' ? 0.8 : 0.5,
  }));
}
```

**Source:** [Next.js Sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)

---

### 4. Font Optimization (Current: Inter, Keep)

**Current:** Inter font via next/font/google
**Status:** Good choice, no change needed

Inter is the most popular web font (414 billion Google Fonts requests in 12 months ending May 2025). It's optimized for screen readability and works well at small sizes.

**Verification:** Already using `next/font` with automatic self-hosting and zero layout shift.

**Optional enhancement:** Add Geist Mono for code/data displays (already referenced in CSS variables but not loaded).

**Source:** [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)

---

## Design System Enhancements

### 5. Tailwind CSS v4 @theme Tokens (No New Dependencies)

**What:** Migrate CSS custom properties to Tailwind v4 `@theme` directive
**Why:** Single source of truth for design tokens, automatic utility class generation

**Current state:** Using `:root` CSS variables in globals.css
**Recommended:** Migrate to `@theme inline` directive (already partially done)

```css
/* Already in globals.css - enhance this pattern */
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* ... tokens generate utilities: bg-primary, text-primary */
}
```

This is already partially implemented. Extend it to cover all semantic tokens.

**Source:** [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme)

---

### 6. shadcn/ui Design Token Extension (No New Dependencies)

**What:** Extend shadcn/ui theme with sports-specific semantic tokens
**Why:** Consistent visual language for match states, prediction confidence, scores

**Recommended tokens to add:**

```css
:root {
  /* Match status (already have --live, extend) */
  --status-upcoming: var(--primary);
  --status-live: #ef4444;
  --status-finished: var(--muted);

  /* Prediction confidence */
  --confidence-high: #22c55e;
  --confidence-medium: #eab308;
  --confidence-low: #ef4444;

  /* Score outcomes */
  --outcome-win: #22c55e;
  --outcome-draw: #eab308;
  --outcome-loss: #ef4444;
}
```

**Source:** [shadcn/ui Design Tokens](https://shadisbaih.medium.com/building-a-scalable-design-system-with-shadcn-ui-tailwind-css-and-design-tokens-031474b03690)

---

## SEO/GEO Optimization

### 7. FAQPage Schema for GEO (No New Dependencies)

**What:** Add FAQPage structured data to key pages
**Why:** 78% of AI-generated answers use list formats; FAQ schema has highest AI citation rates

**Implementation:** Use existing schema-dts library (already installed)

```typescript
import type { FAQPage, WithContext } from 'schema-dts';

function buildFAQSchema(questions: Array<{q: string, a: string}>): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}
```

**Pages to add FAQ schema:**
- Match pages: "What is the AI prediction?", "How accurate are the models?"
- League pages: "How many matches are covered?", "Which AI models predict?"
- Methodology page: Existing FAQ content

**Source:** [FAQPage Schema for GEO](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo)

---

### 8. Internal Linking Automation Strategy (Manual Implementation)

**What:** Implement topic cluster architecture with automated internal links
**Why:** Internal links are highest ROI SEO lever; manual linking doesn't scale

**Architecture (no library needed):**

```
Hub Pages (Pillar):
  /leagues/[slug]          - Competition hub
  /leaderboard             - Model performance hub
  /methodology             - How it works hub

Spoke Pages (Cluster):
  /leagues/[slug]/[match]  - Individual match (links to hub)
  /models/[id]             - Model detail (links to leaderboard)
  /blog/[slug]             - Content (links to relevant hubs)
```

**Implementation approach:**
1. Create `RelatedMatches` component showing other matches in same competition
2. Create `RelatedModels` component on match pages
3. Add "More predictions" sections with contextual links
4. Ensure 3-click depth maximum from homepage

**Source:** [Internal Linking Best Practices](https://trafficthinktank.com/internal-linking-best-practices/)

---

## What NOT to Add

### Rejected: Additional Animation Libraries

**Options considered:** Framer Motion, GSAP, react-spring
**Decision:** DO NOT ADD
**Rationale:**
- View Transitions API handles page transitions natively
- Tailwind's tw-animate-css (already installed) covers micro-interactions
- Additional animation libraries add bundle size without proportional UX benefit
- GPU-accelerated CSS transitions outperform JS animations

### Rejected: State Management Libraries

**Options considered:** Zustand, Jotai, Redux
**Decision:** DO NOT ADD
**Rationale:**
- React 19 + Server Components handle most state on server
- React Context sufficient for client state (theme, search modal)
- Adding state library increases complexity without solving real problems

### Rejected: next-seo Package

**Options considered:** next-seo
**Decision:** DO NOT ADD
**Rationale:**
- Next.js 16 Metadata API is more powerful and native
- Already have comprehensive metadata implementation in `/lib/seo/`
- next-seo adds abstraction layer over native features

### Rejected: Headless CMS

**Options considered:** Sanity, Contentful, Payload
**Decision:** DO NOT ADD (for this milestone)
**Rationale:**
- Blog content already stored in PostgreSQL
- Adding CMS increases complexity without solving current problems
- Consider for future milestone if content volume increases

---

## Core Web Vitals Targets

| Metric | Current | Target | Strategy |
|--------|---------|--------|----------|
| LCP | Unknown | < 2.5s | PPR static shell, preload hero images |
| INP | Unknown | < 200ms | Break long tasks, React Compiler auto-memoization |
| CLS | Unknown | < 0.1 | Already using next/font, add explicit image dimensions |

**Measurement:** Use Vercel Analytics (already integrated via Sentry) or add `web-vitals` for client-side metrics.

---

## Installation Summary

### Add to next.config.ts

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  cacheComponents: true, // NEW: Enables PPR + Cache Components
  experimental: {
    viewTransition: true, // NEW: Native page transitions
  },
  images: {
    // ... existing config
  },
  async redirects() {
    // ... existing redirects
  },
};

export default withSentryConfig(nextConfig, {
  // ... existing Sentry config
});
```

### Remove (Optional)

```bash
npm uninstall next-sitemap  # Replace with native sitemap.ts
```

### No New Packages Required

All recommended changes use:
- Built-in Next.js 16 features
- Already-installed libraries (schema-dts, Tailwind v4)
- Native browser APIs (View Transitions)

---

## Confidence Assessment

| Recommendation | Confidence | Reason |
|----------------|------------|--------|
| Cache Components + PPR | HIGH | Official Next.js 16 docs, stable feature |
| View Transitions | MEDIUM | Experimental flag, but browser API is stable |
| Native Sitemap | HIGH | Official Next.js feature, documented pattern |
| FAQPage Schema | HIGH | Research shows direct GEO impact |
| Internal Linking | MEDIUM | Strategy proven, implementation is manual effort |
| Remove next-sitemap | MEDIUM | Native alternative exists, but migration effort |

---

## Sources

**Next.js 16 Features:**
- [Next.js 16 Blog](https://nextjs.org/blog/next-16)
- [Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components)
- [PPR Guide](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
- [View Transitions Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition)

**Performance:**
- [Core Web Vitals 2026](https://roastweb.com/blog/core-web-vitals-explained-2026)
- [Vercel CWV Guide](https://vercel.com/kb/guide/optimizing-core-web-vitals-in-2024)

**SEO/GEO:**
- [GEO Structured Data](https://www.digidop.com/blog/structured-data-secret-weapon-seo)
- [FAQ Schema for GEO](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo)
- [Internal Linking Best Practices](https://trafficthinktank.com/internal-linking-best-practices/)

**Design System:**
- [Tailwind v4 Theme](https://tailwindcss.com/docs/theme)
- [shadcn/ui Design Tokens](https://shadisbaih.medium.com/building-a-scalable-design-system-with-shadcn-ui-tailwind-css-and-design-tokens-031474b03690)
