# Project Milestones: AI Football Predictions Platform

## v2.8 Model Coverage (Shipped: 2026-02-08)

**Delivered:** Built comprehensive model diagnostic and fix infrastructure — regression test suite with golden fixtures, diagnostic runner with 6-category failure classification, data-driven timeout tuning, per-model health observability with admin dashboard and regression alerts.

**Phases completed:** 53-58 (13 plans total)

**Key accomplishments:**

- Regression test suite with golden fixtures + Zod validation at DB boundary + GitHub Actions CI workflow
- Diagnostic runner testing all 42 models with failure categorization (timeout, parse, language, thinking-tag, API-error, empty-response)
- Data-driven timeout tuning for reasoning models using P95 + 20% safety margin formula
- Belt-and-suspenders verification for language enforcement and JSON extraction on all problematic models
- Exhaustive fallback mapping documentation with offline coverage validation (29/35 effective models passing)
- Per-model health observability: llm_model_stats table, admin dashboard with Recharts trend charts, BullMQ daily cron worker with Pino regression alerts

**Stats:**

- 106 files changed, +17,936 / -344 lines
- 6 phases, 13 plans, 18 requirements
- 87 commits
- 2 days from start to ship (2026-02-07 → 2026-02-08)

**Git range:** `6a76024 (feat(53-01))` → `5fcd7ea (docs(phase-58))`

**Diagnostic findings:** 7 Together AI models deprecated by provider, 3 Synthetic models unfixable upstream. Effective model count adjusted to 35 with 82.9% passing rate.

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.7 Pipeline Reliability & Retroactive Backfill (Shipped: 2026-02-07)

**Delivered:** Fixed prediction pipeline scheduling after server restarts, added retroactive backfill for missed predictions, settlement retry infrastructure, and pipeline health monitoring with gap detection dashboards.

**Phases completed:** 49-52 (9 plans total)

**Key accomplishments:**

- Fixed pipeline scheduling — past-due matches no longer dropped after server restarts (status-based guards)
- Widened backfill windows to 48h/12h/12h for comprehensive catch-up coverage
- Settlement retry infrastructure with admin API, conditional retry logic, and zero-prediction detection
- Retroactive backfill script generates missing predictions for any time window with idempotent job orchestration
- Pipeline health monitoring: /api/health coverage %, admin dashboards, severity-classified alerts, queue metrics

**Stats:**

- 48 files changed, +8,580 / -114 lines
- 4 phases, 9 plans, 20 requirements
- 39 commits
- 2 days from start to ship (2026-02-06 → 2026-02-07)

**Git range:** `33558e8 (docs(49))` → `359e810 (docs(52))`

**Tech debt:** SETTLE-01 investigation script ready but not executed against production Redis

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.6 SEO/GEO Site Health (Shipped: 2026-02-06)

**Delivered:** Fixed all 24 SEO/GEO issues from Ahrefs audit — eliminated 404s, fixed canonical URLs, cleaned sitemaps, resolved orphan pages, optimized meta tags, fixed structured data, removed broken hreflang.

**Phases completed:** 44-48 (17 plans total)

**Key accomplishments:**

- Removed cascading canonical from root layout, fixed match page self-referential canonicals
- Created /leagues and /models index pages with ISR and metadata
- Sitemap cleanup with centralized getInternalUrl helper
- Cross-linking widgets on model, match, and league pages
- Centralized metadata formulas with length validation
- Dark gradient OG images and CollectionPage structured data
- Deduplicated JSON-LD schemas with @id references and build-time validation
- TTFB measurement pass and parallelized match metadata queries

**Stats:**

- 17 phases, 24 requirements
- Shipped 2026-02-06

**Git range:** Phase 44-48

**What's next:** v2.7 Pipeline Reliability & Retroactive Backfill

---

## v2.5 Model Reliability & Dynamic Counts (Shipped: 2026-02-05)

**Delivered:** Made all 42 models work reliably with model-specific prompts, Together.ai fallback chains, dynamic model counts everywhere, and comprehensive integration testing with production monitoring.

**Phases completed:** 40-43 (11 plans total)

