# Project Research Summary

**Project:** v2.0 UI/UX Overhaul for AI Football Predictions Platform
**Domain:** Sports prediction platform with SEO and AI citation (GEO) optimization
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

The v2.0 UI/UX overhaul is a **rebuild of presentation layer** over a solid data foundation. The existing stack (Next.js 16, React 19, Tailwind v4, shadcn/ui, PostgreSQL, Redis) requires no major changes — the problems are structural: cluttered match pages with duplicate data rendering, poor mobile navigation, weak internal linking, and missing GEO optimization. The recommended approach enables Next.js 16's Partial Prerendering (PPR) and View Transitions API, extends the existing design system with semantic tokens, and systematically adds FAQ schema to all page types for AI citation optimization.

Industry research confirms three critical patterns for sports prediction platforms: (1) mobile-first navigation with bottom nav bar (21% faster task completion), (2) tabbed content organization reducing scroll fatigue, and (3) answer-first content structure for AI engine citations (3.2x improvement with FAQ schema). The current platform already validates many mobile patterns from v1.3 (touch targets, swipe gestures, tabs) but lacks systematic GEO optimization and has cluttered desktop layouts with data appearing 3+ times per page.

The key risks are: client component creep destroying bundle size (audit all 71+ component files), LCP regression from hero changes during redesign (mark new LCP elements with priority), and breaking existing URLs (document all routes before any changes). The mitigation strategy is to establish clear server/client boundaries in Phase 1, add Lighthouse to CI before visual changes, and preserve the existing route structure (`/leagues/[slug]/[match]`).

## Key Findings

### Recommended Stack

**No new packages required.** All recommendations use built-in Next.js 16 features, already-installed libraries (schema-dts, Tailwind v4), or native browser APIs.

**Core technologies (keep as-is):**
- **Next.js 16.1.4**: Enable `cacheComponents: true` for PPR, `experimental.viewTransition: true` for native transitions
- **React 19.2.3**: Use existing Server Components pattern, minimize client boundaries
- **Tailwind CSS v4**: Extend `@theme` directive for semantic design tokens
- **shadcn/ui**: Add sports-specific tokens (status-live, confidence-high, outcome-win)
- **schema-dts 1.1.5**: Expand FAQPage schema to match, league, model pages

**Configuration changes (next.config.ts):**
```typescript
cacheComponents: true,  // Enables PPR + Cache Components
experimental: { viewTransition: true }  // Native page transitions
```

**Remove (optional):**
- **next-sitemap**: Replace with native `src/app/sitemap.ts` for ISR-compatible dynamic sitemaps

**What NOT to add:**
- Animation libraries (View Transitions API handles page transitions, tw-animate-css handles micro-interactions)
- State management (React 19 + Server Components sufficient)
- Headless CMS (blog content in PostgreSQL works fine)

### Expected Features

**Must have (table stakes):**
- **Bottom navigation bar** — 21% faster mobile navigation, thumb-zone optimized (4-5 items max)
- **Mobile-first responsive design** — 64.95% of sports fans on mobile, 5x abandonment if broken
- **Fast page loads (<2.5s LCP)** — Google CWV threshold, enables PPR for static shell
- **Sticky header with score** — Score visible while scrolling stats (already have, preserve)
- **Tabbed content organization** — Already validated in v1.3, reduces scroll fatigue
- **Blog readable line width** — 600-700px optimal (currently full-width)

**Should have (competitive advantage):**
- **FAQ sections on all major pages** — 3.2x more likely AI Overview appearances, 28% more AI citations
- **Question-answer format content** — Matches how AI platforms present information
- **Contextual internal links** — Auto-link team names, model names, competitions in text
- **Time-based leaderboards** — Weekly/monthly fresh start increases engagement
- **Model performance trends** — Line charts showing improvement/decline over time

**Defer (v2+):**
- **Predictive preloading** — Requires analytics + ML, high complexity
- **Model comparison tables** — Valuable but scope creep risk
- **Pull-to-refresh** — Nice-to-have mobile pattern
- **Reading progress indicator** — Minor enhancement

### Architecture Approach

The architecture transitions from monolithic page components (387 lines) to a server-first composition model with strategic client boundaries. Key pattern: **Static Shell + Dynamic Holes** via PPR where navigation, layout, and schema render at build time while scores, predictions, and related content stream in at request time.

**Major components:**

