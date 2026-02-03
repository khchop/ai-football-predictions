# Project Research Summary

**Project:** v2.2 Match Page Rewrite
**Domain:** SEO/GEO-optimized football match pages
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

The v2.2 match page rewrite is a consolidation effort, not a stack change. The existing Next.js 16 + React 19 + schema-dts stack is optimal. No new packages are required. The focus should be on architectural improvements: eliminating duplicate content (score shown 3+ times), establishing a context-based single source of truth for match data, and implementing state-aware layouts (upcoming/live/finished). The current page has grown organically with 15+ component imports and scattered state derivation.

The recommended approach is a context-driven component hierarchy where data is fetched once at page level, normalized into a `MatchContextValue`, and distributed via React Context. This eliminates prop drilling (currently 10+ components receive match data individually) and duplicate state derivation (`isFinished` calculated in 5+ places). The layout should be a single vertical scroll with sections: Match Info, Narrative, Predictions Table, FAQ. NO TABS on mobile (explicitly rejected by user in v1.3 and v2.1).

Key risks are historical: this is the 3rd attempt at fixing match pages. Previous failures stemmed from dual-render patterns (preview + full section = duplicate text), tabs on mobile, and big-bang rewrites that introduced regressions. The mitigation is incremental delivery (ship layout structure first, add sections one at a time) with explicit feature preservation checks. Each component must render content exactly once, and state derivation must happen at page level only.

## Key Findings

### Recommended Stack

The existing stack requires no changes. Next.js 16.1.4 with PPR provides optimal SSR/SSG with streaming metadata. React 19.2.3 Server Components handle data fetching. schema-dts 1.1.5 provides TypeScript types for all Schema.org structures.

**Core technologies:**
- **Next.js 16.1.4:** PPR for partial prerendering, `generateMetadata` for SEO, Server Components for data fetching
- **React 19.2.3:** Context for state distribution, Server Components for performance
- **schema-dts 1.1.5:** TypeScript types for SportsEvent, FAQPage, NewsArticle, BreadcrumbList
- **Tailwind CSS 4.x:** Styling, already configured

**What NOT to add:**
- No `next-seo` (conflicts with built-in metadata API)
- No AMP (obsolete for SEO in 2026)
- No additional schema packages (schema-dts is comprehensive)
- No client-side JSON-LD injection (server-render only)

### Expected Features

**Must have (table stakes):**
- Single authoritative score display (no duplicates)
- SportsEvent + FAQPage + BreadcrumbList schema in unified @graph
- Answer-first content structure (prediction visible in first 300px)
- State-aware layouts (upcoming/live/finished show different sections)
- Mobile single-scroll design (NO tabs, NO sticky headers)
- 35 LLM predictions table (core value proposition)
- Pre-match and post-match narrative content
- Auto-generated FAQ with match-specific questions

**Should have (competitive):**
- Match-state-specific FAQ (different questions for upcoming vs finished)
- Prediction accuracy FAQ for finished matches ("23/35 models predicted correctly")
- Consensus prediction as standalone citable statement
- Model accuracy indicators (visual tiers)
- dateModified schema for freshness signals

**Defer (v2+):**
- Team entity linking (requires team pages)
- Live match events timeline (complex, can add later)
- OG image per state (nice-to-have)

### Architecture Approach

Introduce a clean component hierarchy with `MatchDataProvider` context at the top. The page fetches all data in parallel (existing pattern is good), derives state once, normalizes into `MatchContextValue`, and wraps children in context. Components use `useMatch()` hook instead of receiving props. The `MatchLayout` component routes to state-specific layouts (UpcomingMatchLayout, LiveMatchLayout, FinishedMatchLayout) based on match status.

**Major components:**
1. **MatchPage** (Server Component) — Data fetching, SEO metadata, context creation
2. **MatchDataProvider** (Client Component) — Context boundary, provides normalized match data
3. **MatchLayout** — State router selecting appropriate layout variant
4. **MatchHero** — Single score/VS display point (eliminates duplication)
5. **MatchContent** — Narrative sections (pre-match OR post-match, never both)
6. **PredictionsTable** — 35 model predictions with sorting
7. **MatchFAQ** — Auto-generated FAQ with schema.org FAQPage integration

**Single-scroll section order:**
1. Breadcrumbs
2. H1 (semantic, sr-only if score in hero)
3. MatchHero (score OR "VS")
4. MatchTLDR (answer-first summary)
5. MatchContent (narrative)
6. MatchStats (if available)
7. PredictionsTable
8. MatchFAQ
9. RelatedContent

### Critical Pitfalls

1. **Dual-Render Pattern** — Component renders content twice (preview + full). Quick Task 008 fixed this exact issue. Prevention: each component renders content exactly once, no "preview then full" patterns.

2. **Duplicate Score Display** — Current page shows score in H1, header, and TL;DR. Prevention: `MatchHero` is the ONLY place score renders visually. H1 is sr-only for SEO.

3. **Implicit State Dependencies** — Components re-derive `isFinished` independently with different logic. Prevention: compute status ONCE at page level, pass via context, components trust context.

4. **Tabs on Mobile** — User explicitly rejected tabs in v1.3 and v2.1. Prevention: reject any tab-based proposals, single vertical scroll only.

