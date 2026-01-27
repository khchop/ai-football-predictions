# Phase 1 Context

## Overview

Phase 1: Stats Foundation — Database schema, materialized views, and points calculation service.

## Decisions

### Data Freshness

**Decision:** Stats update immediately on match completion via BullMQ worker (within 1 hour).

**Details:**
- Match completion → score update → trigger worker
- Worker recalculates affected stats
- Automatic materialized view refresh
- No scheduled batch updates

**Implications for downstream:**
- View refresh must be fast (use CONCURRENTLY)
- Worker must handle concurrent matches
- Fallback: manual refresh if worker fails

### Historical Scope

**Decision:** Stats tracked for current season only.

**Details:**
- Active season filter by default
- No all-time aggregations in Phase 1
- Archive previous seasons if needed later

**Implications for downstream:**
- Filter all queries by `season = current_season`
- Store season in materialized views
- No need for season dimension in initial schema

### Recent Form Logic

**Decision:** Show available matches only. If model has fewer than 10 matches, show actual count.

**Details:**
- "Last 10 matches" means up to 10
- Calculate based on completed matches only
- Display count alongside form metric

**Implications for downstream:**
- Query: ORDER BY match_date DESC LIMIT COALESCE(10, total_matches)
- Handle NULL/zero cases gracefully
- UI shows "Last X matches" where X = min(10, actual)

### Tendency Rarity Scoring

**Decision:** Points based on prediction rarity. More models predicting the same outcome = lower points (2). Few models = higher points (6).

**Details:**
- Calculate rarity per prediction opportunity
- Count models with same tendency (home win, draw, away win)
- Scale: 2 points (common) → 6 points (rare)
- Requires: Recalculate for historical accuracy as models evolve

**Calculation formula (per match):**
```sql
-- Count tendencies across all models for this match
SELECT
  tendency,
  COUNT(*) as model_count,
  -- Assign points: more models = fewer points
  CASE
    WHEN COUNT(*) >= (SELECT COUNT(*) FROM models) * 0.5 THEN 2  -- common
    WHEN COUNT(*) >= (SELECT COUNT(*) FROM models) * 0.25 THEN 4  -- uncommon
    ELSE 6  -- rare
  END as tendency_points
FROM predictions
WHERE match_id = $match_id
GROUP BY tendency
```

**Recalculation strategy:**
- Points recalculated on every match update (current season only)
- Historical points adjust as model landscape changes
- No retroactive recalculation for past seasons

**Implications for downstream:**
- Points are not fixed at prediction time
- Final score depends on what other models predicted
- Display: "Tendency Points: 2-6 (based on rarity)"
- Race condition: handle concurrent prediction updates

## Scope Boundary

**In Scope (Phase 1):**
- Materialized views for current season
- Points calculation with rarity scoring
- Recent form (up to 10 matches)
- View refresh on match completion

**Deferred (Future Phases):**
- All-time/historical stats
- Trend analysis charts
- Model comparison features
- Anomaly detection

## Technical Notes

- **Views:** `mv_model_stats_overall`, `mv_model_stats_competition`, `mv_model_stats_club`
- **Indexes:** Composite on `(competition_id, season, model_id)` and `(club_id, season, model_id)`
- **Refresh:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` triggered by worker
- **Performance:** Target <100ms for stats queries

---
*Created: 2026-01-27 after discussion*
