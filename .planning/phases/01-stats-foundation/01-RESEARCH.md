# Phase 1 Research: Stats Foundation

## Overview

Research for implementing Phase 1: Database schema, materialized views, and points calculation service.

## Standard Stack

**Database: PostgreSQL with Drizzle ORM** (current stack, continue)

- Drizzle supports materialized views via raw SQL
- Use `CREATE MATERIALIZED VIEW` and `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Index support on materialized views

**Key Drizzle patterns:**
```typescript
// Creating materialized view via raw SQL
await db.execute(sql`
  CREATE MATERIALIZED VIEW mv_model_stats_overall AS
  SELECT
    p.model_id,
    COUNT(*) as total_matches,
    SUM(CASE WHEN m.home_goals = p.home_goals AND m.away_goals = p.away_goals THEN 10
             WHEN (m.home_goals > m.away_goals AND p.home_goals > p.away_goals) OR
                  (m.home_goals < m.away_goals AND p.home_goals < p.away_goals) THEN 2
             ELSE 0 END) as total_points,
    AVG(CASE WHEN m.home_goals = p.home_goals AND m.away_goals = p.away_goals THEN 10
             WHEN (m.home_goals > m.away_goals AND p.home_goals > p.away_goals) OR
                  (m.home_goals < m.away_goals AND p.home_goals < p.away_goals) THEN 2
             ELSE 0 END) as avg_points
  FROM predictions p
  JOIN matches m ON p.match_id = m.id
  WHERE m.status = 'finished'
  GROUP BY p.model_id
`);

// Refresh with CONCURRENTLY (no locks)
await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_overall`);
```

**Job Queue: BullMQ** (current stack, continue)

- Worker-based refresh triggers
- Concurrent job handling
- Retry/backoff support

## Architecture Patterns

### Materialized View Hierarchy

```
predictions (source)
    │
    ├── mv_model_stats_overall ──▶ Global leaderboard
    │
    ├── mv_model_stats_competition ──▶ Competition filter
    │       │
    │       └── Indexed by (competition_id, season)
    │
    └── mv_model_stats_club ──▶ Club filter
            │
            └── Indexed by (club_id, season)
```

### Points Calculation Pipeline

```
Match Completed
    │
    ▼
BullMQ Job: recalculate-stats
    │
    ├── 1. Update match scores ( ├── 2.if needed)
    Calculate tendency rarity per prediction
    ├── 3. Award points (tendency + diff bonus + exact bonus)
    ├── 4. Refresh materialized views
    └── 5. Invalidate cache (Phase 2)
```

### View Refresh Strategy

**Automatic refresh on worker:**
```typescript
// Worker handler
worker.processJob(async (job) => {
  await calculatePointsForMatch(job.data.matchId);
  await refreshMaterializedViews();
});

async function refreshMaterializedViews() {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_overall`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_competition`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats_club`);
}
```

**Performance optimization:**
- CONCURRENTLY allows reads during refresh
- Each view ~100-500ms to refresh
- Run in parallel if possible

## Don't Hand-Roll

**1. Points Calculation Logic**

The Kicktipp system has specific rules:
- Tendency: 2-6 points based on rarity
- Goal difference: +1 if correct
- Exact score: +3 if correct
- Maximum: 10 points

**2. Materialized View Refresh**

PostgreSQL handles concurrent refresh. Don't build custom cache invalidation for views.

**3. Rarity Calculation**

Use window functions for accurate counts:
```sql
SELECT
  p.*,
  CASE
    WHEN p.home_goals = m.home_goals AND p.away_goals = m.away_goals THEN 10
    WHEN (m.home_goals > m.away_goals AND p.home_goals > p.away_goals) OR
         (m.home_goals < m.away_goals AND p.home_goals < p.away_goals) THEN
      -- Tendency points based on rarity
      CASE
        WHEN rarity >= 0.5 THEN 2
        WHEN rarity >= 0.25 THEN 4
        ELSE 6
      END
    ELSE 0
  END as tendency_points,
  CASE WHEN p.home_goals - p.away_goals = m.home_goals - m.away_goals THEN 1 ELSE 0 END as goal_diff_correct,
  CASE WHEN p.home_goals = m.home_goals AND p.away_goals = m.away_goals THEN 3 ELSE 0 END as exact_bonus
FROM predictions p
JOIN matches m ON p.match_id = m.id
```

## Common Pitfalls

### Pitfall 1: Race Conditions on Points

**Problem:** Two predictions update simultaneously, rarity counts wrong.

**Solution:** Use transaction with `SERIALIZABLE` isolation or row locking:
```typescript
await db.transaction(async (tx) => {
  // Lock all predictions for this match
  await tx.execute(sql`
    SELECT * FROM predictions
    WHERE match_id = $matchId
    FOR UPDATE
  `);

  // Calculate and update points
  await calculatePoints(tx, matchId);
});
```

### Pitfall 2: Materialized View Deadlocks

**Problem:** Refresh blocks writes, or vice versa.

**Solution:** Use `CONCURRENTLY` flag:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_stats;
```

Note: Requires a unique index on the view.

### Pitfall 3: Stale Stats After Deletions

**Problem:** Deleted models or matches leave orphan data.

**Solution:**
- Add foreign key constraints
- Use `WITH NO DATA` for empty refreshes
- Periodic cleanup job

### Pitfall 4: Performance on Large Datasets

**Problem:** Views slow with many seasons/models.

**Solution:**
- Filter by season (current only in Phase 1)
- Use incremental refresh instead of full rebuild
- Partition by date if needed later

