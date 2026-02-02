# AI Football Predictions Platform

## What This Is

A production-ready platform where 30+ Open Source LLMs predict exact football match scores, with real-time leaderboards tracking model accuracy using Kicktipp quota scoring. Users view and compare model predictions across 17 leagues including Top 5 European leagues, Champions League, Europa League, Conference League, Eredivisie, Turkish League, and international tournaments.

## The ONE Thing That Must Work

The prediction pipeline must reliably generate scores from 35 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete. This is the core value proposition — without accurate predictions and fair scoring, the platform has no purpose.

## Why This Exists

To create the most comprehensive open-source LLM benchmark for reasoning and prediction capabilities, applied to the globally engaging domain of football. Unlike generic LLM leaderboards, this tests models on a concrete, time-sensitive prediction task with real outcomes.

## Who This Is For

- **AI researchers** comparing open-source model performance on real-world reasoning tasks
- **Football enthusiasts** curious about AI predictions for their favorite matches
- **Model developers** seeking benchmarks beyond traditional NLP tasks
- **Casual users** who enjoy comparing "AI vs AI" predictions

## Current State

**Brownfield project with v1.2 shipped.** The platform is operational with 17 leagues integrated, 35 LLM models connected via Together AI, and a complete match lifecycle pipeline. v1.2 Technical SEO Fixes milestone completed 2026-02-02 with all 13 requirements shipped.

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
- **LLM Integration**: 35 open-source models via Together AI API with automatic retry and failure handling
- **Prediction Generation**: Context-rich prompts incorporating team form, H2H, standings, and lineups, generating exact score predictions
- **Kicktipp Scoring**: Quota-based scoring system where rare correct predictions earn 2-6 points, exact scores earn +3 bonus (max 10 points)
- **Real-time Live Scores**: WebSocket/polling updates during matches with minute-by-minute tracking
- **Leaderboards**: Model rankings by total points, win rate, streaks, and accuracy metrics
- **Automated Content**: Post-match roundups generated via LLM and published as blog posts
- **Job Queue System**: BullMQ-based async pipeline scheduling jobs relative to match kickoff times (T-6h analysis, T-30m predictions, live monitoring)
- **Caching Layer**: Redis-based caching for API responses and expensive aggregations
- **Admin Interface**: Bull Board queue monitoring and dead-letter queue inspection

### Context

Shipped v1.2 with 40,129 LOC TypeScript.
Tech stack: Next.js 16, React 19, PostgreSQL, Redis, BullMQ, Together AI.
All 50 requirements validated across v1.0, v1.1, and v1.2 milestones.

## Constraints

**Technical:**
- Must maintain Together AI API integration (35 models configured)
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
| API-based LLM infrastructure | Cost-effective access to 35+ models without infrastructure overhead | Implemented via Together AI |
| Exact score predictions (not 1X2) | More impressive benchmark, demonstrates reasoning capability | Current system predicts 2-1, 0-0, etc. |
| Kicktipp quota scoring | Rewards rare correct predictions, penalizes herd behavior | 2-6 points based on prediction rarity |
| 30-minute pre-kickoff prediction window | Lineups available, but close enough to match for relevant context | T-30m with T-5m retry fallback |
| Bug fixes only scope | Existing platform has fundamental value, stability is priority | Current sprint focused on fixes |
| Keep 17 leagues | Already integrated, reducing scope would be regression | All leagues operational |

## Out of Scope

**Explicitly Not Building:**
- User prediction submission (view-only platform)
- Betting integration or odds comparison
- Additional LLM providers (sticking with Together AI)
- New leagues or competitions (maintain existing 17)
- New prediction types (stay with exact scores only)
- Mobile native apps (web-only)
- Real-time prediction updates during match (post-kickoff is settled)
- Model fine-tuning or custom training

## Current Milestone: v1.3 Match Page Refresh

**Goal:** Redesign match detail pages for mobile-first UX with consolidated content, fix LLM content generation pipeline, and optimize for AI search engines.

**Target features:**
- Consolidated match page layout removing duplicate data (score, predictions shown once)
- Working LLM content generation (pre-match, prediction, post-match text)
- Mobile-first responsive design with minimal scrolling
- AI search optimization (Perplexity, ChatGPT, Claude) with clean structured content
- GEO/SEO optimized metadata and structured data

## Open Questions

None currently.

---
*Last updated: 2026-02-02 after v1.3 milestone started*