1. **MatchShell (Server)** — PPR static shell wrapping entire match page, renders at build time
2. **MatchScore (Server + Suspense)** — Single source of truth for score, streams in with live data
3. **MatchContentAI (Server)** — GEO-optimized content with answer-first structure and FAQ schema
4. **MatchInternalLinks (Server)** — Systematic link generation for related matches, models, competitions
5. **ArticleShell (Server)** — Blog layout wrapper with table of contents and structured markdown
6. **BottomNavigation (Client)** — Mobile navigation in thumb zone, 4-5 primary actions

**Data flow optimization:**
- Create `getMatchComplete()` query consolidating 4+ overlapping queries into single optimized fetch
- Add Suspense boundaries for heavy widgets (PredictionsFull, RelatedMatches)
- Push client boundaries down: extract only interactive bits (animations, state) into tiny client components

### Critical Pitfalls

1. **Client Component Creep** — Adding `'use client'` cascades to children, bloating bundle 30-60%. **Prevention:** Audit every directive, server for data, client for interaction only. Detection: `grep -r "'use client'" src/components | wc -l`

2. **LCP Regression** — New hero/above-fold changes without `priority` attribute cause 2-4s delay. **Prevention:** Identify LCP element per page type before redesign, add PageSpeed Insights to CI, test on 3G throttled connection

3. **Breaking Existing URLs** — Route changes cause 25-80% SEO traffic loss. **Prevention:** Document all URLs before redesign, keep existing routes or implement 301 redirects, test all old URLs post-deployment

4. **ISR Cache Staleness** — Two caching layers (Next.js + CDN) create 2x stale time. **Prevention:** For live data use `dynamic = 'force-dynamic'`, configure CDN for `must-revalidate`, use on-demand revalidation for critical updates

5. **Structured Data Breaks** — Schema.org JSON-LD removed during component refactoring. **Prevention:** Keep schema in dedicated `/lib/seo/` module (already done), add schema validation to test suite, monitor Search Console enhancements report

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Design System Foundation
**Rationale:** Establishes component patterns and boundaries before any visual changes. Quick wins with no user-visible risk.
**Delivers:**
- Enable PPR in next.config.ts
- Semantic design tokens (status, confidence, outcome colors)
- Component pattern library (DataCard, StreamedSection, ResponsiveLayout)
- Server/client boundary documentation
**Addresses:** Mobile-first design (table stakes), design consistency
**Avoids:** Client component creep (P1), over-engineering design system (P10)

### Phase 2: Match Page Rebuild
**Rationale:** Highest traffic pages, most user-visible impact. Depends on Phase 1 patterns.
**Delivers:**
- MatchShell static wrapper for PPR
- Single MatchScore component replacing 3 duplicate displays
- Condensed stats display eliminating duplication
- Suspense boundaries for streaming
- MatchCard converted to server component
**Uses:** PPR (STACK), DataCard pattern (Phase 1)
**Implements:** Static Shell + Dynamic Holes architecture
**Addresses:** Sticky header (table stakes), tabbed navigation (table stakes), progressive disclosure
**Avoids:** Duplicate data display (P1), LCP regression (P2)

### Phase 3: Blog/Content System Rebuild
**Rationale:** Second major page type, enables GEO optimization. Independent of match pages.
**Delivers:**
- ArticleShell with consistent blog layout
- Structured markdown parser with heading extraction
- Table of contents for long posts
- GEO content structure (answer-first, FAQ format)
- Readable line width (max-w-prose)
**Addresses:** Blog readability (table stakes), FAQ sections (competitive), Q&A format content (competitive)
**Avoids:** Structured data breaks (P5)

### Phase 4: Navigation & Internal Linking
**Rationale:** Cross-cutting concern affecting all pages. Depends on Phase 2-3 component structure.
**Delivers:**
- Bottom navigation bar for mobile
- Centralized `getMatchLinks()` / `getLeagueLinks()` generation
- MatchInternalLinks component for systematic linking
- Prefetch optimization on hover/focus
- Related content widgets (matches, models, posts)
**Uses:** Native Link prefetch (STACK)
**Addresses:** Bottom nav (table stakes), internal linking excellence (competitive)
**Avoids:** Broken internal links (P7), navigation state loss (P6)