## Code Examples

### Drizzle Schema for Materialized Views

```typescript
// db/schema/stats.ts
import { pgTable, serial, integer, decimal, timestamp, text } from 'drizzle-orm/pg-core';

// Materialized views don't have standard Drizzle schema
// Use raw SQL for DDL, reference via queries

// Helper to query stats
export async function getOverallStats(db: Database) {
  return db.execute(sql`
    SELECT
      model_id,
      total_matches,
      total_points,
      ROUND(avg_points::numeric, 2) as avg_points,
      ROUND(win_rate::numeric, 2) as win_rate
    FROM mv_model_stats_overall
    ORDER BY total_points DESC
  `);
}

export async function getCompetitionStats(db: Database, competitionId: string) {
  return db.execute(sql`
    SELECT
      model_id,
      total_matches,
      total_points,
      ROUND(avg_points::numeric, 2) as avg_points
    FROM mv_model_stats_competition
    WHERE competition_id = ${competitionId}
    ORDER BY total_points DESC
  `);
}
```

### BullMQ Worker for Stats Refresh

```typescript
// queue/workers/stats.worker.ts
import { Worker } from 'bullmq';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { refreshAllStatsViews } from '@/lib/db/stats';

export const statsWorker = new Worker(
  'stats-recalculate',
  async (job) => {
    const db = getDb();

    try {
      // Recalculate points for all predictions in this match
      await recalculateMatchPoints(db, job.data.matchId);

      // Refresh materialized views
      await refreshAllStatsViews(db);

      return { success: true };
    } catch (error) {
      console.error('Stats recalculation failed:', error);
      throw error;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  }
);

async function refreshAllStatsViews(db: Database) {
  const views = [
    'mv_model_stats_overall',
    'mv_model_stats_competition',
    'mv_model_stats_club',
  ];

  await Promise.all(
    views.map((view) =>
      db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${sql.identifier(view)}`)
    )
  );
}
```

### Points Calculation Service

```typescript
// lib/stats/points.ts
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { matches, predictions, models } from '@/lib/db/schema';

export async function calculatePointsForMatch(matchId: string) {
  const db = getDb();

  // Get all predictions for this match
  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));

  // Get match result
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match || match.status !== 'finished') {
    throw new Error('Match not completed');
  }

  // Calculate tendency counts for rarity
  const tendencyCounts = {
    home_win: matchPredictions.filter(p => p.homeGoals > p.awayGoals).length,
    draw: matchPredictions.filter(p => p.homeGoals === p.awayGoals).length,
    away_win: matchPredictions.filter(p => p.homeGoals < p.awayGoals).length,
  };

  const totalModels = matchPredictions.length;

  // Update each prediction with calculated points
  for (const pred of matchPredictions) {
    let points = 0;
    const tendency = pred.homeGoals > pred.awayGoals ? 'home_win' :
                     pred.homeGoals === pred.awayGoals ? 'draw' : 'away_win';

    // Tendency points based on rarity
    const rarity = tendencyCounts[tendency] / totalModels;
    if (rarity >= 0.5) points += 2;
    else if (rarity >= 0.25) points += 4;
    else points += 6;

    // Goal difference bonus
    const predDiff = pred.homeGoals - pred.awayGoals;
    const actualDiff = match.homeGoals - match.awayGoals;
    if (predDiff === actualDiff) points += 1;

    // Exact score bonus
    if (pred.homeGoals === match.homeGoals && pred.awayGoals === match.awayGoals) {
      points += 3;
    }

    // Update prediction
    await db
      .update(predictions)
      .set({
        points,
        tendencyCorrect: pred.homeGoals > pred.awayGoals === match.homeGoals > match.awayGoals ||
                         pred.homeGoals === pred.awayGoals === match.homeGoals === match.awayGoals,
        goalDiffCorrect: predDiff === actualDiff,
        exactScore: pred.homeGoals === match.homeGoals && pred.awayGoals === match.awayGoals,
        updatedAt: new Date(),
      })
      .where(eq(predictions.id, pred.id));
  }
}
```

### Recent Form Query

```typescript
export async function getRecentForm(modelId: string, limit: number = 10) {
  const db = getDb();

  return await db.execute(sql`
    SELECT
      m.id as match_id,
      m.home_team_id,
      m.away_team_id,
      m.home_goals,
      m.away_goals,
      p.home_goals as pred_home,
      p.away_goals as pred_away,
      p.points,
      m.date as match_date
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.model_id = ${modelId}
      AND m.status = 'finished'
    ORDER BY m.date DESC
    LIMIT ${limit}
  `);
}
```

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| PostgreSQL materialized views | High | Well-established pattern |
| Drizzle ORM support | High | Via raw SQL |
| BullMQ worker | High | Current stack |
| Rarity calculation | Medium | New logic, needs testing |
| Concurrent refresh | High | Standard PostgreSQL |
| Performance (<100ms) | Medium | Depends on data volume |

## Open Questions

1. **Unique index requirement:** Materialized views with CONCURRENTLY need a unique index. What column(s) to use?
   - For `mv_model_stats_overall`: `(model_id)` is unique
   - For `mv_model_stats_competition`: `(model_id, competition_id)` is unique
   - For `mv_model_stats_club`: `(model_id, club_id)` is unique

2. **Season identification:** How to determine "current season"?
   - Add `seasons` table with `is_current` flag
   - Or calculate from current date

3. **View refresh timing:** Before or after points calculation?
   - Recommended: Calculate points first, then refresh views

---
*Research completed: 2026-01-27*
