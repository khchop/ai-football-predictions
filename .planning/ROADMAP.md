# Roadmap: AI Football Predictions Platform

## Milestones

- [x] **v1.0 Bug Fix Stabilization** - Phases 1-4 (shipped 2026-02-01)
- [x] **v1.1 Stats Accuracy & SEO** - Phases 5-8 (shipped 2026-02-02)
- [x] **v1.2 Technical SEO Fixes** - Phases 9-12 (shipped 2026-02-02)
- [x] **v1.3 Match Page Refresh** - Phases 13-16 (shipped 2026-02-02)
- [ ] **v2.0 UI/UX Overhaul** - Phases 17-23 (current)

## Phases

<details>
<summary>v1.0 Bug Fix Stabilization (Phases 1-4) - SHIPPED 2026-02-01</summary>

### Phase 1: Database Resilience
**Goal**: Prevent database-related crashes
**Plans**: 3 plans

Plans:
- [x] 01-01: Connection pool sizing and health monitoring
- [x] 01-02: Transaction safety for settlements
- [x] 01-03: Database error recovery strategies

### Phase 2: Queue Worker Stability
**Goal**: Reliable job processing for predictions
**Plans**: 4 plans

Plans:
- [x] 02-01: Multi-strategy JSON extraction
- [x] 02-02: Error-type-aware model recovery
- [x] 02-03: API timeout handling
- [x] 02-04: Budget enforcement

### Phase 3: Scoring & Caching Fixes
**Goal**: Accurate scoring and cache management
**Plans**: 4 plans

Plans:
- [x] 03-01: Kicktipp quota calculation fix
- [x] 03-02: Leaderboard totals correction
- [x] 03-03: Streak tracking improvements
- [x] 03-04: Cache invalidation timing
- [x] 03-05: Cache pattern deletion optimization
- [x] 03-06: Redis unavailability handling

### Phase 4: Frontend Performance
**Goal**: Fast, responsive UI without errors
**Plans**: 3 plans

Plans:
- [x] 04-01: Streaming SSR for match pages
- [x] 04-02: Mobile responsiveness
- [x] 04-03: Error boundaries
- [x] 04-04: Auto-refresh leaderboards

</details>

<details>
<summary>v1.1 Stats Accuracy & SEO (Phases 5-8) - SHIPPED 2026-02-02</summary>

### Phase 5: Stats Foundation
**Goal**: Single source of truth for accuracy calculations
**Plans**: 3 plans

Plans:
- [x] 05-01: Create stats service layer with canonical accuracy formula
- [x] 05-02: Fix queries.ts functions with incorrect formulas
- [x] 05-03: Fix model detail page metadata accuracy bug

### Phase 6: Data Migration
**Goal**: Historical stats recalculated with audit trail
**Plans**: 2 plans

Plans:
- [x] 06-01: Execute migration with snapshot and verification report
- [x] 06-02: Create methodology page and changelog entry

### Phase 7: SEO Enhancement
**Goal**: Structured data and optimized metadata for Google Rich Results
**Plans**: 3 plans

Plans:
- [x] 07-01: Enhance match page structured data and metadata
- [x] 07-02: Add structured data to blog and competition pages
- [x] 07-03: Sitemap updates and validation sweep

### Phase 8: UX Transparency
**Goal**: Users understand and trust accuracy metrics
**Plans**: 2 plans

Plans:
- [x] 08-01: Create tooltip infrastructure and AccuracyDisplay component
- [x] 08-02: Integrate AccuracyDisplay across leaderboard and model pages

</details>

<details>
<summary>v1.2 Technical SEO Fixes (Phases 9-12) - SHIPPED 2026-02-02</summary>

### Phase 9: Critical SEO Errors
**Goal**: Eliminate 500 errors, 404s in sitemap, and broken redirects
**Requirements**: SEO-T01, SEO-T02, SEO-T03, SEO-T04
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — Add slug alias system to competition config with canonical redirects
- [x] 09-02-PLAN.md — Fix sitemap generation and internal links to use canonical URLs
- [x] 09-03-PLAN.md — Fix redirect chains and investigate 500 error

