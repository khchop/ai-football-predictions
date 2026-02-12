# AI Football Predictions Platform

## What This Is

A production-ready platform where 21 active Open Source LLMs predict exact football match scores, with real-time leaderboards tracking model accuracy using Kicktipp quota scoring. Features dedicated club pages for 164 teams across 17 leagues with per-club model leaderboards, AI-generated analysis, and full SEO optimization. Includes per-model health monitoring, diagnostic infrastructure, and regression protection.

## The ONE Thing That Must Work

The prediction pipeline must reliably generate scores from 21 LLMs ~30 minutes before kickoff and accurately calculate Kicktipp quota points when matches complete. This is the core value proposition — without accurate predictions and fair scoring, the platform has no purpose.

## Why This Exists

To create the most comprehensive open-source LLM benchmark for reasoning and prediction capabilities, applied to the globally engaging domain of football. Unlike generic LLM leaderboards, this tests models on a concrete, time-sensitive prediction task with real outcomes.

## Who This Is For

- **AI researchers** comparing open-source model performance on real-world reasoning tasks
- **Football enthusiasts** curious about AI predictions for their favorite matches
- **Model developers** seeking benchmarks beyond traditional NLP tasks
- **Casual users** who enjoy comparing "AI vs AI" predictions

## Current State

**Brownfield project with v3.0 shipped.** 21 active LLM models on OpenRouter (single provider) with provider attribution tracking. 288 requirements validated across 15 milestones (v1.0-v3.0). Dedicated team pages for 164 clubs with per-club model leaderboards, AI-generated content, and full SEO stack. Per-model health observability with admin dashboard and regression alerts.

## Requirements

### Validated (v3.0)

- ✓ **PAGE-01**: Team detail page at /teams/[slug] — v3.0
- ✓ **PAGE-02**: Teams index page /teams with league grouping — v3.0
- ✓ **PAGE-03**: Team slugs resolve to DB names including aliases — v3.0
- ✓ **PAGE-04**: Breadcrumb navigation on team pages — v3.0
- ✓ **STAT-01**: Per-club model leaderboard — v3.0
- ✓ **STAT-02**: Time period filter (all/season/monthly/weekly) — v3.0
- ✓ **STAT-03**: Club statistics (W/D/L, goals, averages) — v3.0
- ✓ **STAT-04**: Model accuracy trends over time — v3.0
- ✓ **MTCH-01**: Upcoming match predictions with distribution — v3.0
- ✓ **MTCH-02**: Recent match results with accuracy — v3.0
- ✓ **MTCH-03**: Visual form indicator (W/D/L timeline) — v3.0
- ✓ **NAV-01**: Clickable team names on league pages — v3.0
- ✓ **NAV-02**: Clickable team names on match pages — v3.0
- ✓ **SEO-01**: SportsTeam structured data (JSON-LD) — v3.0
- ✓ **SEO-02**: Meta tags, canonical URLs, OG images — v3.0
- ✓ **SEO-03**: Sitemap with quality filter (5+ matches) — v3.0
- ✓ **SEO-04**: AI-generated club analysis content — v3.0
- ✓ **SEO-05**: Dynamic FAQs with FAQPage schema — v3.0

### Validated (v2.9)

- ✓ **PROV-01 through PROV-05**: OpenRouter provider with correct endpoint, headers, conditional inclusion — v2.9
- ✓ **ROUT-01 through ROUT-06**: Multi-provider routing with fallback chains, cycle detection, max depth — v2.9
- ✓ **ATTR-01 through ATTR-04**: Provider attribution in predictions table, admin dashboard visibility — v2.9
- ✓ **CONS-01, CONS-02, CONS-05, CONS-08**: Model consolidation with dedup, validation, dry-run — v2.9

### Validated (v2.8)

- ✓ **DIAG-01 through DIAG-05**: Diagnostic runner with failure categorization and raw response capture — v2.8
- ✓ **REGR-01 through REGR-03**: Regression test suite with golden fixtures and Zod validation — v2.8
- ✓ **FIX-01 through FIX-06**: Per-model timeout tuning, thinking tag stripping, English enforcement — v2.8
- ✓ **OBS-01 through OBS-04**: Per-model health observability with admin dashboard and regression alerts — v2.8

### Validated (v2.7)

- ✓ **PIPE-01 through PIPE-05**: Pipeline catch-up scheduling after server restart — v2.7
- ✓ **SETTLE-01 through SETTLE-04**: Settlement retry with zero-prediction detection — v2.7
- ✓ **RETRO-01 through RETRO-06**: Retroactive backfill script with idempotent job orchestration — v2.7
- ✓ **MON-01 through MON-05**: Pipeline health monitoring with gap detection dashboards — v2.7

