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

**Brownfield project with existing codebase.** The platform is operational with 17 leagues integrated, 35 LLM models connected via Together AI, and a complete match lifecycle pipeline. However, it currently has multiple categories of bugs and errors requiring stabilization before new feature development.

### Existing Validated Features

The following capabilities are already built and (when working correctly) validated:

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

### Known Issues

**Critical Bugs:**
- Prediction pipeline failures (JSON parse errors, API timeouts not recovering gracefully)
- Model auto-disable logic triggering prematurely or not resetting after recovery
- Queue worker crashes on edge cases (missing match data, malformed API responses)
- Database connection pool exhaustion under load

**Data/Accuracy Issues:**
- Leaderboard calculations occasionally showing incorrect totals
- Streak tracking not properly handling edge cases (draws, voided matches)
- Cache invalidation delays causing stale data display
- Quota point calculation discrepancies on high-traffic match days

**UI/UX Problems:**
- Slow page loads on match detail pages with 35+ predictions
- Leaderboard not updating in real-time (requires manual refresh)
- Mobile responsiveness issues on prediction cards
- Error boundaries not catching all React rendering failures

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

## Open Questions

- Which specific matches or dates show the worst bug occurrences? (need logs)
- Are certain models failing more than others? (need failure analysis)
- What's the priority order: critical bugs → data issues → UI fixes?

---
*Last updated: 2026-01-31 after initialization*
