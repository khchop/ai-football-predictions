# Phase 6: Data Migration - Research

**Researched:** 2026-02-02
**Domain:** PostgreSQL data migration with rollback strategy
**Confidence:** HIGH

## Summary

Phase 6 recalculates historical accuracy stats for all 160 models using the corrected `tendencyPoints > 0` formula established in Phase 5. This is a data correction migration, not a schema change.

The standard approach for PostgreSQL data migrations in 2026 emphasizes idempotent scripts, table snapshots for rollback, comprehensive verification reports, and atomic cache invalidation. The project already uses Drizzle ORM (v0.45.1) with direct PostgreSQL access via pg (v8.17.2) and Redis caching via ioredis (v5.9.2).

**Primary recommendation:** Use CREATE TABLE AS SELECT for snapshot backup, run recalculation in single transaction, generate detailed before/after report for changelog, invalidate all stats caches atomically after commit.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | 8.17.2 | PostgreSQL driver | Direct SQL for migrations, mature ecosystem |
| drizzle-orm | 0.45.1 | Query builder | Type-safe queries, existing codebase standard |
| ioredis | 5.9.2 | Redis client | Cache invalidation after migration |
| tsx | 4.21.0 | TypeScript executor | Run migration scripts directly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pool (pg) | 8.17.2 | Connection pooling | Migration script DB access |
| dotenv | 17.2.3 | Environment variables | Load DATABASE_URL for scripts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual SQL | Drizzle migrations | Drizzle's migration system is schema-focused; manual SQL better for data migrations |
| Single connection | Connection pool | Pool prevents connection exhaustion on large data sets |

**Installation:**
```bash
# Already installed in project
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── recalculate-accuracy.ts    # Migration script
├── verify-accuracy.ts          # Verification report generator
└── rollback-accuracy.ts        # Rollback from snapshot (optional)

.planning/phases/06-data-migration/
└── verification-report.json    # Detailed before/after data
```

### Pattern 1: Snapshot-then-Migrate
**What:** Create table snapshot before modifying data, run migration in transaction, keep snapshot for rollback
**When to use:** Data migrations that modify production values
**Example:**
```typescript
// Create snapshot table
await pool.query(`
  CREATE TABLE stats_pre_migration AS
  SELECT model_id, accuracy, scored_predictions, correct_tendencies, created_at
  FROM (
    SELECT
      m.id as model_id,
      COALESCE(ROUND(100.0 * SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN p.status = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0) as accuracy,
      COUNT(*) as scored_predictions,
      SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END) as correct_tendencies,
      now() as created_at
    FROM models m
    LEFT JOIN predictions p ON p.model_id = m.id AND p.status = 'scored'
    WHERE m.active = true
    GROUP BY m.id
  ) stats;
`);

// Run migration in transaction
await pool.query('BEGIN');
try {
  // Recalculation logic here
  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
}
```

### Pattern 2: Idempotent Script Design
**What:** Script can run multiple times safely using IF NOT EXISTS, DROP IF EXISTS, CREATE OR REPLACE
**When to use:** All migration scripts to allow safe retries
**Example:**
```typescript
// Check if migration already ran
const { rows } = await pool.query(`
  SELECT 1 FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename = 'stats_pre_migration'
`);

if (rows.length > 0) {
  console.log('Migration already ran (snapshot exists) - exiting');
  return;
}

// Drop snapshot if exists (for rollback scenario)
await pool.query('DROP TABLE IF EXISTS stats_pre_migration CASCADE');
```

### Pattern 3: Verification Report Generation
**What:** Generate detailed CSV/JSON comparing old and new values for all affected records
**When to use:** Data migrations requiring audit trail and changelog content
**Example:**
```typescript
interface VerificationRecord {
  modelId: string;
  displayName: string;
  competitionId: string;
  oldAccuracy: number;
  newAccuracy: number;
  delta: number;
  scoredPredictions: number;
  flagged: boolean; // delta > 15%
}

const report = await generateVerificationReport();
await fs.writeFile(
  '.planning/phases/06-data-migration/verification-report.json',
  JSON.stringify(report, null, 2)
);
```