### Phase 10: Page Structure
**Goal**: All pages have proper H1 tags and titles under character limits
**Requirements**: SEO-T05, SEO-T06, SEO-T07
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Add MatchH1 component with sr-only accessibility for match pages
- [x] 10-02-PLAN.md — Create abbreviation utilities and optimize title templates

### Phase 11: Redirect Optimization
**Goal**: Fix 307 temporary redirects to 308 permanent, verify noindex configuration, document orphan page strategy
**Requirements**: SEO-T08, SEO-T09, SEO-T10
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Replace redirect with permanentRedirect in legacy match page
- [x] 11-02-PLAN.md — Verify noindex configuration and document orphan page strategy

### Phase 12: Internal Linking
**Goal**: Strong internal link structure for crawl depth optimization
**Requirements**: SEO-T11, SEO-T12, SEO-T13
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — Add RelatedMatchesWidget and RelatedModelsWidget to match and model pages
- [x] 12-02-PLAN.md — Add RecentPredictionsWidget to competition hub pages

</details>

<details>
<summary>v1.3 Match Page Refresh (Phases 13-16) - SHIPPED 2026-02-02</summary>

### Phase 13: Content Pipeline Fixes
**Goal**: LLM-generated content displays correctly on all match pages
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Dependencies**: None
**Plans**: 3 plans

Plans:
- [x] 13-01-PLAN.md — Create unified content query (getMatchContentUnified) with COALESCE
- [x] 13-02-PLAN.md — Create ReadMoreText client component with accessibility
- [x] 13-03-PLAN.md — Update MatchContentSection with state logic and ReadMoreText integration

**Success Criteria:**
1. User sees pre-match AI narrative on upcoming match pages (150-200 word preview with "Read More")
2. User sees prediction summary content on match pages with active predictions
3. User sees post-match AI roundup on finished match pages (complete with stats, events, model analysis)
4. User can click "Read More" on long content blocks to expand full narrative (no truncation on expansion)
5. System queries unified content source (no missing content due to table misalignment)

**Why This Phase:**
Content exists in database but doesn't display due to dual-table writes (`matchContent` vs `matchRoundups`) and query misalignment. Fixing this unblocks all user-facing content features and must complete before mobile layout work (can't optimize layout for content that doesn't render).

---

### Phase 14: Mobile Layout Consolidation
**Goal**: Match pages display data exactly once with minimal scrolling on mobile
**Requirements**: MOBL-01, MOBL-02, MOBL-03, MOBL-04, MOBL-05, MOBL-06
**Dependencies**: Phase 13 (content must render before layout optimization)
**Plans**: 4 plans

Plans:
- [x] 14-01-PLAN.md — Install react-swipeable, create sticky header and collapsible section components
- [x] 14-02-PLAN.md — Create tabbed navigation with swipe gestures and tab content wrappers
- [x] 14-03-PLAN.md — Wire tabbed layout into match page, hide duplicate scores on mobile
- [x] 14-04-PLAN.md — Touch target audit and human verification checkpoint

**Success Criteria:**
1. User sees match score exactly once in sticky header (not duplicated in stats, roundup, or other sections)
2. User navigates between Summary/Stats/Predictions/Analysis tabs without page reload
3. User swipes left/right to switch tabs on mobile touchscreen
4. User taps "Show More" to expand advanced stats (hidden by default on mobile)
5. All interactive elements (tabs, buttons, toggles) meet 44x44px minimum touch target size

**Why This Phase:**
After content renders correctly (Phase 13), consolidating duplicate displays and adding tabbed navigation provides immediate UX improvement. Mobile-first layout is foundation for performance optimization (Phase 15) since caching strategy depends on final component structure.

---

### Phase 15: Performance Optimization
**Goal**: Match pages load under 400ms TTFB with smart caching
**Requirements**: PERF-01, PERF-02, PERF-03
**Dependencies**: Phase 14 (caching strategy depends on finalized component structure)
**Plans**: 3 plans

