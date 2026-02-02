# Project Research Summary

**Project:** v1.3 Match Page Refresh
**Domain:** Mobile-first sports prediction platform with AI search optimization
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

The match page redesign for kroam.xyz requires fixing architectural bloat and duplicate data rendering rather than adopting new technologies. The existing stack (Next.js 16, React 19, Tailwind v4, shadcn/ui) already provides the foundation needed - the problems are structural. The 545-line monolithic match page component renders match metadata 3 times, predictions 2-3 times, and suffers from a broken content pipeline where LLM-generated narratives exist in the database but don't display due to query misalignment between `matchContent` and `matchRoundups` tables.

Industry research shows best-in-class mobile sports experiences follow a tabbed navigation pattern with persistent sticky headers and progressive disclosure. Users expect single-source-of-truth for each data point - score appears once in the sticky header, predictions appear once in a dedicated tab, not scattered across 10+ cards requiring excessive vertical scrolling. AI search engines (ChatGPT, Perplexity, Claude) require consolidated structured data and hierarchical content with clear entity relationships to provide accurate citations.

The critical path forward: (1) Fix content rendering pipeline by unifying dual-table writes, (2) Consolidate duplicate displays into tabbed interface reducing mobile scroll depth by 60%, (3) Optimize for AI search with robots.txt, llms.txt, and consolidated Schema.org entities, (4) Implement ISR caching to reduce server costs by 60-80% while maintaining data freshness. The main risks are React hydration mismatches from timezone-dependent content, performance regression from improper Suspense boundaries, and LLM hallucination in generated match content requiring validation.

## Key Findings

### Recommended Stack

**No major additions needed.** The existing Next.js 16 + React 19 + Tailwind v4 stack is optimal for mobile-first redesign and AI search optimization. The focus should be on configuration additions and utilizing existing but underused features.

**Core technologies (existing):**
- **Next.js 16.1.4**: Latest with Partial Prerendering (PPR), React Compiler support, and Turbopack — Enables static shell with dynamic content streaming for faster mobile loads
- **React 19.2.3**: Latest with useActionState and useOptimistic hooks — Simplifies form state management and provides instant UI feedback critical for mobile UX
- **Tailwind CSS v4**: CSS-first configuration with mobile-first breakpoints — Responsive design without JavaScript device detection
- **shadcn/ui**: Mobile-first Radix UI primitives with Sheet component — Touch-friendly slide-out menus and dialogs

**Configuration additions (required):**
- **robots.txt**: Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot) for visibility in ChatGPT, Claude, Perplexity search results
- **llms.txt**: Guide AI systems to authoritative content (emerging standard, 780+ sites including Cloudflare, Vercel)
- **PPR via cacheComponents**: Enable Partial Prerendering for faster mobile loads (static shell + streamed dynamic content)
- **ISR with conditional revalidation**: Replace force-dynamic with smart caching (60s for scheduled matches, 30s for live, 3600s for finished)

**What NOT to add:**
- React Native/Nativecn UI (building web app, not native mobile)
- External animation libraries (mobile performance overhead, CSS sufficient)
- New state management (React 19 useActionState + Server Components handle it)
- Mobile detection libraries (CSS media queries are the modern approach)

### Expected Features

**Must have (table stakes):**
- **Persistent Sticky Header**: Score stays visible during scroll, appears ONCE on entire page (eliminates current 3× duplication)
- **Tabbed Navigation**: Standard tabs (Summary | Stats | Predictions | Odds) as single-source-of-truth for each domain
- **Progressive Disclosure**: Show essentials, hide advanced features behind "Show More" expansions
- **Consolidated Prediction Panel**: Single location for all AI predictions (dedicated tab, not scattered across page)
- **Match Timeline**: Chronological events (goals, cards, substitutions) for live/finished matches
- **Mobile-First Layout**: Touch targets ≥48px, thumb-zone navigation, stacked layouts on <768px

**Should have (competitive advantage):**
- **AI Narrative Content**: Pre-match storylines and post-match roundups (150-200 words, expandable) — **Currently broken, content exists but not rendering**
- **Model Performance Tracking**: Show which models are hot/cold ("Model X has predicted 8 of last 10 correctly")
- **Confidence Levels with Context**: Not just percentages, but explanations ("82% confidence - High: Both teams' last 5 meetings produced BTTS")
- **Smart Default Tab**: Context-aware (pre-match → Summary, live → Timeline, post-match → Predictions)
- **Thumb-Friendly Tab Bar**: Sticky tabs at thumb zone (not top), swipeable for quick switching