**Key accomplishments:**

- Model-specific prompt system with 5 prompt variants and 3 response handlers for failing models
- Re-enabled 6 previously disabled Synthetic models (Qwen3-235B-Thinking, DeepSeek V3.2, Kimi K2.5, GLM 4.6/4.7, GPT-OSS 120B)
- Together AI fallback chains with cycle detection, max depth 1, and cost tracking
- Dynamic model counts replacing all hardcoded "35 models" across SEO, pages, content generation
- Vitest integration tests validating JSON output for all 42 models
- Admin fallback dashboard with per-model rates and 2x cost warning badges

**Stats:**

- 70 files changed, +10,651 / -328 lines
- 4 phases, 11 plans, 36 requirements
- 54 commits
- 1 day from start to ship (2026-02-05)

**Git range:** `256727c (docs(40))` → `f3754dc (docs(43))`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.4 Synthetic.new Integration (Shipped: 2026-02-05)

**Delivered:** Added Synthetic.new as second LLM provider with 7 validated models (2 reasoning + 5 standard), expanding total active models from 29 to 36 with fallback mapping for cross-provider resilience.

**Phases completed:** 37-39 (7 plans total)

**Key accomplishments:**

- SyntheticProvider class created using OpenAI-compatible API pattern
- 13 Synthetic models configured with -syn ID suffix for disambiguation
- Provider registry updated to conditionally include both Together + Synthetic
- 7/13 models validated for production (2 reasoning + 5 standard)
- 6 failing models disabled (preserving definitions for future re-testing)
- Together AI fallback mapping added for cross-provider resilience

**Stats:**

- 20 files changed, +3,199 / -117 lines
- ~195,862 lines of TypeScript (total codebase)
- 3 phases, 7 plans, 17 requirements
- 16 days from start to ship (2026-01-20 → 2026-02-05)

**Git range:** `feat(37-01)` → `docs(39)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.3 Content Pipeline & SEO (Shipped: 2026-02-04)

**Delivered:** Fixed content generation pipeline reliability with proper error handling, HTML sanitization, circuit breaker protection, SEO/GEO optimized prompts with answer-first structure, and aligned blog generation patterns.

**Phases completed:** 31-36 (13 plans total)

**Key accomplishments:**

- Diagnosed root cause — Application server not running since 2026-02-01, all workers halted
- Error handling overhaul — Content generation throws errors with BullMQ retry/DLQ integration
- HTML sanitization pipeline — Defense-in-depth with prompt instructions + runtime html-to-text/he sanitization
- Pipeline hardening — Queue-level circuit breaker (pauses after 5 rate limits), worker health monitoring, content completeness alerts
- SEO/GEO optimization — Answer-first prompts ensure prediction/result in first 30-60 words, match-specific FAQs with exact accuracy data
- Blog generation alignment — Same error handling and answer-first patterns for league roundups and model reports

**Stats:**

- 57 files changed, +8,389 / -402 lines
- 193,767 lines of TypeScript (total codebase)
- 6 phases, 13 plans, 24 requirements
- 1 day from start to ship (2026-02-04)

**Git range:** `feat(31-01)` → `docs(36)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.2 Match Page Rewrite (Shipped: 2026-02-04)

**Delivered:** Complete rewrite of match detail pages with context-driven architecture, single authoritative hero, state-aware content sections, AI-generated FAQ with Schema.org markup, and deprecated component cleanup.

**Phases completed:** 26-30 (17 plans total)

**Key accomplishments:**

- Context-driven architecture — MatchDataProvider establishes single source of truth for match data
- Single authoritative hero — MatchHero displays score exactly once with live minute polling
- State-aware content — MatchNarrative shows "Match Preview" or "Match Report" based on matchState
- Sortable predictions table — 35 models with color-coded points and accessibility icons
- AI-generated FAQ — 5 questions per match state with Together AI and FAQPage schema
- Clean codebase — 16 deprecated components removed (-1,673 lines)

**Stats:**

- 47,251 lines of TypeScript (-1,408 from v2.1 due to cleanup)
- 5 phases, 17 plans, 21 requirements
- 65 files changed, +3,337 / -2,101 lines
- 2 days from start to ship (2026-02-03 → 2026-02-04)

