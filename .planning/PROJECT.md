# AI Football Predictions Platform

## What This Is

A production-ready platform where 42 Open Source LLMs predict exact football match scores, with real-time leaderboards tracking model accuracy using Kicktipp quota scoring. Users view and compare model predictions across 17 leagues including Top 5 European leagues, Champions League, Europa League, Conference League, Eredivisie, Turkish League, and international tournaments.

## The ONE Thing That Must Work

The prediction pipeline must reliably generate scores from 42 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete. This is the core value proposition — without accurate predictions and fair scoring, the platform has no purpose.

## Why This Exists

To create the most comprehensive open-source LLM benchmark for reasoning and prediction capabilities, applied to the globally engaging domain of football. Unlike generic LLM leaderboards, this tests models on a concrete, time-sensitive prediction task with real outcomes.

## Who This Is For

- **AI researchers** comparing open-source model performance on real-world reasoning tasks
- **Football enthusiasts** curious about AI predictions for their favorite matches
- **Model developers** seeking benchmarks beyond traditional NLP tasks
- **Casual users** who enjoy comparing "AI vs AI" predictions

## Current State

**Brownfield project with v2.5 shipped.** 42 active LLM models across Together AI (29) and Synthetic.new (13) providers. 208 requirements validated across 10 milestones (v1.0-v2.5)

### Validated (v2.5)

The following requirements were validated in v2.5:

- ✓ **PRMT-01**: Model-specific prompt templates exist for failing models — v2.5
- ✓ **PRMT-02**: GLM models receive English enforcement prompt — v2.5
- ✓ **PRMT-03**: Thinking models receive tag suppression prompt — v2.5
- ✓ **PRMT-04**: DeepSeek R1 uses minimal system prompt — v2.5
- ✓ **PRMT-05**: Prompt selector falls back to base prompt for unmapped models — v2.5
- ✓ **PRMT-06**: Models returning natural language receive JSON emphasis prompt — v2.5
- ✓ **JSON-01**: Models that fail JSON parsing receive structured output enforcement — v2.5
- ✓ **JSON-02**: qwen3-235b-thinking returns valid JSON after prompt adjustment — v2.5
- ✓ **JSON-03**: deepseek-v3.2 returns valid JSON after prompt adjustment — v2.5
- ✓ **JSON-04**: Integration test validates JSON output for all 42 models — v2.5
- ✓ **TIME-01**: Model-specific timeout configuration exists — v2.5
- ✓ **TIME-02**: Thinking models use 60s+ timeout — v2.5
- ✓ **TIME-03**: Kimi K2.5 uses 60s timeout — v2.5
- ✓ **TIME-04**: GLM models use 60s timeout — v2.5
- ✓ **FALL-01**: Fallback orchestrator wraps callAPI with try-catch + fallback — v2.5
- ✓ **FALL-02**: Synthetic model failures trigger automatic fallback to Together.ai — v2.5
- ✓ **FALL-03**: Fallback returns tuple for transparency — v2.5
- ✓ **FALL-04**: kimi-k2.5-syn falls back to Together.ai equivalent — v2.5
- ✓ **FALL-05**: glm-4.6-syn: no Together equivalent (by design) — v2.5
- ✓ **FALL-06**: glm-4.7-syn: no Together equivalent (by design) — v2.5
- ✓ **CYCL-01**: Fallback mapping validated at startup — v2.5
- ✓ **CYCL-02**: Runtime cycle detection tracks attemptedModels — v2.5
- ✓ **CYCL-03**: Max fallback depth limit prevents infinite retries — v2.5
- ✓ **COST-01**: Fallback logs warning if >2x more expensive — v2.5
- ✓ **COST-02**: Cost metadata tracked in prediction record — v2.5
- ✓ **COST-03**: Daily fallback cost visible in admin dashboard — v2.5
- ✓ **DYNM-01**: Homepage hero displays dynamic model count — v2.5
- ✓ **DYNM-02**: Leaderboard page displays dynamic model count — v2.5
- ✓ **DYNM-03**: Match page SEO metadata uses dynamic model count — v2.5
- ✓ **DYNM-04**: Content generation prompts use dynamic model count — v2.5
- ✓ **DYNM-05**: System prompts use dynamic model count — v2.5
- ✓ **DYNM-06**: Single source of truth (getActiveModelCount function) — v2.5
- ✓ **DYNM-07**: Cache invalidation on model enable/disable — v2.5
- ✓ **LEAD-01**: New models appear in leaderboard after first prediction — v2.5
- ✓ **LEAD-02**: Re-enabled models appear without manual intervention — v2.5
- ✓ **LEAD-03**: Leaderboard query uses active models from database — v2.5