### Validated (v2.6 and earlier)

See `.planning/MILESTONES.md` for full history of v1.0 through v2.6 validated requirements (270+ requirements).

### Active

(No active requirements — planning next milestone)

### Out of Scope

- Mobile app — web-first approach, PWA works well
- User prediction submission — view-only platform
- Betting integration or odds comparison — regulatory/legal complexity
- Real-time live match prediction updates — post-kickoff is settled
- Player-level statistics — massive scope, not related to AI predictions core value
- Club news aggregation — content licensing issues
- Separate teams database table — text strings sufficient, avoid migration complexity
- Historical data beyond 2-3 seasons — diminishing returns
- Head-to-head model comparison for clubs — deferred to v3.x
- Best/worst matchup analysis — deferred to v3.x
- Model recommendation for upcoming matches — deferred to v3.x

## Context

Shipped v3.0 with ~240,000 LOC TypeScript.
Tech stack: Next.js 16, React 19, PostgreSQL, Redis, BullMQ, OpenRouter (single provider), Vitest, Zod, Radix UI, next-themes, isomorphic-dompurify, html-to-text, he, pino, Recharts, Drizzle ORM, TanStack Table.
All 288 requirements validated across v1.0 through v3.0 (15 milestones).
21 active models on OpenRouter. Provider attribution tracking for transparency.
164 teams mapped with slug resolution, alias support, and AI-generated content pipeline.
Per-model health dashboard with regression alerts operational.

## Constraints

**Technical:**
- All 21 models served via OpenRouter (single provider)
- PostgreSQL + Redis infrastructure already deployed
- Next.js 16 + React 19 + TypeScript stack (no framework changes)
- API-Football data source (contracted)
- Daily budget limit for paid model inference ($1-5 USD range)

**Operational:**
- Predictions must complete within 30-60 minute window before kickoff
- Live score updates must be within 60 seconds of real events
- Leaderboard must handle concurrent match settlements without race conditions
- System must gracefully degrade when models fail (not crash entire pipeline)
- Team content generation rate-limited to stay under OpenRouter API limits

**Business:**
- View-only platform (no user predictions or betting)
- Focus on model reliability and prediction coverage
- Maintain 17 league coverage (don't reduce scope)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| API-based LLM infrastructure | Cost-effective access to models without infrastructure overhead | Implemented via OpenRouter (single provider) |
| Exact score predictions (not 1X2) | More impressive benchmark, demonstrates reasoning capability | Current system predicts 2-1, 0-0, etc. |
| Kicktipp quota scoring | Rewards rare correct predictions, penalizes herd behavior | 2-6 points based on prediction rarity |
| 30-minute pre-kickoff prediction window | Lineups available, but close enough to match for relevant context | T-30m with T-5m retry fallback |
| Single OpenRouter provider | Simplified from multi-provider (Synthetic + Together + OpenRouter) to single provider | ✓ v2.9 — eliminated provider complexity |
| Per-model investigation | Different models fail for different reasons, need individual fixes | ✓ v2.8 — diagnosed and fixed per model |
| Keep 17 leagues | Already integrated, reducing scope would be regression | All leagues operational |
| Single-query team stats | 13 CASE WHEN in one SELECT eliminates N+1 queries | ✓ v3.0 — Phase 67 |
| Targeted team cache invalidation | Invalidate 2 teams per match instead of 200+ | ✓ v3.0 — Phase 67 |
| Team sitemap quality filter | Only teams with 5+ matches to avoid thin content penalties | ✓ v3.0 — Phase 68 |
| AI content pipeline with dual triggers | Event-driven (match settlement) + weekly cron for coverage | ✓ v3.0 — Phase 71 |
| Rate-limited BullMQ worker | 15 jobs/min to stay under OpenRouter API limits | ✓ v3.0 — Phase 71 |
| Anti-hallucination prompts | Stats-only context prevents LLM from fabricating player/manager names | ✓ v3.0 — Phase 71 |
| Reduce to 21 models | Cut expensive/underperforming models, cap reasoning tokens, reduce retries | ✓ quick-043 |

## Completed Milestones

v1.0, v1.1, v1.2, v1.3, v2.0, v2.1, v2.2, v2.3, v2.4, v2.5, v2.6, v2.7, v2.8, v2.9, v3.0 — see `.planning/MILESTONES.md` for full history.

---
*Last updated: 2026-02-12 after v3.0 milestone*
