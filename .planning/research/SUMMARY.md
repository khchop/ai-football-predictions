# Project Research Summary

**Project:** AI Football Predictions Platform - v2.2 Match Page Rewrite + Content Pipeline Fix
**Domain:** SEO/GEO-optimized sports content generation with BullMQ job queues and LLM integration
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

The v2.2 milestone addresses two interconnected problems: (1) match pages need SEO/GEO optimization for AI search visibility, and (2) the content generation pipeline is silently failing, leaving matches without content. Research reveals these share a common thread: the platform has solid architecture and technology choices, but configuration gaps and silent failure patterns are undermining reliability and discoverability.

**The recommended approach has two parallel tracks:**

1. **Content Pipeline Fix (Urgent):** The root cause of missing content is identified - content generation functions return `false` on failure instead of throwing errors, so BullMQ never retries failed jobs. Additionally, the lock duration (30s default) is too short for content generation (60s+), causing premature stall detection. The fix is straightforward: convert `return false` to `throw error` in `match-content.ts`, add content validation before database save, and configure explicit lock duration (120s) for the content queue.

2. **Match Page SEO/GEO Rewrite:** The existing Next.js 16.1.4 stack with schema-dts is already optimal - no new packages needed. Focus is on (a) restructuring match pages with a single source of truth via React Context to eliminate duplicate score displays and prop drilling, (b) adding FAQPage schema to the existing @graph structure, and (c) structuring content for AI citation with answer-first patterns. Sites with FAQ schema are 3.2x more likely to appear in AI Overviews.

**Key risks and mitigations:**
- **Silent content failures:** Convert to explicit throws; add content completeness monitoring
- **HTML tags in older content:** Add "plain text only" to prompts; strip HTML before database save
- **Rate limit cascades:** Implement circuit breaker pattern; configure queue-level pause on repeated 429s
- **GEO visibility:** Structure content as 40-60 word extractable answer blocks; FAQ schema is critical

## Key Findings

### Recommended Stack

The existing stack is well-suited for both SEO/GEO optimization and content generation. **No new packages are required.**

**Core technologies (KEEP AS-IS):**
- **Next.js 16.1.4:** SSR/SSG with PPR, native metadata API - optimal for SEO
- **React 19.2.3:** Server Components for data fetching, Context for state distribution
- **schema-dts 1.1.5:** TypeScript types for Schema.org - already supports all needed types
- **BullMQ 5.34.3:** Job queue with retry logic - configuration needs tuning, not replacement
- **Together AI (Llama 4 Maverick):** Cost-effective LLM inference - working well
- **isomorphic-dompurify 2.35.0:** HTML sanitization - correctly implemented

**What NOT to add:**
- next-seo (conflicts with Next.js 16 metadata API)
- Alternative LLM providers (adds complexity without solving the actual issues)
- Client-side structured data injection (SEO penalty risk)
- AMP pages (no longer provides ranking advantages in 2026)
- Prompt template libraries (current prompts.ts is simpler and more maintainable)

### Expected Features

**Must have (table stakes):**
- Answer-first content structure (30-60 word direct answers) - AI engines extract answer blocks
- Complete SportsEvent schema with FAQPage in @graph - 3.2x more AI Overview appearances
- Single score display point - eliminate duplicate rendering
- Publication/update timestamps (datePublished/dateModified) - freshness signals
- Linear vertical scroll layout - 64% of sports fans on mobile
- Reliable content generation - content must exist for SEO value

**Should have (competitive):**
- Match-state-specific FAQs (upcoming/live/finished) - 5 questions per state
- Prediction accuracy FAQ for finished matches - unique citable content ("23/35 models predicted correctly")
- Topic cluster architecture (pillar + cluster pages) - 30% more traffic, 3.2x more AI citations
- Expert commentary layer - E-E-A-T differentiation
- Content completeness monitoring - alert on gaps

**Defer (v2+):**
- Video/multimedia content (high complexity)
- Multi-platform citation optimization (needs traffic baseline first)
- Real-time content updates for lineup changes (nice-to-have)
- Team entity linking (requires team pages)

### Architecture Approach

**Match Page Architecture:** Introduce a **context-based single source of truth**. The current page has 15+ components with prop drilling and duplicate state derivation. The new architecture uses `MatchDataProvider` to normalize data once in the server component, then provides it via React Context to state-aware layout variants (`UpcomingMatchLayout`, `LiveMatchLayout`, `FinishedMatchLayout`).

**Content Pipeline Architecture:** The existing architecture is sound - BullMQ with proper retry configuration, Together AI with fetchWithRetry, idempotent database operations. The issue is in error handling patterns, not the architecture itself.

**Major components (Match Page):**
1. **MatchPage** (server component) - Data fetching, SEO metadata generation
2. **MatchDataProvider** (client component) - Context boundary with normalized data
3. **MatchLayout** - State router selecting appropriate layout variant
4. **MatchHero** - SINGLE point of score/VS display (eliminates duplication)
5. **MatchContent** - State-aware narrative sections
6. **PredictionsTable** - All 35 model predictions with sorting
7. **MatchFAQ** - Auto-generated Q&A with FAQPage schema