**Git range:** `feat(26-01)` → `docs(30)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.1 Match Page Simplification (Shipped: 2026-02-03)

**Delivered:** Simplified match page layout with natural scrolling (no sticky header), unified single-column design (no mobile tabs), removed H2H/standings sections, and clean HTML stripping for narrative content.

**Phases completed:** 24-25 (3 plans total)

**Key accomplishments:**

- Unified single-column layout — all devices scroll naturally without sticky header or mobile tabs
- Removed H2H and league standings sections — cleaner interface, fewer API calls
- Empty section hiding — components return null when no data (no "unavailable" placeholders)
- HTML stripping utility with isomorphic-dompurify for SSR-compatible content sanitization
- Clean narrative rendering — pre-match, betting, and post-match display without raw HTML tags
- Performance improvement — removed standings API call from match page data fetching

**Stats:**

- 98,659 lines of TypeScript (+2,391 from v2.0)
- 2 phases, 3 plans, 9 requirements
- 21 files changed, +2,691 / -300 lines
- 1 day from start to ship (2026-02-03)

**Git range:** `feat(24-01)` → `docs(25)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.0 UI/UX Overhaul (Shipped: 2026-02-03)

**Delivered:** Complete UI/UX rebuild with new design system, dark mode, View Transitions, PPR streaming, FAQ schemas for GEO optimization, and systematic internal linking across all page types.

**Phases completed:** 17-23 (28 plans total)

**Key accomplishments:**

- Design system foundation with OKLCH semantic color tokens, 1.2 type scale, 4px/8px spacing rhythm
- Dark mode with next-themes (system preference default, manual toggle)
- View Transitions API for smooth page navigation (150ms duration)
- Match page rebuild with score deduplication, TL;DR summaries, narrative previews, FAQ schema
- Blog page rebuild with 70ch line width, TOC with IntersectionObserver scroll spy, FAQ extraction
- League page rebuild with enhanced SportsOrganization schema, CSS-only trend charts, dynamic FAQs
- Leaderboard time period filters (weekly/monthly/all-time) with rank trend indicators
- Bottom navigation bar for mobile with 44px touch targets
- Breadcrumbs on all 5 page types with builder utilities
- EntityLinkedText for inline team/model/competition links
- HoverPrefetchLink for intent-based prefetching on hover/touch
- PPR enabled via cacheComponents with Suspense boundaries
- 3 client components converted to server components

**Stats:**

- 46,402 lines of TypeScript
- 7 phases, 28 plans, 33 requirements
- 1 day from start to ship (2026-02-02 → 2026-02-03)

**Git range:** `feat(17-01)` → `docs(23-03)`

**Tech debt deferred:**

- ThemeToggle not integrated into Navigation (2 min fix)
- MatchBadge/AccuracyBadge components orphaned (0 imports)
- 50+ hardcoded colors could use semantic tokens

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.3 Match Page Refresh (Shipped: 2026-02-02)

**Delivered:** Mobile-first match pages with unified content query, tabbed navigation with swipe gestures, ISR caching, and AI search optimization (robots.txt, llms.txt, consolidated Schema.org @graph).

**Phases completed:** 13-16 (13 plans total)

**Key accomplishments:**

- Unified content query (`getMatchContentUnified`) merging dual-table content with COALESCE prioritization
- Mobile tabbed navigation (Summary/Stats/Predictions/Analysis) with react-swipeable swipe gestures
- Sticky header with de-duplicated score display (position:sticky avoids CLS)
- 44px touch targets meeting WCAG 2.5.5 AAA accessibility standards
- ISR caching enabled with 60-second revalidation (removed force-dynamic)
- Parallel data fetching with two-stage Promise.all pattern
- Consolidated Schema.org JSON-LD @graph with 5 entities for AI search engines
- AI crawler configuration (GPTBot, ClaudeBot, PerplexityBot) and llms.txt structured paths

**Stats:**

