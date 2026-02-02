# Roadmap: AI Football Predictions Platform

## Milestones

- [x] **v1.0 Bug Fix Stabilization** - Phases 1-4 (shipped 2026-02-01)
- [x] **v1.1 Stats Accuracy & SEO** - Phases 5-8 (shipped 2026-02-02)
- [x] **v1.2 Technical SEO Fixes** - Phases 9-12 (shipped 2026-02-02)
- [ ] **v1.3 Match Page Refresh** - Phases 13-16 (in progress)

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

<details open>
<summary>v1.3 Match Page Refresh (Phases 13-16) - IN PROGRESS</summary>

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

**Success Criteria:**
1. AI crawler user-agents (GPTBot, ClaudeBot, PerplexityBot, Amazonbot) can access all match pages (verified via robots.txt)
2. llms.txt file provides structured sitemap with match, competition, model, and blog URLs
3. Match pages serve single consolidated Schema.org JSON-LD graph (SportsEvent + WebPage + BreadcrumbList in @graph array)
4. Schema.org validator shows zero errors for match page structured data
5. AI-generated content (pre-match, post-match narratives) renders server-side (visible in View Source, not client-only)

**Why This Phase:**
AI search optimization is infrastructure work that depends on content being visible (Phase 13) but is independent of layout/performance. Can execute in parallel with cleanup work or after performance optimization since it doesn't affect core UX.

</details>

## Progress

**Execution Order:**
v1.0, v1.1, and v1.2 complete. v1.3 in progress starting Phase 13.

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
| **13. Content Pipeline Fixes** | **v1.3** | **3/3** | **Complete** | 2026-02-02 |
| **14. Mobile Layout Consolidation** | **v1.3** | **4/4** | **Complete** | 2026-02-02 |
| **15. Performance Optimization** | **v1.3** | **3/3** | **Complete** | 2026-02-02 |
| **16. AI Search Optimization** | **v1.3** | **0/0** | **Ready** | — |

---
*Last updated: 2026-02-02 (Phase 15 complete)*