**Content Pipeline components (existing, needs configuration fixes):**
1. **Content Worker** - Processes scan and generation jobs
2. **Together AI Client** - LLM integration with retry logic (working correctly)
3. **Match Content Functions** - Generate pre-match, betting, post-match content (need error handling fix)

### Critical Pitfalls

1. **Silent Failure Pattern (CRITICAL)** - Content generation returns `false` instead of throwing, so BullMQ never retries. Fix: Convert `return false` to `throw error` in `generatePreMatchContent`, `generateBettingContent`, `generatePostMatchContent` in `src/lib/content/match-content.ts`.

2. **Lock Duration Too Short (CRITICAL)** - Default 30s lock vs 60s+ content generation causes stalled job detection and duplicate processing. Fix: Add `[QUEUE_NAMES.CONTENT]: 120000` to WORKER_LOCK_DURATIONS in `src/lib/queue/index.ts`.

3. **HTML Tags in LLM Output (MODERATE)** - LLM outputs `<p>` tags in prose fields despite instructions. Fix: Add explicit "plain text only, no HTML" to prompts AND strip HTML before database save.

4. **Rate Limit Cascade (MODERATE)** - 429 errors trigger exponential backoff; retry delay (30s max) can stack to exceed job timeout. Fix: Implement circuit breaker pattern - pause queue for 60s after 5 consecutive rate limit errors.

5. **Duplicate Score Rendering (MODERATE)** - Score appears in MatchH1, MatchHeader, and MatchTLDR. Fix: Single `MatchHero` component with sr-only H1 for accessibility.

6. **Scan Query Timing Windows (MODERATE)** - `scan_match_content` uses 24h window that can miss matches near boundaries or status transitions. Fix: Extend window or add catch-up query that ignores time filter.

## Implications for Roadmap

Based on research, suggested phase structure (2 parallel tracks, Track A first):

### Track A: Content Pipeline Fix (3-4 days)

#### Phase A1: Investigate and Diagnose
**Rationale:** Must confirm root cause before making changes
**Delivers:** Confirmed failure point, affected record count, worker status verification
**Tasks:**
- Run investigation queries from content-pipeline/ARCHITECTURE.md
- Check worker status: `pm2 status`, queue counts, DLQ entries
- Count matches with missing content in last 7 days
- Verify repeatable jobs are registered
**Avoids:** Making changes based on assumptions

#### Phase A2: Make Failures Visible
**Rationale:** Core fix - silent failures are the root cause of missing content
**Delivers:** Content generation that properly retries on failure
**Implements:**
- Convert `return false` to `throw error` in match-content.ts (3 functions)
- Add content validation (min length 100 chars, no placeholder text) before save
- Configure lock duration (120s) for content queue
- Ensure jobs reach DLQ on exhaustion for visibility
**Avoids:** Silent failure pattern, stalled jobs

#### Phase A3: Fix HTML in Content
**Rationale:** Addresses visible HTML tags symptom
**Delivers:** Clean prose content without HTML artifacts
**Implements:**
- Add "IMPORTANT: Output plain text only. Do NOT use HTML tags, markdown, or any formatting." to prompts
- Add `stripHtmlTags()` before database save (not just at render)
- Run one-time migration to clean existing content with HTML
**Avoids:** HTML sanitization at wrong layer (render vs save)

#### Phase A4: Harden Pipeline
**Rationale:** Prevent future issues and improve observability
**Delivers:** Reliable, observable content generation
**Implements:**
- Circuit breaker for rate limits (pause queue after 5 consecutive 429s)
- Content completeness monitoring (alert if finished matches have no content)
- Worker heartbeat checks
- Lower temperature to 0.5 for factual content (pre-match, betting, post-match)
**Avoids:** Rate limit cascade, undetected failures

### Track B: Match Page Rewrite (8-10 days)

#### Phase B1: Context Foundation
**Rationale:** Establishes data flow pattern before changing any UI
**Delivers:** `MatchContextValue` type, `MatchDataProvider` component, `useMatch()` hook, `MatchLayout` router
**Addresses:** Prop drilling elimination, state derivation centralization
**Avoids:** Pitfall: implicit state dependencies

#### Phase B2: Hero Component
**Rationale:** Single score render point is the most critical deduplication
**Delivers:** `MatchHero`, `TeamDisplay`, `ScoreDisplay` components with state-aware rendering
**Addresses:** Single authoritative score display (table stake)
**Avoids:** Pitfall: duplicate score rendering

#### Phase B3: Content Sections
**Rationale:** Narrative content is the GEO value; once hero is stable, content sections can be built
**Delivers:** Refactored `MatchTLDR`, `MatchContent` with pre/post variants, state-aware narrative display
**Addresses:** Answer-first content, pre-match/post-match narratives
**Avoids:** Pitfall: dual-render pattern