- 82,942 lines of TypeScript (+2,608 from v1.2)
- 4 phases, 13 plans, 18 requirements
- 48 commits, 58 files changed
- +9,124 / -382 lines (net +8,742)
- 13 days from start to ship

**Git range:** `feat(13-01)` → `docs(16)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.2 Technical SEO Fixes (Shipped: 2026-02-02)

**Delivered:** Fixed ~1,083 SEO issues from Ahrefs audit including 500 errors, 404s in sitemap, redirect chains, missing H1 tags, long titles, and orphan pages with new internal linking widgets.

**Phases completed:** 9-12 (9 plans total)

**Key accomplishments:**

- Competition alias system with 308 redirects enabling both short IDs and long-form slugs
- Edge-level redirects in next.config.ts for faster redirect resolution
- Defensive error handling on match pages (404 instead of 500)
- MatchH1 component with sr-only class for SEO without visual changes
- Abbreviation utilities for team/competition names keeping titles under 60 chars
- permanentRedirect() for all SEO-critical redirects (308 status)
- RelatedMatchesWidget showing related matches from same competition/teams
- RelatedModelsWidget showing top performers on model pages
- RecentPredictionsWidget on competition hub pages

**Stats:**

- 40,129 lines of TypeScript
- 4 phases, 9 plans
- 22 commits, 34 files changed
- +4,147 / -42 lines
- 1 day from start to ship

**Git range:** `feat(09-01)` → `docs(12)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.1 Stats Accuracy & SEO (Shipped: 2026-02-02)

**Delivered:** Fixed critical 48% accuracy inflation bug, added SEO structured data for Google Rich Results, and improved UX transparency with visible denominators and methodology tooltips.

**Phases completed:** 5-8 (10 plans total)

**Key accomplishments:**

- Canonical stats service with `tendencyPoints > 0` formula fixing 48% accuracy bug
- Migration snapshot with verification report for audit trail and rollback capability
- Schema.org structured data (SportsEvent, Article, BreadcrumbList) for Rich Results
- Methodology page explaining accuracy calculation formula
- AccuracyDisplay component showing "X/Y (Z%)" format with tooltips
- OG image accuracy badges for social sharing visibility

**Stats:**

- 80,334 lines of TypeScript (+41,864 from v1.0)
- 4 phases, 10 plans
- 79 commits, 218 files changed
- +36,895 / -8,161 lines (net +28,734)
- 1 day from start to ship