### Phase 5: GEO & SEO Optimization
**Rationale:** After content structure is solid, optimize for discovery. Independent of other phases.
**Delivers:**
- FAQPage schema on match, league, model pages
- Native sitemap.ts replacing next-sitemap
- Consolidated JSON-LD @graph structure
- Answer-first content templates
- Entity consistency across pages
**Uses:** schema-dts (STACK), native sitemap (STACK)
**Addresses:** FAQ sections (competitive), AI citation optimization
**Avoids:** Schema fragmentation (P5)

### Phase 6: Performance & Polish
**Rationale:** Final optimization after all components are built. Validates PPR and streaming benefits.
**Delivers:**
- Client boundary audit (minimize JS bundle)
- loading.tsx files for streaming UX
- Core Web Vitals validation (LCP <2.5s, INP <200ms, CLS <0.1)
- View Transitions polish
**Targets:** TTFB <200ms, mobile LCP <1.8s, bundle size reduction 30%+
**Avoids:** LCP regression (P2), ISR staleness (P4)

### Phase Ordering Rationale

- **Phase 1 first:** Foundation patterns prevent technical debt accumulation in later phases
- **Phase 2-3 parallel possible:** Match and blog rebuilds are independent page types
- **Phase 4 after 2-3:** Navigation and linking depend on final component structure
- **Phase 5 independent:** GEO optimization can run parallel with Phase 4 or after
- **Phase 6 last:** Performance audit requires all components to be complete

**Dependency chain:**
```
Phase 1 (Foundation)
  |
  +---> Phase 2 (Match) --+
  |                       |
  +---> Phase 3 (Blog) ---+--> Phase 4 (Navigation)
                          |
                          +--> Phase 5 (GEO)
                               |
                               v
                          Phase 6 (Performance)
```

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Match page refactoring touches 387 lines of complex JSX with parallel data fetching. Verify current data query patterns before splitting components.
- **Phase 4:** Internal linking automation needs entity recognition strategy. Determine which entities to auto-link (teams, models, competitions) and link validation approach.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Design tokens and PPR configuration are well-documented Next.js 16 patterns
- **Phase 3:** Blog layout and TOC generation are standard patterns
- **Phase 5:** Schema.org FAQPage and sitemap.ts are documented standards
- **Phase 6:** Performance auditing has established Lighthouse/CWV tooling

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js 16 docs verified, no new packages needed, configuration changes only |
| Features | HIGH | Cross-referenced sports betting UX, mobile navigation, GEO optimization across 15+ sources |
| Architecture | HIGH | Next.js App Router + PPR patterns well-documented, codebase analysis confirms feasibility |
| Pitfalls | HIGH | Verified via official docs, GitHub issues, and current codebase observation |

**Overall confidence:** HIGH

### Gaps to Address

- **Performance baselines:** Current TTFB, LCP, mobile page weight not measured. Need baseline before Phase 6 to validate improvements.
- **Entity auto-linking scope:** Research identifies contextual links as high-value but implementation details (which entities, validation) need Phase 4 planning.
- **AI citation tracking:** No way to measure if GEO changes improve AI citations. Consider manual tracking (weekly Perplexity/ChatGPT searches) or wait for GEO analytics tools.
- **Mobile device testing matrix:** Touch target requirements identified but no testing plan. Define device matrix (iOS Safari, Android Chrome minimum) for Phase 2 acceptance.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Blog](https://nextjs.org/blog/next-16) — PPR, Cache Components, View Transitions
- [Next.js Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components) — PPR implementation
- [Next.js View Transitions Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) — Native transitions
- [Next.js Sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) — Native sitemap generation
- [Tailwind CSS v4 Theme](https://tailwindcss.com/docs/theme) — Design token architecture

### Secondary (MEDIUM confidence)
- [FAQ Schema for GEO](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) — 3.2x AI Overview appearances
- [AI Citation Patterns](https://www.tryprofound.com/blog/ai-platform-citation-patterns) — ChatGPT vs Perplexity citation behaviors
- [Internal Linking Best Practices](https://trafficthinktank.com/internal-linking-best-practices/) — Contextual link value
- [Mobile Navigation UX 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) — Bottom nav patterns
- [Sports Betting App UX 2026](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/) — Mobile-first sports UX

### Tertiary (LOW confidence)
- [GEO Will Replace SEO](https://statuslabs.com/blog/how-geo-will-replace-traditional-seo-in-2026) — Emerging GEO patterns
- [Predictive preloading](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7) — Advanced ML-based preloading (defer to v2+)

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