#### Phase B4: Predictions & Data
**Rationale:** Predictions table is core value prop but depends on correct state handling
**Delivers:** Refactored `PredictionsTable` using context, `MatchStats` component, `MatchEvents` timeline
**Addresses:** 35 model predictions display, consensus summary, finished match stats
**Uses:** Context for data access (no prop drilling)

#### Phase B5: Layout Assembly
**Rationale:** Wire together all components into state-aware layouts
**Delivers:** `UpcomingMatchLayout`, `LiveMatchLayout`, `FinishedMatchLayout`
**Implements:**
- Complete layout variants with correct section ordering
- Update page.tsx to use new architecture
- Single vertical scroll (NO tabs)
**Addresses:** State-aware layouts, mobile single-scroll

#### Phase B6: SEO/GEO Enhancement
**Rationale:** Optimize for AI search visibility after structure is stable
**Delivers:** Full GEO optimization
**Implements:**
- FAQPage schema integrated into @graph array
- Match-state-specific FAQ expansion (5 questions per state)
- JSON-LD consolidation
- dateModified schema handling
**Addresses:** 3.2x AI Overview visibility, content freshness signals

#### Phase B7: Cleanup
**Rationale:** Remove deprecated code only after new code is proven
**Delivers:** Clean component tree, no regressions
**Implements:**
- Delete deprecated components (match-header.tsx, match-page-header.tsx, tab components)
- Performance audit (PPR validation)
- Visual regression testing
**Avoids:** Pitfall: big-bang rewrite with regressions

### Phase Ordering Rationale

- **Track A first (A1-A2):** Content pipeline must be reliable before optimizing how content displays; empty pages have no SEO value
- **Track A is smaller:** Phases A1-A4 can be completed in 3-4 days with immediate impact
- **Track B starts after A2:** Begin UI rewrite once content is flowing reliably
- **Phases B1-B2 are critical path:** Foundation and Hero enable incremental progress on all other components
- **Phase B6 depends on B5:** SEO enhancements need layouts complete to validate
- **Parallel execution possible:** A3/A4 can run alongside B1-B3 once A2 is complete

### Research Flags

Phases needing deeper research during planning:
- **Phase A4 (Harden Pipeline):** Circuit breaker threshold tuning needs production error rate data
- **Phase B6 (SEO/GEO):** FAQ question selection strategy could benefit from user query analysis

Phases with standard patterns (skip research-phase):
- **Phase A2:** Direct code changes identified in research; no external research needed
- **Phase B1-B2:** Well-documented React Context patterns
- **Phase B3-B5:** Standard component refactoring

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Codebase analysis + official Next.js/BullMQ docs; no changes needed |
| Features | HIGH | Multiple 2026 GEO sources agree on patterns; FAQ schema impact verified |
| Architecture | HIGH | Based on existing codebase + React best practices |
| Pitfalls (Pipeline) | HIGH | Root causes identified through direct code analysis |
| Pitfalls (UI) | HIGH | Based on project history (quick-008, phase-24, phase-25) |

**Overall confidence:** HIGH

### Gaps to Address

- **Content backfill scope:** Need to quantify how many matches have missing content to estimate backfill duration (Phase A1 task)
- **Circuit breaker thresholds:** Need production error rates to tune 429 detection (Phase A4)
- **FAQ question effectiveness:** Which questions actually drive AI citations needs post-launch analysis
- **Temperature tuning:** Research suggests 0.5 for factual content, but needs A/B testing
- **MatchHero boundary:** Should breadcrumbs/back link be inside MatchHero or separate? (Phase B2 planning)
- **Live match updates:** Validate that context pattern doesn't break existing polling mechanism

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/queue/`, `src/lib/content/match-content.ts`, `src/app/leagues/[slug]/[match]/page.tsx`
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) - Production patterns
- [BullMQ Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) - Retry configuration
- [Together AI Rate Limits](https://docs.together.ai/docs/rate-limits) - API behavior, header handling
- [Schema.org SportsEvent](https://schema.org/SportsEvent) - Official specification
- [Next.js generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - Metadata API
- Project history: `.planning/quick/008-fix-duplicate-match-content/`, `.planning/phases/24-match-page-cleanup/`

### Secondary (MEDIUM confidence)
- [GEO Best Practices 2026](https://www.digitalauthority.me/resources/generative-engine-optimization-best-practices/) - Content patterns
- [FAQ Schema SEO 2026](https://wellows.com/blog/improve-search-visibility-with-faq-schema/) - 3.2x AI visibility stat
- [LLM SEO Best Practices](https://www.trooinbound.com/blog/9-llm-seo-best-practices-how-to-rank-on-llms-2026-guide/) - Content chunking
- [Answer Engine Optimization 2026](https://www.clickrank.ai/answer-engine-optimization-guide/) - Answer-first patterns

### Tertiary (LOW confidence)
- Temperature recommendations (0.5 for factual) - needs validation with actual output quality
- GEO statistics (22-37% improvement with statistics) - multiple sources cite, methodology unclear

---
*Research completed: 2026-02-04*
*Ready for roadmap: yes*