**Git range:** `feat(05-01)` → `docs(08)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v1.0 Bug Fix Stabilization (Shipped: 2026-02-01)

**Delivered:** Production stability for prediction pipeline with 18 critical bug fixes across database, queue workers, scoring, caching, and frontend.

**Phases completed:** 1-4 (14 plans total)

**Key accomplishments:**

- Database pool sized to 20 connections with health monitoring and alerting
- Multi-strategy JSON extraction (4 fallbacks) for robust LLM response parsing
- Error-type-aware model recovery with 7 error classifications and 1h cooldown
- Transaction-safe settlement with FOR UPDATE row locking prevents race conditions
- Kicktipp-accurate quota calculation (2-6 points based on prediction rarity)
- Streaming SSR with React Suspense for sub-500ms TTFB on match pages
- API budget enforcement (100/day) with Redis graceful degradation
- Mobile-responsive prediction cards and auto-refresh leaderboards
- Error boundaries catch all React rendering failures

**Stats:**

- 38,470 lines of TypeScript
- 4 phases, 14 plans
- 47.9 minutes total execution time
- 1 day from start to ship

**Git range:** `feat(01-00)` → `feat(04-03)`

**What's next:** New milestone planning with `/gsd:new-milestone`

---

## v2.9 Provider Unification & Maximum Coverage (Shipped: 2026-02-11)

**Delivered:** Unified all 42 models under OpenRouter as single provider — built multi-provider routing with 3-tier fallback chains, provider attribution tracking, migration scripts with dedup/validation/dry-run, then simplified by removing Synthetic and Together AI providers entirely via quick-040/041.

**Phases completed:** 59-62 + quick-040/041 (5 plans + 2 quick tasks)

**Key accomplishments:**

- OpenRouterProvider class with HTTP-Referer/X-Title headers and conditional registry inclusion
- MODEL_PROVIDER_ROUTES replacing MODEL_FALLBACKS with per-model ordered provider priority lists
- Provider attribution column on predictions table (provider_used field populated for 100% of predictions)
- Migration script with dedup resolution, dry-run mode, pre/post validation checksums
- Removed Synthetic and Together AI providers — all 42 models on OpenRouter as single provider
- Reduced active model count from 42 to 21, capped reasoning tokens, cut retries 5→2 (quick-043)

**Stats:**

- Phases 59-62 (4 phases, 5 plans) + quick-040/041/042/043
- 3 days from start to ship (2026-02-08 → 2026-02-11)

**Git range:** `feat(59-01)` → `quick-043`

**What's next:** v3.0 Club/Team Pages

---

## v3.0 Club/Team Pages (Shipped: 2026-02-12)

**Delivered:** Added dedicated team pages for every club across all 17 leagues with per-club model leaderboards, match predictions, AI-generated analysis, and full SEO optimization including SportsTeam schema, FAQPage markup, and quality-filtered sitemap.

**Phases completed:** 67-71 (10 plans total)

**Key accomplishments:**

- 164 teams mapped with slug resolution, alias support, and 100% DB coverage validation
- Single-query team stats using 13 CASE WHEN statements (no N+1 patterns)
- Full SEO stack — SportsTeam schema, meta tags, OG images, quality-filtered sitemap, FAQPage markup
- 7 team page components — leaderboard, time filter, stats overview, form indicator, upcoming/recent matches, accuracy trend chart
- Bidirectional navigation — team links on league pages, match pages, and between teams via overlay anchor pattern
- AI content pipeline — rate-limited BullMQ worker with dual triggers (event-driven + weekly cron), anti-hallucination prompts

**Stats:**

- 210 files changed, +27,269 / -18,564 lines
- 5 phases, 10 plans, 18 requirements
- 68 commits
- 2 days from start to ship (2026-02-11 → 2026-02-12)

**Git range:** `542e3d5 (docs(67))` → `6062170 (docs(phase-71))`

**Tech debt:** 6 non-blocking items (see v3.0-MILESTONE-AUDIT.md): no SQL migration for teamContent table, rate limit math margin, ISR removed for PPR compatibility, canonical URL strategy TBD, getAllTeamSlugs unused, human verification items pending.

**What's next:** New milestone planning with `/gsd:new-milestone`

---

*Last updated: 2026-02-12 after v3.0 milestone*

## v3.1 Model Lifecycle & Discord Alerts (Shipped: 2026-02-13)

**Delivered:** Configured 20 active OpenRouter models (replaced 11 old with 14 new), added model archive system with leaderboard toggle, and built Discord webhook notifications for auto-disable and regression alerts.

**Phases completed:** 72-74 (5 plans total)

**Key accomplishments:**

- Configured 20 active OpenRouter models with correct IDs, pricing, and prompt variants (11 removed, 14 added/updated)
- Added `archived` boolean column to models schema with migration and DB index
- Excluded archived models from prediction pipeline, dynamic counts, and leaderboard queries by default
- Built "Show archived" toggle on all leaderboard pages with badge + opacity-60 visual indicator
- Created Discord webhook notification service with rich embeds for auto-disable (5+ failures) and regression (>10% drop) events

**Stats:**

- 35 files changed, +3,224 / -274 lines
- ~55,000 lines of TypeScript (total codebase)
- 3 phases, 5 plans, 18 requirements
- 2 days from start to ship (2026-02-12 → 2026-02-13)

**Git range:** `178fe8b (docs(72))` → `64b6b69 (docs(phase-74))`

**Decisions:**
- Kept Nemotron Nano 9B v2 as 20th model (Nemotron 30B unavailable on OpenRouter)
- Archived excluded by default with opt-in includeArchived flag
- Fire-and-forget pattern for auto-disable alerts to avoid pipeline latency
- Read DISCORD_WEBHOOK_URL directly from process.env for graceful degradation

**What's next:** New milestone planning with `/gsd:new-milestone`

---