### Validated (v2.4)

The following requirements were validated in v2.4:

- PROV-01: SyntheticProvider class extends OpenAICompatibleProvider with correct endpoint — v2.4
- PROV-02: Provider uses `SYNTHETIC_API_KEY` environment variable for authentication — v2.4
- PROV-03: Provider calls `https://api.synthetic.new/openai/v1/chat/completions` — v2.4
- PROV-04: Provider handles `hf:org/model` ID format correctly — v2.4
- MODL-01: 13 Synthetic models defined with ID, name, model, displayName — v2.4
- MODL-02: Reasoning models (R1-0528, K2-Thinking, Qwen3-Thinking) marked as premium tier — v2.4
- MODL-03: Models exported in `SYNTHETIC_PROVIDERS` array — v2.4
- MODL-04: Provider registry includes Synthetic providers alongside Together — v2.4
- DATA-01: Auto-sync registers models via syncModelsToDatabase() on server startup — v2.4
- DATA-02: Models have `provider: 'synthetic'` for identification — v2.4
- DATA-03: Models default to `active: true` via sync logic — v2.4
- ERRH-01: 429 rate limit errors handled with existing retry logic — v2.4
- ERRH-02: Missing `SYNTHETIC_API_KEY` throws descriptive error at startup — v2.4
- ERRH-03: Model failures trigger auto-disable after 3 consecutive failures — v2.4
- TEST-01: Each model tested with sample prediction (7 validated, 6 disabled) — v2.4
- TEST-02: Thinking model output correctly parsed (DeepSeek R1, Kimi K2-Thinking work) — v2.4
- TEST-03: GLM models auto-disabled (timeout/API bug detected) — v2.4

### Validated (v2.3)

The following requirements were validated in v2.3:

- ✓ **PIPE-01**: Content generation functions throw errors on failure instead of returning false — v2.3
- ✓ **PIPE-02**: Content queue uses 120-second lock duration for long-running jobs — v2.3
- ✓ **PIPE-03**: Content validation runs before database save (min 100 chars, no placeholder text) — v2.3
- ✓ **PIPE-04**: Failed jobs reach dead letter queue for visibility — v2.3
- ✓ **PIPE-05**: Circuit breaker pauses queue after 5 consecutive rate limit errors — v2.3
- ✓ **PIPE-06**: Worker heartbeat monitoring detects process death — v2.3
- ✓ **PIPE-07**: Content completeness monitoring alerts when finished matches have no content — v2.3
- ✓ **PIPE-08**: Blog generation pipeline triggers reliably — v2.3
- ✓ **HTML-01**: LLM prompts include explicit "plain text only, no HTML" instruction — v2.3
- ✓ **HTML-02**: HTML tags stripped before database save (not just at render) — v2.3
- ✓ **HTML-03**: One-time migration cleans HTML from existing content — v2.3
- ✓ **HTML-04**: Content rendered without visible HTML artifacts — v2.3
- ✓ **SGEO-01**: Pre-match content uses answer-first structure (prediction in first 30-60 words) — v2.3
- ✓ **SGEO-02**: Post-match content uses answer-first structure (result in first 30-60 words) — v2.3
- ✓ **SGEO-03**: FAQ questions are match-specific with actual data (not generic) — v2.3
- ✓ **SGEO-04**: Upcoming matches generate 5 state-specific FAQ questions — v2.3
- ✓ **SGEO-05**: Finished matches generate 5 state-specific FAQ questions including accuracy — v2.3
- ✓ **SGEO-06**: Finished match FAQ includes "How accurate were AI predictions?" with X/35 data — v2.3
- ✓ **SGEO-07**: Content includes datePublished and dateModified schema properties — v2.3
- ✓ **SGEO-08**: Entity names consistent throughout content (full team names, not abbreviations) — v2.3
- ✓ **BLOG-01**: Blog generation jobs trigger reliably for eligible matches — v2.3
- ✓ **BLOG-02**: Blog content uses same error handling pattern as match content — v2.3
- ✓ **BLOG-03**: Blog content sanitized before save — v2.3
- ✓ **BLOG-04**: Blog posts include answer-first summary paragraph — v2.3