5. **Big Bang Rewrite** — Previous rewrites touched 20+ files and introduced regressions. Prevention: ship incrementally (layout structure first, then sections one at a time), each PR independently deployable.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Context Foundation
**Rationale:** Establishes data flow pattern before changing any UI. Allows verification that context works without visual regressions.
**Delivers:** `MatchContextValue` type, `MatchDataProvider` component, `useMatch()` hook, `MatchLayout` router with placeholder layouts
**Addresses:** Prop drilling elimination, state derivation centralization
**Avoids:** Pitfall #3 (implicit state), #9 (multiple fetches)

### Phase 2: Hero Component
**Rationale:** Single score render point is the most critical deduplication. Must be solved before other sections can safely render match data.
**Delivers:** `MatchHero`, `TeamDisplay`, `ScoreDisplay` components with state-aware rendering
**Addresses:** Single authoritative score display (table stake)
**Avoids:** Pitfall #2 (duplicate score), #1 (dual-render)

### Phase 3: Content Sections
**Rationale:** Narrative content is the GEO value. Once hero is stable, content sections can be built without risking duplication.
**Delivers:** Refactored `MatchTLDR`, `MatchContent` with pre/post variants, state-aware narrative display
**Addresses:** Answer-first content, pre-match/post-match narratives
**Avoids:** Pitfall #5 (answer buried), #1 (dual-render)

### Phase 4: Predictions & Data
**Rationale:** Predictions table is core value prop but depends on correct state handling for sorting and badges.
**Delivers:** Refactored `PredictionsTable` using context, `MatchStats` component
**Addresses:** 35 model predictions display, consensus summary
**Avoids:** Pitfall #3 (multiple fetches), #9 (implicit state)

### Phase 5: FAQ & SEO
**Rationale:** FAQ generation depends on having correct match state and data. Schema integration should happen after content structure is stable.
**Delivers:** Expanded `MatchFAQ` with state-specific questions, FAQPage integrated into @graph, canonical tag verification
**Addresses:** Auto-generated FAQ, FAQPage schema, GEO optimization
**Avoids:** Pitfall #6 (schema mismatch), #7 (generic FAQ)

### Phase 6: Layout Assembly & Cleanup
**Rationale:** Final integration after all components are individually verified. Delete deprecated code only after new code is proven.
**Delivers:** `UpcomingMatchLayout`, `LiveMatchLayout`, `FinishedMatchLayout`, deleted deprecated components
**Addresses:** State-aware layouts, mobile single-scroll
**Avoids:** Pitfall #15 (losing features), #16 (big bang)

### Phase Ordering Rationale

- **Context first:** All subsequent phases depend on having a single source of truth for match data. Without this, components will continue to re-derive state and fetch data independently.
- **Hero before content:** Score duplication is the most visible bug. Fixing it first provides immediate value and establishes the "single render" principle for other components.
- **FAQ last before assembly:** FAQ depends on correct match state and content. Generating FAQs before content is stable would produce incorrect questions.
- **Incremental assembly:** Each phase produces deployable code. If any phase fails, the previous phases are still valuable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (FAQ & SEO):** May need to validate FAQ question patterns against actual search queries. Consider A/B testing FAQ variations.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Context Foundation):** Well-documented React Context pattern, existing Next.js 16 patterns in codebase
- **Phase 2 (Hero Component):** Pure component refactoring, no external dependencies
- **Phase 3-4 (Content/Predictions):** Refactoring existing components, established patterns
- **Phase 6 (Layout Assembly):** Standard React composition, no new patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via package.json and npm; no changes needed |
| Features | HIGH | Cross-referenced multiple GEO/SEO sources; existing implementation validates patterns |
| Architecture | HIGH | Based on direct codebase analysis; React Context is established pattern |
| Pitfalls | HIGH | Based on project history (quick-008, phase-24, phase-25) and industry research |

**Overall confidence:** HIGH

### Gaps to Address

- **MatchHero boundary:** Should breadcrumbs/back link be inside MatchHero or separate? Decide during Phase 2 planning.
- **Error boundaries:** Per-section or page-level? Research indicates per-section is better UX but adds complexity. Decide during Phase 6.
- **Skeleton states:** Research mentions loading UI but existing PPR may eliminate need. Validate during Phase 1.
- **Live match updates:** Current implementation uses polling. May need validation that context pattern doesn't break live updates.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct examination of `src/app/leagues/[slug]/[match]/page.tsx` and 15+ match components
- **Project history:** `.planning/quick/008-fix-duplicate-match-content/`, `.planning/phases/24-match-page-cleanup/`, `.planning/phases/25-content-rendering-fix/`
- **Next.js 16 docs:** PPR, Server Components, generateMetadata patterns
- **Schema.org:** SportsEvent, FAQPage, EventStatusType specifications

### Secondary (MEDIUM confidence)
- [GEO Best Practices 2026](https://www.firebrand.marketing/2025/12/geo-best-practices-2026/) — Citation patterns, answer-first content
- [FAQ Schema for AI Search](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) — 3.2x AI Overview appearances
- [Tabs UX Best Practices](https://www.eleken.co/blog-posts/tabs-ux) — When tabs fail on mobile
- [Sports Betting SEO 2026](https://tentenseven.com/sports-betting-seo/) — Sports-specific SEO patterns

### Tertiary (LOW confidence)
- GEO statistics (22-37% improvement with statistics) — Multiple sources cite, but methodology unclear
- "64% of sports fans on mobile" — Industry stat, source verification incomplete

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
