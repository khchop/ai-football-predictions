# Roadmap

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | ~~Stats Foundation~~ ✅ | Database schema, views, and calculation service | STATS-01 through STATS-05 | 4 criteria |
| 2 | ~~Stats API + Caching~~ ✅ | Multi-granularity query API with Redis caching | STATS-06 through STATS-14 | 4 criteria |
| 3 | ~~Stats UI~~ ✅ | VERIFIED | Leaderboard pages with filtering and sorting | STATS-01 through STATS-14 | 4 criteria |
| 4 | ~~Content Pipeline~~ ✅ | LLM-powered match roundups on completion | CONT-01 through CONT-05 | 4 criteria |
| 5 | ~~SEO + Publication~~ ✅ | VERIFIED | Dynamic metadata, OG images, ISR pages | SEO-01 through SEO-04 | 4 criteria |

**Total: 5 phases | 23 requirements | All requirements mapped | Phase 5 VERIFIED**

---

## Phases

### Phase 1: Stats Foundation

**Goal:** Database schema extensions, materialized views, and points calculation service for model performance tracking.

**Requirements:**
- Database: Create materialized views for aggregated stats (overall, competition, club)
- Database: Add composite indexes for performance (competition_id, season, model_id)
- **STATS-01**: Model ranking by total points (database query ready)
- **STATS-02**: Total matches predicted per model
- **STATS-03**: Win rate percentage (correct tendency)
- **STATS-04**: Average points per match
- **STATS-05**: Recent form (last 10 matches)

**Success Criteria:**
1. Materialized views refresh automatically when matches complete
2. Database queries return correct stats for any model
3. Points calculation follows Kicktipp system (2-6 tendency, +1 diff, +3 exact)
4. Performance: queries complete in <100ms for all granularity levels

---

### Phase 2: Stats API + Caching

**Goal:** REST API endpoints for multi-granularity stats with Redis caching layer.

**Requirements:**
- **STATS-06**: Competition-scoped leaderboards
- **STATS-07**: Competition vs overall performance comparison
- **STATS-08**: Filter by season/competition
- **STATS-09**: Performance against specific clubs
- **STATS-10**: Home vs away performance per club
- **STATS-11**: Filter by club
- **STATS-12**: Date range filtering
- **STATS-13**: Model filtering
- API: Redis caching with tiered keys (stats:{level}:{id}:{season})
- API: Cache invalidation on match completion

**Success Criteria:**
1. API returns consistent structure across all granularity levels
2. Redis cache reduces database load by 80%+
3. Cache invalidation works correctly (overall -> competition -> club)
4. All filter combinations work (season, competition, club, model, date range)

**Plans:**
- [x] 02-01-PLAN.md — Shared utilities (types, cache, response, auth)
- [x] 02-02-PLAN.md — API route handlers (5 endpoints)
- [x] 02-03-PLAN.md — Cache invalidation integration
- [x] 02-04-PLAN.md — Gap closure: wire competition/club filters to getLeaderboard

---

### Phase 3: Stats UI

**Goal:** Leaderboard pages with sortable tables, filtering UI, and responsive design.

**Requirements:**
- **STATS-14**: Sortable table UI (using tanstack-table or similar)
- Page: Overall leaderboard with all metrics
- Page: Competition-specific leaderboards
- Page: Club-specific model performance
- Filter component: Season selector
- Filter component: Competition selector
- Filter component: Club selector
- Filter component: Model selector
- Filter component: Date range picker

**Success Criteria:**
1. All stats visible in clean, sortable tables
2. Filters update results without page reload
3. Mobile-responsive design
4. Page load time <2s with cached data

**Plans:** 5 plans
- [x] 03-01-PLAN.md — TanStack Table integration and column definitions
- [x] 03-02-PLAN.md — Competition and club leaderboard pages
- [x] 03-03-PLAN.md — Comparison modal and skeleton loading states
- [x] 03-04-PLAN.md — Gap closure: Add season and model selectors
- [x] 03-05-PLAN.md — Gap closure: Fix main leaderboard API bypass (INT-01)

---

### Phase 4: Content Pipeline

**Goal:** Automated match roundup generation triggered on match completion.

**Requirements:**
- **CONT-01**: Match summary with score and key events
- **CONT-02**: Model prediction accuracy per match
- **CONT-03**: Top performer models for match
- **CONT-04**: LLM-generated narrative analysis
- **CONT-05**: Trigger on match completion (BullMQ job)
- Data gathering: Fetch match data + all predictions
- Template: Match roundup markdown template
- LLM: Prompt engineering for structured output

**Success Criteria:**
1. Roundup generated within 60 seconds of match completion
2. All model predictions accurately displayed
3. LLM narrative is factual (no hallucinations)
4. Content includes unique elements (not duplicate)

**Plans:** 5 plans
- [x] 04-01-PLAN.md — BullMQ content queue setup + trigger integration
- [x] 04-02-PLAN.md — LLM content generation service with prompt engineering
- [x] 04-03-PLAN.md — Content storage + similarity detection
- [x] 04-04-PLAN.md — Match page integration with HTML rendering
- [x] 04-05-PLAN.md — Gap closure: Trigger roundup after stats calculation (INT-02)

---

### Phase 5: SEO + Publication

**Goal:** Dynamic SEO metadata, Open Graph images, and ISR pages for discoverability.

**Requirements:**
- **SEO-01**: Dynamic meta titles/descriptions
- **SEO-02**: Open Graph tags and images
- **SEO-03**: JSON-LD structured data (SportsEvent schema)
- **SEO-04**: ISR page generation with 60s revalidate
- Page: /matches/{id} with full roundup
- Page: /matches/{id}/stats with detailed breakdown
- Sitemap: Auto-generate for all match pages

**Success Criteria:**
1. Each match page has unique meta title/description
2. Open Graph images display score + top model
3. JSON-LD validates (use schema.org validator)
4. Pages indexed by search engines

**Plans:** 3 plans
- [x] 05-01-PLAN.md — SEO utilities (constants, types, metadata builders, schema builders, OG templates)
- [x] 05-02-PLAN.md — Match page SEO (metadata, OG image, JSON-LD)
- [x] 05-03-PLAN.md — Stats page SEO + sitemap + robots.txt

---

## Phase Dependencies

```
Phase 1 (Foundation) -------> Phase 2 (API) -------> Phase 3 (UI)
        |                         |
        |                         v
        |                 Phase 4 (Content Pipeline)
        |                         |
        v                         v
Phase 5 (SEO + Publication) <-----'
```

**Parallelization opportunity:** Phase 2 (API) and Phase 4 (Content) can run in parallel after Phase 1.

---

## Requirement Mapping

| Phase | Requirements |
|-------|--------------|
| 1 | STATS-01, STATS-02, STATS-03, STATS-04, STATS-05 + DB views/indexes |
| 2 | STATS-06, STATS-07, STATS-08, STATS-09, STATS-10, STATS-11, STATS-12, STATS-13 + API + Caching |
| 3 | STATS-14 + Pages + Filters (all STATS requirements complete) |
| 4 | CONT-01, CONT-02, CONT-03, CONT-04, CONT-05 |
| 5 | SEO-01, SEO-02, SEO-03, SEO-04 |

---
*Created: 2026-01-27 | Phase 5 context: 2026-01-27*