### Validated (v2.2)

The following requirements were validated in v2.2:

- ✓ **LAYT-01**: Match page renders as single scrollable page (no tabs) — v2.2
- ✓ **LAYT-02**: Score displays exactly once in a single hero section — v2.2
- ✓ **LAYT-03**: Layout adapts to match state (Upcoming/Live/Finished) — v2.2
- ✓ **LAYT-04**: Sections follow consistent order: Match Info -> Narrative -> Predictions -> FAQ — v2.2
- ✓ **LAYT-05**: Mobile layout identical to desktop (no hidden/collapsed content) — v2.2
- ✓ **CONT-01**: Match hero shows teams, competition, kickoff time, and score — v2.2
- ✓ **CONT-02**: Pre-match narrative renders for upcoming matches — v2.2
- ✓ **CONT-03**: Post-match narrative renders for finished matches — v2.2
- ✓ **CONT-04**: Predictions table shows all 35 models in sortable format — v2.2
- ✓ **CONT-05**: Finished match predictions shows actual result and points earned — v2.2
- ✓ **CONT-06**: FAQ section auto-generates 5-7 questions from match data — v2.2
- ✓ **CONT-07**: Live match shows current score and match time — v2.2
- ✓ **SGEO-01**: Single consolidated JSON-LD @graph with SportsEvent + FAQPage — v2.2
- ✓ **SGEO-02**: FAQPage schema contains same questions as visible FAQ section — v2.2
- ✓ **SGEO-03**: eventStatus correctly maps to all states — v2.2
- ✓ **SGEO-04**: Content uses semantic H2/H3 headings matching FAQ questions — v2.2
- ✓ **SGEO-05**: Answer-first paragraph structure (key info in opening sentences) — v2.2
- ✓ **ARCH-01**: Single MatchDataProvider context supplies data to all components — v2.2
- ✓ **ARCH-02**: No component fetches match data independently — v2.2
- ✓ **ARCH-03**: Match state derived once at page level, passed via context — v2.2
- ✓ **ARCH-04**: Deprecated components removed (match-header.tsx, tab components) — v2.2

### Validated (v2.1)

The following requirements were validated in v2.1:

- ✓ **LAYT-01**: Remove sticky header — header scrolls naturally with page — v2.1
- ✓ **LAYT-02**: Remove mobile tabbed navigation — single scrollable page — v2.1
- ✓ **LAYT-03**: Unified layout order (Score → Scorers → Odds → Reports → Predictions → FAQ) — v2.1
- ✓ **FILT-01**: Hide H2H section completely from match pages — v2.1
- ✓ **FILT-02**: Hide league standings section completely from match pages — v2.1
- ✓ **FILT-03**: Hide empty sections when no data exists — v2.1
- ✓ **FILT-04**: No "unavailable" placeholder messages shown — v2.1
- ✓ **QUAL-01**: Strip HTML tags from narrative content — v2.1
- ✓ **QUAL-02**: Clean narrative output in database content — v2.1

### Validated (v2.0)

The following requirements were validated in v2.0:

- ✓ **DSGN-01**: Semantic color tokens for sports states (win/loss/draw) — v2.0
- ✓ **DSGN-02**: Typography scale with responsive sizing — v2.0
- ✓ **DSGN-03**: Spacing system with 4px/8px rhythm — v2.0
- ✓ **DSGN-04**: Component variants for match states — v2.0
- ✓ **DSGN-05**: Full dark mode support with toggle — v2.0
- ✓ **DSGN-06**: View Transitions API for smooth navigation — v2.0
- ✓ **MTCH-01**: Score displays exactly once on page — v2.0
- ✓ **MTCH-02**: Pre-match narrative visible on upcoming pages — v2.0
- ✓ **MTCH-03**: Prediction explanations visible on match pages — v2.0
- ✓ **MTCH-04**: Post-match roundup visible on finished pages — v2.0
- ✓ **MTCH-05**: PPR static shell with streaming dynamic content — v2.0
- ✓ **MTCH-06**: Answer-first content for GEO/AI citations — v2.0
- ✓ **BLOG-01**: Readable 70ch max line width — v2.0
- ✓ **BLOG-02**: Typography hierarchy (H1, H2, H3 styling) — v2.0
- ✓ **BLOG-03**: Table of contents for 500+ word articles — v2.0
- ✓ **BLOG-04**: FAQ section with FAQPage schema — v2.0
- ✓ **BLOG-05**: Related articles widget — v2.0
- ✓ **LEAG-01**: SEO-optimized metadata — v2.0
- ✓ **LEAG-02**: SportsOrganization schema — v2.0
- ✓ **LEAG-03**: FAQ section with FAQPage schema — v2.0
- ✓ **LEAG-04**: Competition stats dashboard — v2.0
- ✓ **LEAG-05**: Historical trends visualization — v2.0
- ✓ **LEAD-01**: SEO metadata and FAQ with schema — v2.0
- ✓ **LEAD-02**: Time period filters (weekly/monthly/all) — v2.0
- ✓ **LEAD-03**: Trend indicators for model performance — v2.0
- ✓ **NAVL-01**: Bottom navigation bar for mobile — v2.0
- ✓ **NAVL-02**: Breadcrumbs on all pages — v2.0
- ✓ **NAVL-03**: Related content widgets — v2.0
- ✓ **NAVL-04**: Automated entity linking in content — v2.0
- ✓ **NAVL-05**: Prefetch on hover/touch — v2.0
- ✓ **PERF-01**: PPR enabled for static shells — v2.0
- ✓ **PERF-02**: Cache configuration without conflicts — v2.0
- ✓ **PERF-03**: Client component audit complete — v2.0
- ✓ **PERF-04**: View Transitions polished — v2.0

### Validated (v1.3)

The following requirements were validated in v1.3:

- ✓ **CONT-01**: Pre-match LLM content renders on upcoming match pages — v1.3
- ✓ **CONT-02**: Prediction content renders on match pages with predictions — v1.3
- ✓ **CONT-03**: Post-match LLM content renders on finished match pages — v1.3
- ✓ **CONT-04**: Unified content query fetches from both tables — v1.3
- ✓ **CONT-05**: Long narrative content chunked with "Read More" expansion — v1.3
- ✓ **MOBL-01**: Match score displays exactly once in sticky header — v1.3
- ✓ **MOBL-02**: AI predictions consolidated into single expandable section — v1.3
- ✓ **MOBL-03**: Advanced match stats collapsed behind progressive disclosure — v1.3
- ✓ **MOBL-04**: Tabbed navigation (Summary/Stats/Predictions/Analysis) — v1.3
- ✓ **MOBL-05**: Swipe gestures work between tabs on mobile — v1.3
- ✓ **MOBL-06**: Touch targets meet 44x44px minimum for accessibility — v1.3
- ✓ **PERF-01**: Match pages use ISR with 60s revalidation — v1.3
- ✓ **PERF-02**: Parallel data fetching with Promise.all — v1.3
- ✓ **PERF-03**: TTFB optimization infrastructure in place — v1.3
- ✓ **SRCH-01**: robots.txt allows AI crawlers — v1.3
- ✓ **SRCH-02**: llms.txt provides structured content paths — v1.3
- ✓ **SRCH-03**: Single consolidated Schema.org JSON-LD graph — v1.3
- ✓ **SRCH-04**: AI-generated content visible to crawlers (SSR) — v1.3

### Validated (v1.2)

The following requirements were validated in v1.2:

- ✓ **SEO-T01**: Fix 500 error on Genoa vs Bologna match page — v1.2
- ✓ **SEO-T02**: Fix broken redirect chain that leads to 500 error — v1.2
- ✓ **SEO-T03**: Create league index pages for long-form slugs — v1.2
- ✓ **SEO-T04**: Update internal links to use correct league slugs — v1.2
- ✓ **SEO-T05**: Add H1 tag to match detail pages — v1.2
- ✓ **SEO-T06**: Shorten match page title template to <60 characters — v1.2
- ✓ **SEO-T07**: Shorten league page title template for long names — v1.2
- ✓ **SEO-T08**: Convert 307 temporary redirects to 308 permanent — v1.2
- ✓ **SEO-T09**: Remove noindex from league hub pages — v1.2
- ✓ **SEO-T10**: Add internal linking to orphan pages — v1.2
- ✓ **SEO-T11**: Add cross-links between related matches — v1.2
- ✓ **SEO-T12**: Add "Related models" section to model pages — v1.2
- ✓ **SEO-T13**: Add recent predictions widget to competition pages — v1.2