Plans:
- [x] 15-01-PLAN.md — Remove force-dynamic and enable ISR with 60s revalidation
- [x] 15-02-PLAN.md — Parallelize data fetching with Promise.all (two-stage pattern)
- [x] 15-03-PLAN.md — Add cache stats monitoring endpoint

**Success Criteria:**
1. User sees match page initial render in under 400ms TTFB on mobile network (measured via Chrome DevTools)
2. User viewing live match sees score updates within 60 seconds without manual refresh (ISR revalidation active)
3. User viewing finished match experiences instant page load from cache (3600s revalidation, served from edge)
4. Developer confirms parallel data fetching reduces query waterfall from 4x to 1x baseline time
5. Cache hit rate exceeds 70% for match pages (measured via Redis INFO stats)

**Why This Phase:**
ISR configuration requires knowing exact rendering pipeline (what's static vs dynamic) from Phases 13-14. Optimizing before layout stabilizes risks rework. Performance improvements have massive cost savings (60-80% server load reduction) and SEO benefit (Core Web Vitals).

---

### Phase 16: AI Search Optimization
**Goal**: Match pages optimized for AI search engines (ChatGPT, Perplexity, Claude)
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Dependencies**: Phase 13 (content must be visible for crawlers to index)
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md — Add missing AI crawler user-agents to robots.txt and verify llms.txt structure
- [x] 16-02-PLAN.md — Create consolidated MatchPageSchema component with @graph array
- [x] 16-03-PLAN.md — Integrate consolidated schema into match page and verify SSR content

**Success Criteria:**
1. AI crawler user-agents (GPTBot, ClaudeBot, PerplexityBot, Amazonbot) can access all match pages (verified via robots.txt)
2. llms.txt file provides structured sitemap with match, competition, model, and blog URLs
3. Match pages serve single consolidated Schema.org JSON-LD graph (SportsEvent + WebPage + BreadcrumbList in @graph array)
4. Schema.org validator shows zero errors for match page structured data
5. AI-generated content (pre-match, post-match narratives) renders server-side (visible in View Source, not client-only)

**Why This Phase:**
AI search optimization is infrastructure work that depends on content being visible (Phase 13) but is independent of layout/performance. Can execute in parallel with cleanup work or after performance optimization since it doesn't affect core UX.

</details>

<details open>
<summary>v2.0 UI/UX Overhaul (Phases 17-23) - CURRENT</summary>

### Phase 17: Design System Foundation
**Goal**: Establish design tokens, component patterns, and infrastructure for all subsequent visual work
**Requirements**: DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06
**Dependencies**: None
**Plans**: 4 plans

Plans:
- [x] 17-01-PLAN.md — Semantic OKLCH color tokens and dark mode with next-themes
- [x] 17-02-PLAN.md — Typography scale (1.2 ratio) and spacing system (4px/8px rhythm)
- [x] 17-03-PLAN.md — MatchBadge and AccuracyBadge component variants
- [x] 17-04-PLAN.md — View Transitions API with accessibility handling

**Success Criteria:**
1. User sees consistent win/loss/draw colors across all match states (semantic tokens applied)
2. User experiences readable typography at all breakpoints from mobile to desktop (responsive scale active)
3. User toggles dark mode and all UI elements reflect the change immediately
4. User navigates between pages with smooth visual transitions (View Transitions API enabled)
5. Developer can compose new match state variants using documented token patterns

**Why This Phase:**
Foundation patterns prevent technical debt accumulation in later phases. Design tokens must exist before page rebuilds can use them. PPR configuration and View Transitions are infrastructure that all pages depend on.

---

### Phase 18: Match Page Rebuild
**Goal**: Match pages display content clearly without duplication, optimized for speed and AI citations
**Requirements**: MTCH-01, MTCH-02, MTCH-03, MTCH-04, MTCH-05, MTCH-06
**Dependencies**: Phase 17 (design tokens and PPR infrastructure)
**Plans**: 5 plans

Plans:
- [x] 18-01-PLAN.md — Score deduplication with Intersection Observer for sticky header trigger
- [x] 18-02-PLAN.md — TL;DR component and preview with scroll-to-section pattern
- [x] 18-03-PLAN.md — PPR infrastructure with shimmer skeletons (activation deferred to Phase 23)
- [x] 18-04-PLAN.md — FAQ component with JSON-LD schema for GEO
- [x] 18-05-PLAN.md — Final integration and human verification

**Success Criteria:**
1. User sees match score exactly once on the page (no duplication in header, stats, or other sections)
2. User reads pre-match AI narrative on upcoming match pages (content visible, not hidden)
3. User reads prediction explanations on pages with active predictions (content visible above fold)
4. User reads post-match roundup on finished match pages (complete narrative visible)
5. User experiences fast initial load with static shell while dynamic content streams in (PPR active)
6. AI search engines cite match page content in responses (answer-first GEO structure)

**Why This Phase:**
Highest traffic pages. Research indicates 387 lines of complex JSX with data appearing 3+ times per page. Fixing duplication and enabling PPR provides immediate UX and performance improvement. Depends on Phase 17 tokens for consistent styling.

---

### Phase 19: Blog Page Rebuild
**Goal**: Blog posts readable and optimized for GEO with proper typography and navigation
**Requirements**: BLOG-01, BLOG-02, BLOG-03, BLOG-04, BLOG-05
**Dependencies**: Phase 17 (typography scale)
**Plans**: 5 plans

Plans:
- [ ] 19-01-PLAN.md — Typography and content styling with heading extraction utility
- [ ] 19-02-PLAN.md — FAQ extraction and accordion component with FAQPage schema
- [ ] 19-03-PLAN.md — Related articles utility and card grid widget
- [ ] 19-04-PLAN.md — Table of contents with Intersection Observer scroll spy
- [ ] 19-05-PLAN.md — Blog page integration and human verification

**Success Criteria:**
1. User reads blog content at comfortable line width (600-700px max, not full screen)
2. User distinguishes heading hierarchy visually (H1, H2, H3 have clear size/weight differences)
3. User jumps to specific sections via table of contents on long articles (500+ words)
4. User finds FAQ section at bottom of relevant posts (FAQPage schema present)
5. User discovers related articles via contextual widget at post end

**Why This Phase:**
Second major page type. Blog readability is table stakes - currently full-width which makes long-form content hard to read. FAQ sections with schema are competitive advantage for AI citations (3.2x improvement in AI Overview appearances per research).

---

### Phase 20: League Page Rebuild
**Goal**: League pages SEO-optimized with rich structured data and stats dashboard
**Requirements**: LEAG-01, LEAG-02, LEAG-03, LEAG-04, LEAG-05
**Dependencies**: Phase 17 (design tokens for data visualization)
**Plans**: TBD

**Success Criteria:**
1. User finds league pages via search engines with rich snippets (SEO metadata optimized)
2. AI search engines understand league structure (SportsOrganization/SportsLeague schema present)
3. User finds FAQ section answering common league questions (FAQPage schema present)
4. User views competition stats at a glance (total matches, predictions, accuracy displayed)
5. User explores historical performance trends via visualization (charts showing model accuracy over time)

**Why This Phase:**
League pages are entry points for organic traffic. SEO optimization and schema markup enable rich search results. Stats dashboard differentiates from competitors and provides unique value for returning users.

---

### Phase 21: Leaderboard Page Rebuild
**Goal**: Leaderboard pages SEO-optimized with time filtering and trend indicators
**Requirements**: LEAD-01, LEAD-02, LEAD-03
**Dependencies**: Phase 17 (design tokens for trend indicators)
**Plans**: TBD

**Success Criteria:**
1. User finds leaderboard pages via search with FAQ rich snippets (SEO and schema optimized)
2. User filters leaderboard by time period (weekly, monthly, all-time views available)
3. User identifies rising/falling models via visual trend indicators (up/down arrows or colors)

**Why This Phase:**
Leaderboard is core differentiator - shows which AI models perform best. Time-based filtering increases engagement (weekly fresh start). Trend indicators add value beyond raw rankings. Smaller scope (3 requirements) makes this a natural boundary.

---

### Phase 22: Navigation & Internal Linking
**Goal**: Seamless navigation across all pages with systematic internal linking
**Requirements**: NAVL-01, NAVL-02, NAVL-03, NAVL-04, NAVL-05
**Dependencies**: Phases 18-21 (navigation must link to rebuilt pages)
**Plans**: TBD

**Success Criteria:**
1. Mobile user navigates via thumb-friendly bottom navigation bar (4-5 primary destinations)
2. User orients via breadcrumbs on all pages (shows current position in site hierarchy)
3. User discovers related content via widgets (related matches, models, articles shown contextually)
4. User follows inline links to teams, competitions, and models within content (auto-linked entities)
5. User experiences instant navigation via prefetch on hover/touch (no loading delay)

**Why This Phase:**
Cross-cutting concern affecting all pages. Depends on page rebuilds completing first so navigation can link to final component structure. Bottom nav bar validated by research as 21% faster for mobile navigation.

---

### Phase 23: Performance & Polish
**Goal**: Validate PPR benefits, optimize bundle size, ensure smooth transitions
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Dependencies**: Phases 17-22 (all components must exist for performance audit)
**Plans**: TBD

**Success Criteria:**
1. User experiences static shell rendering instantly with dynamic content streaming (PPR validated)
2. Developer confirms cache configuration works without dynamic/revalidate conflicts
3. Developer confirms unnecessary 'use client' directives removed (client component audit complete)
4. User experiences smooth animated transitions between pages (View Transitions polished)

**Why This Phase:**
Final optimization phase requires all components to exist. Client boundary audit can only happen after all pages rebuilt. View Transitions polish depends on final navigation structure. Performance validation confirms PPR investment pays off.

</details>

## Progress

**Execution Order:**
v1.0, v1.1, v1.2, and v1.3 complete. v2.0 in progress.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Resilience | v1.0 | 3/3 | Complete | 2026-02-01 |
| 2. Queue Worker Stability | v1.0 | 4/4 | Complete | 2026-02-01 |
| 3. Scoring & Caching Fixes | v1.0 | 6/6 | Complete | 2026-02-01 |
| 4. Frontend Performance | v1.0 | 4/4 | Complete | 2026-02-01 |
| 5. Stats Foundation | v1.1 | 3/3 | Complete | 2026-02-02 |
| 6. Data Migration | v1.1 | 2/2 | Complete | 2026-02-02 |
| 7. SEO Enhancement | v1.1 | 3/3 | Complete | 2026-02-02 |
| 8. UX Transparency | v1.1 | 2/2 | Complete | 2026-02-02 |
| 9. Critical SEO Errors | v1.2 | 3/3 | Complete | 2026-02-02 |
| 10. Page Structure | v1.2 | 2/2 | Complete | 2026-02-02 |
| 11. Redirect Optimization | v1.2 | 2/2 | Complete | 2026-02-02 |
| 12. Internal Linking | v1.2 | 2/2 | Complete | 2026-02-02 |
| 13. Content Pipeline Fixes | v1.3 | 3/3 | Complete | 2026-02-02 |
| 14. Mobile Layout Consolidation | v1.3 | 4/4 | Complete | 2026-02-02 |
| 15. Performance Optimization | v1.3 | 3/3 | Complete | 2026-02-02 |
| 16. AI Search Optimization | v1.3 | 3/3 | Complete | 2026-02-02 |
| **17. Design System Foundation** | **v2.0** | **4/4** | **Complete** | 2026-02-02 |
| **18. Match Page Rebuild** | **v2.0** | **5/5** | **Complete** | 2026-02-03 |
| **19. Blog Page Rebuild** | **v2.0** | **5/5** | **Complete** | 2026-02-03 |
| **20. League Page Rebuild** | **v2.0** | **0/?** | **Pending** | — |
| **21. Leaderboard Page Rebuild** | **v2.0** | **0/?** | **Pending** | — |
| **22. Navigation & Internal Linking** | **v2.0** | **0/?** | **Pending** | — |
| **23. Performance & Polish** | **v2.0** | **0/?** | **Pending** | — |

---
*Last updated: 2026-02-03 (Phase 19 complete - 5 plans executed)*