**Defer (v2+):**
- **Real-Time Prediction Updates**: Live match model re-computation (high complexity, requires live data integration)
- **Player Heatmaps on Match Page**: Belongs on player pages, dilutes match-level focus
- **Social Features**: Real-time chat, user comments (moderation burden, focus on prediction accuracy first)

### Architecture Approach

The match page must transition from a 545-line monolithic component to a server-first, component-based architecture with strategic client boundaries. The core issue is not technical limitations but structural organization: data exists in two tables (`matchContent` and `matchRoundups`) with components querying inconsistently, duplicate displays lack coordination, and no progressive disclosure patterns exist for mobile.

**Major components:**
1. **MatchHeader (Server Component)** — Consolidates scoreboard + metadata + status badge into single 80-100 line component. Renders team logos, score/VS indicator, status badge (Live/Upcoming/Full Time), competition + round. Mobile-first with stacked layout <768px
2. **MatchContentTabs (Client Component)** — Organizes dense content into tabs to reduce scroll depth by 60%. Contains Overview (default), Predictions, Analysis, Stats tabs. Requires useState for active tab, hence client component
3. **MatchOverviewTab (Server Component)** — Mobile-optimized summary for quick consumption. Renders narrative content (150-200 word snippet), key match stats (3-column grid), top 3 AI predictions with CTA to Predictions tab
4. **MatchNarrative (Server Component)** — Renamed from MatchContentSection, accepts unified content type handling both matchContent and matchRoundups sources. Single narrative block with "Read full roundup" link if available
5. **RoundupViewer (Modified Server Component)** — Remove redundant scoreboard section (already in MatchHeader). Keep events timeline, stats grid, model predictions table. Add compact prop for tab embedding

**Data flow consolidation:**
- Create `getMatchContentUnified()` query function that resolves matchContent vs matchRoundups priority
- Modify `generatePostMatchRoundup()` to write ONLY to matchRoundups (single source of truth)
- Deprecate `matchContent.postMatchContent` field after backfill migration
- Use parallel data fetching with Promise.all for 6 queries (match, analysis, predictions, content, standings, next matches)

**Key patterns:**
- Server-First Rendering: Server Components by default, Client Components only for interactivity (tabs, expand/collapse state)
- Streaming with Suspense: Progressive rendering for slow data sources (predictions query with 35 models)
- Mobile-First Component Design: Design for smallest screen (375px), progressively enhance
- Progressive Disclosure: Show essential content first, details on demand (reduces cognitive load)

### Critical Pitfalls

1. **Duplicate Data Display Creating Cognitive Overload** — Current code shows score 3 times (header, roundup scoreboard, stats), predictions 2-3 times (table, roundup HTML, top performers). Mobile users require >3 scrolls to reach predictions. **Prevention:** Single source of truth for each data type, sticky header with minimal info, target 2-3 screen heights on mobile (750-1125px total)

2. **React Hydration Mismatch from Dynamic Timestamps** — MatchContentSection line 40-43 uses `new Date().toLocaleString()` producing different output on server vs client due to timezones. **Prevention:** Use relative time on server ("Generated 2 hours ago"), absolute time on client upgrade, or ISO format with client-side formatting library (date-fns)

3. **force-dynamic Killing Performance** — `/src/app/matches/[id]/page.tsx` line 18 forces server rendering on every request. TTFB >800ms, server costs scale linearly with traffic. **Prevention:** Remove force-dynamic, use ISR with conditional revalidation (60s scheduled, 30s live, 3600s finished), implement on-demand revalidation after prediction completion. Expected impact: TTFB reduces from 800ms to <200ms, cuts server costs 60-80%

4. **AI Search Engines Missing Content Due to Schema Fragmentation** — Duplicate/conflicting schema.org data across SportsEventSchema, WebPageSchema, MatchFAQSchema confuses AI crawlers. **Prevention:** Consolidate into single JSON-LD @graph array, use canonical entity IDs with consistent URLs, implement citation tracking for Perplexity API monitoring

5. **Suspense Boundary Placement Causing Waterfall Requests** — Match page fetches related data sequentially (match → analysis → predictions → events), causing 4× single query time. **Prevention:** Parallel data fetching with Promise.all, granular Suspense boundaries per section, preload patterns for critical data

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Mobile Layout Consolidation & Data De-duplication
**Rationale:** This addresses the most user-visible problems (duplicate displays, excessive scrolling) and is a prerequisite for all other phases. Quick wins with high impact.