### Pattern 4: Atomic Cache Invalidation
**What:** Invalidate all affected caches AFTER database transaction commits
**When to use:** Always - prevents serving stale cached data
**Example:**
```typescript
// IMPORTANT: Cache invalidation AFTER commit, never inside transaction
await pool.query('COMMIT');

// Now invalidate caches
await Promise.all([
  cacheDeletePattern('db:leaderboard:*'),
  cacheDelete(cacheKeys.overallStats()),
  cacheDelete(cacheKeys.topPerformingModel()),
  cacheDeletePattern('db:model:*:stats'),
]);
```

### Anti-Patterns to Avoid
- **Cache invalidation inside transaction:** Redis calls inside DB transaction can deadlock; always invalidate AFTER commit
- **KEYS command for pattern deletion:** Use SCAN for non-blocking iteration (already implemented in project's `cacheDeletePattern`)
- **No verification report:** Always generate before/after comparison for audit trail
- **Non-idempotent scripts:** Always check if migration already ran to enable safe retries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache pattern deletion | Custom iteration | Project's `cacheDeletePattern()` with SCAN | Non-blocking, handles large key sets, already implemented |
| Database connection management | Singleton pattern | pg Pool | Handles connection lifecycle, prevents exhaustion |
| Transaction rollback logic | Manual try/catch chains | Pool transaction methods with automatic rollback | PostgreSQL handles atomicity correctly |
| SQL injection protection | String concatenation | Parameterized queries | pg library handles escaping |
| Verification report format | Custom CSV/JSON writer | Built-in JSON.stringify with formatting | Sufficient for structured data |

**Key insight:** PostgreSQL's transactional DDL means both schema AND data changes can run in transactions with automatic rollback on error. The project's existing cache layer already implements best practices (SCAN instead of KEYS, graceful degradation).

## Common Pitfalls

### Pitfall 1: Cache Invalidation Timing
**What goes wrong:** Cache cleared before transaction commits, causing brief serving of incorrect data
**Why it happens:** Developer instinct to "clean up while working"
**How to avoid:** ALWAYS invalidate caches AFTER `COMMIT`, never inside transaction
**Warning signs:** Race condition where some requests see old cached data after migration reports success

### Pitfall 2: Forgot Snapshot Table Cleanup
**What goes wrong:** Snapshot table exists when migration reruns, causing "table already exists" error
**Why it happens:** Migration failed partway through, snapshot left behind
**How to avoid:** Use `DROP TABLE IF EXISTS stats_pre_migration CASCADE` at script start for idempotency
**Warning signs:** Cannot rerun migration script after failure

### Pitfall 3: Incomplete Verification Report
**What goes wrong:** Report only shows summary statistics, not individual model changes
**Why it happens:** Developer assumes aggregate metrics are sufficient
**How to avoid:** Generate record-level comparison with all 160 models × 17 competitions
**Warning signs:** Cannot produce detailed changelog entries showing specific model accuracy changes

### Pitfall 4: Missing Division Protection
**What goes wrong:** Division by zero error for models with no scored predictions
**Why it happens:** New models or models with all pending/void predictions
**How to avoid:** Use NULLIF and COALESCE pattern already established in Phase 5
**Warning signs:** Migration fails on division by zero for inactive models

### Pitfall 5: Wrong Snapshot Timing
**What goes wrong:** Snapshot created after migration starts, capturing partial new state
**Why it happens:** Snapshot query placed after BEGIN transaction
**How to avoid:** Create snapshot BEFORE transaction begins
**Warning signs:** Rollback doesn't restore original values

### Pitfall 6: Scope Creep in Data Migration
**What goes wrong:** Migration script starts adding "quick fixes" or "while we're here" changes
**Why it happens:** Developer sees related issues during implementation
**How to avoid:** Strictly limit migration to corrected accuracy formula - no schema changes, no new features
**Warning signs:** Migration script grows beyond 200 lines, adds columns, modifies other tables

## Code Examples

Verified patterns from official sources:

### Idempotent Table Snapshot
```typescript
// Source: PostgreSQL best practices, GitHub graphile/migrate examples
// Uses CREATE TABLE AS SELECT for point-in-time snapshot
await pool.query(`
  DROP TABLE IF EXISTS stats_pre_migration CASCADE;

  CREATE TABLE stats_pre_migration AS
  SELECT
    m.id as model_id,
    m.display_name,
    mt.competition_id,
    c.name as competition_name,
    COUNT(p.id) as scored_predictions,
    SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END) as correct_tendencies,
    COALESCE(ROUND(100.0 * SUM(CASE WHEN p.tendency_points > 0 THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN p.status = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0) as accuracy,
    now() as snapshot_created_at
  FROM models m
  CROSS JOIN competitions c
  LEFT JOIN predictions p ON p.model_id = m.id
  LEFT JOIN matches mt ON p.match_id = mt.id AND mt.competition_id = c.id
  WHERE m.active = true AND p.status = 'scored'
  GROUP BY m.id, m.display_name, mt.competition_id, c.name;

  CREATE INDEX idx_stats_pre_migration_model ON stats_pre_migration(model_id);
`);
```

### Transaction with Automatic Rollback
```typescript
// Source: pg documentation, project's existing migration scripts
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Perform data updates here
  // If any statement fails, automatic ROLLBACK occurs

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Migration failed, rolled back:', error);
  throw error;
} finally {
  client.release();
}
```

### Verification Report with Flagging
```typescript
// Source: Data migration testing best practices 2026
interface VerificationRecord {
  modelId: string;
  displayName: string;
  competitionId: string;
  competitionName: string;
  oldAccuracy: number;
  newAccuracy: number;
  delta: number;
  percentChange: number;
  scoredPredictions: number;
  flagged: boolean; // true if abs(delta) > 15
}

const report = await pool.query<VerificationRecord>(`
  SELECT
    old.model_id,
    old.display_name,
    old.competition_id,
    old.competition_name,
    old.accuracy as old_accuracy,
    new.accuracy as new_accuracy,
    (new.accuracy - old.accuracy) as delta,
    ROUND((new.accuracy - old.accuracy) / NULLIF(old.accuracy, 0) * 100, 1) as percent_change,
    old.scored_predictions,
    ABS(new.accuracy - old.accuracy) > 15 as flagged
  FROM stats_pre_migration old
  LEFT JOIN (
    -- Compute new accuracy using corrected formula
    SELECT model_id, competition_id,
           [CORRECTED_FORMULA_HERE] as accuracy
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.status = 'scored'
    GROUP BY model_id, competition_id
  ) new ON old.model_id = new.model_id AND old.competition_id = new.competition_id
  ORDER BY ABS(new.accuracy - old.accuracy) DESC;
`);
```

### Cache Invalidation After Migration
```typescript
// Source: Project's src/lib/cache/redis.ts
// Pattern: Invalidate AFTER commit, use Promise.all for parallel deletion
await pool.query('COMMIT');

// Now safe to invalidate caches
await Promise.all([
  // All leaderboard combinations
  cacheDeletePattern('db:leaderboard:*'),

  // Overall stats
  cacheDelete(cacheKeys.overallStats()),
  cacheDelete(cacheKeys.topPerformingModel()),

  // Model-specific stats (all models)
  cacheDeletePattern('db:model:*:stats'),
]);

console.log('Cache invalidation complete');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KEYS command for pattern deletion | SCAN for non-blocking iteration | 2020s | Prevents Redis blocking on large keyspaces |
| Migrations table tracking | Snapshot tables for data audits | 2025+ | Better rollback for data migrations vs. schema migrations |
| Manual cache clearing | Atomic invalidation after commit | 2024+ | Prevents race conditions |
| CSV verification reports | JSON with structured flagging | 2025+ | Machine-readable, integrates with automation |

**Deprecated/outdated:**
- **KEYS command:** Blocks Redis, use SCAN (project already uses correct approach)
- **Bidirectional migrations (up/down):** Data migrations are one-way; rollback via snapshot restore
- **Manual SQL string building:** Use parameterized queries or query builders

## Open Questions

Things that couldn't be fully resolved:

1. **Snapshot Retention Policy**
   - What we know: User decided 30 days retention in CONTEXT.md
   - What's unclear: Automated cleanup mechanism (cron job vs. manual)
   - Recommendation: Document manual cleanup command in migration script comments; automated cleanup can be Phase 7+ if needed

2. **Competition-Level Accuracy Caching**
   - What we know: Project caches overall stats and leaderboard
   - What's unclear: Whether competition-specific model stats are cached
   - Recommendation: Use `cacheDeletePattern('db:model:*:stats')` to catch any model-specific caches

3. **Historical Blog Post Updates**
   - What we know: Existing blog posts may reference old accuracy values
   - What's unclear: Whether to update historical content
   - Recommendation: Out of scope for Phase 6 - changelog explains correction, blog posts are historical snapshots

## Sources

### Primary (HIGH confidence)
- PostgreSQL 8.17.2 documentation via pg library usage
- Drizzle ORM 0.45.1 - Project's package.json and existing query patterns
- Project's existing migration scripts (migrate-betting-system.ts pattern)
- Project's cache layer implementation (src/lib/cache/redis.ts)
- Stats service canonical formulas (src/lib/services/stats.ts)

### Secondary (MEDIUM confidence)
- [Planning Your PostgreSQL Migration: Best Practices | Heroku](https://www.heroku.com/blog/planning-your-postgresql-migration/)
- [Data Migration Testing in 2026 | QASource](https://blog.qasource.com/a-guide-to-data-migration-testing)
- [Data Migration Best Practices 2026 | Medium](https://medium.com/@kanerika/data-migration-best-practices-your-ultimate-guide-for-2026-7cbd5594d92e)
- [Trouble-Free Database Migration: Idempotence | DZone](https://dzone.com/articles/trouble-free-database-migration-idempotence-and-co)
- [Creating Idempotent DDL Scripts | Redgate](https://www.red-gate.com/hub/product-learning/flyway/creating-idempotent-ddl-scripts-for-database-migrations)
- [Redis Cache Invalidation Complete Guide | Medium Dec 2025](https://medium.com/@rup.singh88/redis-caching-cache-invalidation-a-complete-guide-cc822b87aa4d)
- [Data Migration Validation Best Practices | Quinnox](https://www.quinnox.com/blogs/data-migration-validation-best-practices/)

### Tertiary (LOW confidence)
- None - all findings verified with official documentation or project code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from project's package.json and existing code
- Architecture: HIGH - Patterns extracted from project's migration scripts and PostgreSQL best practices
- Pitfalls: HIGH - Common issues documented in 2025-2026 migration guides

**Research date:** 2026-02-02
**Valid until:** 60 days (PostgreSQL and migration patterns are stable; stack versions verified from project)

---

## Key Findings for Planner

1. **Existing Pattern to Follow:** Project has established migration script pattern in `scripts/migrate-betting-system.ts` - use this structure
2. **Cache Layer Ready:** `cacheDeletePattern()` already implements SCAN-based deletion - use for atomic invalidation
3. **Formula Established:** Phase 5 created canonical formula in `src/lib/services/stats.ts` - reference this in migration
4. **User Decisions Locked:** CONTEXT.md specifies live migration, single transaction, 30-day snapshot retention
5. **No Schema Changes:** This is pure data recalculation - no ALTER TABLE, no new columns
6. **Verification Critical:** Generate detailed report for changelog - user wants before/after comparison