### Validated (v1.1)

The following requirements were validated in v1.1:

- ✓ **STAT-01**: All accuracy calculations use single standardized formula — v1.1
- ✓ **STAT-02**: Fixed IS NOT NULL vs > 0 mismatch in accuracy queries — v1.1
- ✓ **STAT-03**: Added NULLIF() protection to all division operations — v1.1
- ✓ **STAT-04**: Consistent denominators across all queries — v1.1
- ✓ **STAT-05**: Created canonical stats service layer — v1.1
- ✓ **STAT-06**: Model detail page shows correct tendency accuracy — v1.1
- ✓ **MIGR-01**: Recalculated historical accuracy for all models — v1.1
- ✓ **MIGR-02**: Invalidated all stats-related caches atomically — v1.1
- ✓ **MIGR-03**: Verified leaderboard rankings match corrected calculations — v1.1
- ✓ **SEO-01**: Added Schema.org SportsEvent structured data — v1.1
- ✓ **SEO-02**: Added Schema.org Article structured data — v1.1
- ✓ **SEO-03**: Added BreadcrumbList structured data — v1.1
- ✓ **SEO-04**: Fixed OG image to show correct metric — v1.1
- ✓ **SEO-05**: Added metadata to competition pages — v1.1
- ✓ **SEO-06**: Optimized meta descriptions to < 160 characters — v1.1
- ✓ **SEO-07**: Ensured all pages have unique titles — v1.1
- ✓ **UX-01**: Display accuracy with denominator visible — v1.1
- ✓ **UX-02**: Added tooltips explaining metrics — v1.1
- ✓ **UX-03**: Leaderboard shows correct, trustworthy numbers — v1.1

### Validated (v1.0)

The following requirements were validated in v1.0:

- ✓ **CRIT-01**: JSON parse failures handled with multi-strategy extraction — v1.0
- ✓ **CRIT-02**: API timeouts recovered gracefully with error-type-aware backoff — v1.0
- ✓ **CRIT-03**: Model auto-disable uses proper threshold (5 failures) and recovery — v1.0
- ✓ **CRIT-04**: Queue workers handle null/malformed API data without crashing — v1.0
- ✓ **CRIT-05**: Database connection pool sized appropriately with monitoring — v1.0
- ✓ **DATA-01**: Settlement uses database transaction with row lock — v1.0
- ✓ **DATA-02**: Leaderboard totals calculated correctly — v1.0
- ✓ **DATA-03**: Streak tracking handles voided/cancelled matches — v1.0
- ✓ **DATA-04**: Cache invalidation timing ensures no stale data — v1.0
- ✓ **DATA-05**: Quota point calculation matches Kicktipp formula — v1.0
- ✓ **UIUX-01**: Match detail pages load within acceptable time — v1.0
- ✓ **UIUX-02**: Leaderboard updates visible without manual refresh — v1.0
- ✓ **UIUX-03**: Mobile responsiveness for prediction cards — v1.0
- ✓ **UIUX-04**: Error boundaries catch all React rendering failures — v1.0
- ✓ **INFR-01**: Circuit breaker state persists through Redis restarts — v1.0
- ✓ **INFR-02**: Cache pattern deletion uses SCAN instead of KEYS — v1.0
- ✓ **INFR-03**: API rate limits enforced at budget level — v1.0
- ✓ **INFR-04**: Redis unavailability handled gracefully — v1.0

### Existing Features

The following capabilities are built and operational:

- **Match Data Pipeline**: Automated fetching of fixtures, live scores, lineups, and statistics from API-Football for 17 leagues
- **LLM Integration**: 42 open-source models via Together AI (29) + Synthetic.new (13) with model-specific prompts and fallback chains
- **Prediction Generation**: Context-rich prompts incorporating team form, H2H, standings, and lineups, generating exact score predictions
- **Kicktipp Scoring**: Quota-based scoring system where rare correct predictions earn 2-6 points, exact scores earn +3 bonus (max 10 points)
- **Real-time Live Scores**: WebSocket/polling updates during matches with minute-by-minute tracking
- **Leaderboards**: Model rankings by total points, win rate, streaks, and accuracy metrics
- **Automated Content**: Post-match roundups generated via LLM and published as blog posts
- **Job Queue System**: BullMQ-based async pipeline scheduling jobs relative to match kickoff times (T-6h analysis, T-30m predictions, live monitoring)
- **Caching Layer**: Redis-based caching for API responses and expensive aggregations
- **Admin Interface**: Bull Board queue monitoring and dead-letter queue inspection

### Context

Shipped v2.5 with ~206,185 LOC TypeScript.
Tech stack: Next.js 16, React 19, PostgreSQL, Redis, BullMQ, Together AI, Synthetic.new, Vitest, Zod, Radix UI, next-themes, isomorphic-dompurify, html-to-text, he.
All 208 requirements validated across v1.0, v1.1, v1.2, v1.3, v2.0, v2.1, v2.2, v2.3, v2.4, and v2.5 milestones.

## Constraints

**Technical:**
- Must maintain Together AI API integration (29 models) + Synthetic.new (13 models)
- PostgreSQL + Redis infrastructure already deployed
- Next.js 16 + React 19 + TypeScript stack (no framework changes)
- API-Football data source (contracted)
- Daily budget limit for paid model inference ($1-5 USD range)

**Operational:**
- Predictions must complete within 30-60 minute window before kickoff
- Live score updates must be within 60 seconds of real events
- Leaderboard must handle concurrent match settlements without race conditions
- System must gracefully degrade when models fail (not crash entire pipeline)

**Business:**
- View-only platform (no user predictions or betting)
- Focus on bug fixes, not new features
- Maintain 17 league coverage (don't reduce scope)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| API-based LLM infrastructure | Cost-effective access to 42 models without infrastructure overhead | Implemented via Together AI + Synthetic.new |
| Exact score predictions (not 1X2) | More impressive benchmark, demonstrates reasoning capability | Current system predicts 2-1, 0-0, etc. |
| Kicktipp quota scoring | Rewards rare correct predictions, penalizes herd behavior | 2-6 points based on prediction rarity |
| 30-minute pre-kickoff prediction window | Lineups available, but close enough to match for relevant context | T-30m with T-5m retry fallback |
| Bug fixes only scope | Existing platform has fundamental value, stability is priority | Current sprint focused on fixes |
| Keep 17 leagues | Already integrated, reducing scope would be regression | All leagues operational |

## Out of Scope

**Explicitly Not Building:**
- User prediction submission (view-only platform)
- Betting integration or odds comparison
- New leagues or competitions (maintain existing 17)
- New prediction types (stay with exact scores only)
- Mobile native apps (web-only)
- Real-time prediction updates during match (post-kickoff is settled)
- Model fine-tuning or custom training
- Vision models (Qwen3-VL) - not useful for text-only predictions

## Current Milestone: v2.6 SEO/GEO Site Health

**Goal:** Fix all SEO/GEO issues identified by Ahrefs audit to achieve clean site health — 404 errors, broken internal links, missing index pages, canonical issues, redirect chains, meta tag problems, structured data errors, orphan pages, and slow pages.

**Target features:**
- Create missing `/models` and `/leagues` index pages (404 → 200)
- Fix canonical URLs on match pages (stop pointing to `/`)
- Replace meta refresh redirects with proper HTTP 301/308 redirects on `/matches/UUID`
- Fix internal links to use short-form league slugs (avoid 308 redirect chains)
- Add missing H1 tags, fix meta descriptions, fix title lengths
- Fix structured data validation errors (Schema.org + Google rich results)
- Add missing pages to sitemap, remove non-canonical pages from sitemap
- Fix hreflang annotations (add x-default)
- Complete Open Graph tags on all pages
- Improve internal linking to reduce orphan pages
- Fix 302 redirects to 301 for `www.kroam.xyz` and `http://kroam.xyz`

## Completed Milestones

v1.0, v1.1, v1.2, v1.3, v2.0, v2.1, v2.2, v2.3, v2.4, v2.5 — see `.planning/MILESTONES.md` for full history.

---
*Last updated: 2026-02-05 after v2.6 milestone started*
