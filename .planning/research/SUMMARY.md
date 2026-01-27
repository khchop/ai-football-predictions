# Research Summary

## Overview

Research completed for BettingSoccer v2: multi-granularity stats engine and automated match roundups with SEO optimization.

## Key Findings

### Stack (Continue Current Stack)

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Database | PostgreSQL + Drizzle ORM | Excellent aggregation queries, materialized views |
| Caching | Redis (current) | Add tiered keys by granularity |
| LLM | Together.ai (current) | Structured output, temperature 0.1-0.3 |
| Charts | Chart.js or Recharts | Lightweight, React-compatible |
| SEO | Next.js ISR + JSON-LD | Pre-render, structured data |

**High Confidence:** Database, caching, LLM, SEO
**Medium Confidence:** Charting libraries

### Features: Multi-Granularity Stats Engine

**Table Stakes (Must Build):**
- Overall leaderboard (total points, matches, win rate, avg points, form)
- Competition-level stats (same metrics, scoped)
- Club-level stats (performance against specific clubs)
- Basic filtering (season, date range, model, competition)

**Differentiators (Nice to Have):**
- Trend analysis (line charts, streaks)
- Advanced analytics (Elo ratings, opponent-adjusted)
- Head-to-head model comparisons
- Anomaly detection

### Features: Match Roundups

**Table Stakes (Must Build):**
- Match summary (score, events, model predictions)
- SEO metadata (title, description, OG tags, JSON-LD)
- Clean formatting with stats tables

**Differentiators (Nice to Have):**
- LLM narrative analysis
- Interactive elements (expandable details)
- Social sharing features
- Historical context

### Architecture

**Data Flow:**
```
Match Completed → Score Calculation → Stats Recalculation → 
Cache Invalidation → Materialized View Update → Content Generation → SEO Cache
```

**Key Patterns:**
- Hierarchical aggregation (overall → competition → club)
- Tiered Redis keys (`stats:{level}:{id}:{season}`)
- Transactional score updates (match + predictions + points)
- ISR for match roundup pages (60s revalidate)

## Watch Out For

| Pitfall | Prevention | Phase |
|---------|-----------|-------|
| Cache over-invalidation | Track affected levels only | 2 |
| N+1 queries | Single GROUP BY query | 1 |
| LLM hallucination | Structured data context, low temp | 4 |
| Prediction deadline | Validate generated_at vs start | Any |
| Data inconsistency | Transactional updates | Any |
| Duplicate content SEO | Unique elements per roundup | 5 |

## Dependencies

```
Stats Foundation (DB views, calculation)
    ↓
Stats API + Caching (multi-granularity query)
    ↓
Stats UI (leaderboards, charts)
    ↓
Content Pipeline (LLM generation)
    ↓
SEO + Publication (metadata, ISR)
```

**Can parallelize:** Stats API development with content pipeline data gathering.

## Confidence Summary

| Area | Confidence |
|------|------------|
| Stack choices | High |
| Feature requirements | High |
| Architecture pattern | High |
| Pitfall prevention | Medium |
| Effort estimation | Medium |

## Files

- `STACK.md` — Technology recommendations
- `FEATURES.md` — Feature categorization and complexity
- `ARCHITECTURE.md` — Detailed component design
- `PITFALLS.md` — Common mistakes and prevention

---
*Generated: 2026-01-27*