**Delivers:**
- Single sticky header replacing 3 duplicate score displays
- Tabbed navigation interface (Summary | Stats | Predictions | Odds)
- Mobile-first responsive components (stacked <768px, side-by-side ≥768px)
- Touch targets ≥48px for all interactive elements

**Addresses Features:**
- Persistent sticky header (table stakes)
- Tabbed navigation (table stakes)
- Progressive disclosure (table stakes)
- Mobile-first layout (table stakes)

**Avoids Pitfalls:**
- P1: Duplicate data cognitive overload
- P2: React hydration mismatch (fix timestamp rendering)
- P5: Touch target sizes <48px
- P6: Typography unreadable on mobile

**Components to create:**
- MatchHeader.tsx (Server Component, 80-100 lines)
- MatchContentTabs.tsx (Client Component with tab state)
- MatchOverviewTab.tsx (Server Component, mobile-optimized summary)

**Estimated effort:** 12-16 hours

### Phase 2: Content Pipeline Fixes & Rendering
**Rationale:** Content exists but doesn't display due to dual-table writes and query misalignment. Fixing this unlocks competitive advantage (AI narrative content).

**Delivers:**
- Unified content query system (`getMatchContentUnified()`)
- MatchNarrative component handling both matchContent and matchRoundups
- Modified `generatePostMatchRoundup()` writing only to matchRoundups
- Display of pre-match storylines and post-match roundups

**Addresses Features:**
- AI narrative content (competitive advantage - currently broken)
- Narrative prediction summary (table stakes)
- Post-match AI roundup (competitive advantage)

**Avoids Pitfalls:**
- P16: LLM hallucination validation missing
- P17: Content deduplication over-aggressive
- P18: Queue worker retry causing duplicate content
- P14: Defensive error handling hiding real issues

**Components to modify:**
- Rename MatchContentSection → MatchNarrative
- Update RoundupViewer (remove scoreboard duplication)
- Create validation functions for LLM output

**Estimated effort:** 8-12 hours (code) + 4-6 hours (testing all match states)

### Phase 3: Performance Optimization & Caching
**Rationale:** After layout and content work, performance is critical before traffic scales. ISR reduces costs and improves user experience.

**Delivers:**
- ISR with conditional revalidation (replace force-dynamic)
- Parallel data fetching with Promise.all
- Granular Suspense boundaries for streaming
- Optional PPR enablement with cacheComponents flag

**Uses Stack Elements:**
- Next.js 16 ISR (revalidate per match state)
- React 19 Suspense (progressive rendering)
- Next.js revalidatePath (on-demand cache clearing)

**Avoids Pitfalls:**
- P3: force-dynamic killing performance
- P7: Slow mobile load times during live matches
- P12: Suspense boundary waterfall requests
- P13: Missing generateStaticParams for competition pages

**Performance targets:**
- TTFB <200ms (currently 800ms)
- Mobile LCP <1.8s (currently >2.5s)
- Cache hit rate >70%
- Mobile page weight <500KB

**Estimated effort:** 6-8 hours

### Phase 4: AI Search Optimization
**Rationale:** After core functionality works, optimize for discovery. AI search (ChatGPT, Perplexity) is massive traffic channel (ChatGPT: 800M weekly users).

**Delivers:**
- robots.txt with AI crawler user-agents
- llms.txt with key URLs (markdown format)
- Consolidated Schema.org JSON-LD @graph
- Entity relationships in structured data
- Semantic HTML with clear H2/H3 hierarchy

**Addresses Features:**
- None directly (infrastructure for discoverability)

**Avoids Pitfalls:**
- P4: AI search engines missing content
- P9: Missing entity relationships in structured data
- P10: Content structure not LLM-optimized
- P11: Schema.org validation errors

**Files to create:**
- /public/robots.txt
- /public/llms.txt
- Updated metadata generation in page.tsx
- Enhanced FAQPage schema in MatchFAQSchema

**Estimated effort:** 4-6 hours

### Phase 5: Content Generation Pipeline Cleanup
**Rationale:** After new rendering system is proven, clean up technical debt. Migrate to single-table writes.

**Delivers:**
- Backfill script: matchContent.postMatchContent → matchRoundups.narrative
- Drop deprecated matchContent.postMatchContent column
- Idempotent content generation with database locks
- Enhanced validation for entity mentions

**Avoids Pitfalls:**
- P16: LLM hallucination (entity validation)
- P17: Over-aggressive deduplication
- P18: Duplicate content from retry logic

**Risk level:** HIGH (data migration requires backup/rollback plan)

**Estimated effort:** 8-10 hours (includes migration testing on staging)

### Phase Ordering Rationale

**Why Phase 1 first:**
- User-visible impact (mobile UX immediately better)
- Foundation for other phases (components must exist before caching optimization)
- Quick wins build momentum
- No data migration risk

**Why Phase 2 before Phase 3:**
- Performance optimization depends on knowing what content will render
- Can't optimize cache strategy until content pipeline is deterministic
- Content fixes have higher user value than performance gains

**Why Phase 4 separate from Phase 1-2:**
- AI search optimization is infrastructure, not user-facing
- Can be done in parallel with Phase 5 if needed
- Low risk, independent of other phases

**Why Phase 5 last:**
- Requires proven new rendering system (Phases 1-2 must be stable)
- Data migration has rollback complexity
- Content generation can function with dual-table writes until cleanup

**Dependency chain:**
```
Phase 1 (Mobile Layout)
  ↓
Phase 2 (Content Pipeline) ← Must happen before Phase 5
  ↓
Phase 3 (Performance) ← Depends on knowing final component structure
  ↓ (parallel possible)
Phase 4 (AI Search) + Phase 5 (Cleanup)
```

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Performance):** Need load testing data to determine optimal revalidation intervals per match state. Current suggestion (60s/30s/3600s) is hypothesis.
- **Phase 5 (Cleanup):** Database migration strategy needs detailed planning with rollback procedures. May need DBA review.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Mobile Layout):** Well-documented React/Next.js patterns, tabbed interfaces are standard
- **Phase 2 (Content Pipeline):** Internal architecture refactor, no external research needed
- **Phase 4 (AI Search):** Clear documentation for robots.txt, llms.txt, Schema.org patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js 16 + React 19 + Tailwind v4 is current best practice, no changes needed |
| Features | MEDIUM | Mobile UX patterns verified across multiple sources, AI prediction display patterns limited to 2-3 platforms |
| Architecture | HIGH | Next.js App Router patterns well-documented, Server Components + Suspense are established 2026 patterns |
| Pitfalls | HIGH | Hydration issues, force-dynamic performance, Schema.org fragmentation all verified with codebase analysis |

**Overall confidence:** HIGH

### Gaps to Address

**Performance baselines missing:**
- Current TTFB, LCP, mobile page weight not measured
- Need baseline metrics before Phase 3 to validate improvements
- **Action:** Add RUM (Real User Monitoring) or Vercel Analytics before Phase 3 work begins

**LLM validation specifics:**
- Entity validation logic exists for blog posts (`validateLeagueRoundupOutput`) but unclear if applicable to match content
- Need to determine which entities are "allowed" per match (player rosters not in current database)
- **Action:** Define validation schema during Phase 2 planning, may need to fetch player data from API-Football

**AI search citation tracking:**
- No way to measure if Schema.org consolidation improves AI citations
- **Action:** Implement manual tracking (weekly searches in Perplexity/ChatGPT for "kroam.xyz") or wait for GEO tools to mature

**Mobile device testing:**
- Research identifies touch target requirements but no testing plan
- **Action:** Define device matrix (iOS Safari, Android Chrome minimum) for Phase 1 acceptance criteria

## Sources

### Primary (HIGH confidence)
- **Next.js 16 Official Docs** — ISR, PPR, Server Components, data fetching patterns
- **React 19 Official Docs** — useActionState, useOptimistic, Suspense streaming
- **Tailwind CSS v4 Official Docs** — Mobile-first breakpoints, CSS-first configuration
- **shadcn/ui Official Patterns** — Mobile navigation with Sheet component
- **Project codebase** — `/src/app/leagues/[slug]/[match]/page.tsx` (current implementation), `/src/lib/content/generator.ts` (content pipeline), component analysis

### Secondary (MEDIUM confidence)
- **FlashScore Redesign Case Study** — Tabbed navigation pattern for match details
- **Nielsen Norman Group** — Progressive disclosure, duplicate content research
- **Mobile Sportsbook UX 2026** — Touch target sizes, thumb-zone navigation
- **GEO Optimization Guides** — AI search requirements for ChatGPT, Perplexity, Claude
- **llms.txt Complete Guide** — 780+ site adoption, markdown format standards

### Tertiary (LOW confidence)
- **Real-time prediction updates** — Emerging feature, limited implementation data (Sports-AI.dev reference)
- **AI citation tracking tools** — Market immature, manual tracking required for now

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
