# Phase 63: Model Consolidation Execution - Research

**Researched:** 2026-02-08
**Domain:** Database migration execution, code consolidation, cache invalidation
**Confidence:** HIGH

## Summary

Phase 63 executes the model consolidation migration built in Phase 62. This is NOT about writing new migration logic—it's about safely running existing scripts (`migrate-consolidate-models.ts` and `rollback-consolidate-models.ts`) in production, then updating application code to reflect the consolidated model structure.

The migration consolidates 3 Synthetic model IDs that exist in both providers (deepseek-r1-0528-syn, kimi-k2-thinking-syn, kimi-k2.5-syn) into their base routing IDs. The remaining 10 Synthetic-only models keep their -syn suffix.

**Primary recommendation:** Execute migration with dry-run first, validate output, run production migration, update code references (MODEL_PROVIDER_ROUTES, provider definitions), invalidate all model-keyed caches, trigger leaderboard recalculation, and verify zero orphaned FKs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current | Database queries | Already in use, provides type-safe schema access |
| tsx | Current | Script execution | Already in use for all migration scripts |
| PostgreSQL | Current | Database | Already in use, native transaction support |
| ioredis | Current | Cache invalidation | Already in use for Redis operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | Current | Environment config | Script execution outside Next.js |
| Node pg driver | (via Drizzle) | Direct SQL execution | For complex queries Drizzle doesn't support |

**Installation:**
N/A - All dependencies already installed

## Architecture Patterns

### Recommended Execution Flow
```
Phase 63 Execution:
1. Pre-Migration Validation
   ├── Dry-run forward migration (see impact)
   ├── Verify zero unexpected conflicts
   └── Document row counts (before state)

2. Execute Forward Migration
   ├── Run migrate-consolidate-models.ts (production)
   ├── Capture migration output logs
   └── Verify post-migration validation passes

3. Code Consolidation
   ├── Update MODEL_PROVIDER_ROUTES (remove -syn from 3 models)
   ├── Update SYNTHETIC_PROVIDERS (remove 3 consolidated provider definitions)
   ├── Update ALL_PROVIDERS count expectations
   └── Run validation tests

4. Cache Invalidation
   ├── Invalidate all model-keyed caches
   ├── Invalidate leaderboard caches (all filters)
   └── Invalidate stats caches

5. Leaderboard Recalculation
   ├── Trigger recalculation job
   └── Verify aggregates match historical totals

6. Post-Migration Verification
   ├── Query orphaned FKs (should be 0)
   ├── Verify referential integrity
   └── Compare before/after row counts
```

### Pattern 1: Safe Migration Execution
**What:** Multi-stage migration with validation at each step
**When to use:** Any production database migration
**Example:**
```bash
# 1. Dry-run to preview changes
npx tsx scripts/migrate-consolidate-models.ts --dry-run --verbose

# 2. Capture before state
psql $DATABASE_URL -c "SELECT COUNT(*) FROM predictions WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn');"

# 3. Execute migration
npx tsx scripts/migrate-consolidate-models.ts --verbose 2>&1 | tee migration-$(date +%Y%m%d-%H%M%S).log

# 4. Verify after state
psql $DATABASE_URL -c "SELECT COUNT(*) FROM predictions WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn');"  # Should be 0
```

### Pattern 2: Code Reference Updates
**What:** Update all references to consolidated model IDs
**When to use:** After migration script completes successfully
**Example:**
```typescript
// BEFORE (Phase 62 state):
export const MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  'deepseek-r1': ['deepseek-r1-0528-syn', 'deepseek-r1', 'deepseek-r1-or'],
  'kimi-k2-thinking': ['kimi-k2-thinking-syn', 'kimi-k2-instruct'],
  'kimi-k2.5': ['kimi-k2.5-syn', 'kimi-k2-instruct'],
};

// AFTER (Phase 63 state):
export const MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  'deepseek-r1': ['deepseek-r1', 'deepseek-r1-or'],  // Synthetic provider removed
  'kimi-k2-thinking': ['kimi-k2-instruct'],  // Synthetic provider removed
  'kimi-k2.5': ['kimi-k2-instruct'],  // Synthetic provider removed
};

// SYNTHETIC_PROVIDERS array: Remove 3 consolidated providers
// Keep only the 10 Synthetic-exclusive models
```

### Pattern 3: Cache Invalidation Strategy
**What:** Comprehensive cache invalidation after structural changes
**When to use:** After any migration that changes model IDs
**Example:**
```typescript
// From src/lib/cache/redis.ts patterns
import { cacheDeletePattern, cacheDelete, cacheKeys } from '@/lib/cache/redis';

await Promise.all([
  // All leaderboard caches (various filter combinations)
  cacheDeletePattern('db:leaderboard:*'),

  // All model-specific caches
  cacheDeletePattern('db:model:*:stats'),
  cacheDeletePattern('db:models:*'),

  // Stats caches
  cacheDelete(cacheKeys.overallStats()),
  cacheDelete(cacheKeys.topPerformingModel()),
  cacheDelete(cacheKeys.activeModels()),
  cacheDelete(cacheKeys.activeModelCount()),

  // All match prediction caches (may reference old model IDs)
  cacheDeletePattern('db:predictions:*'),
]);
```

### Anti-Patterns to Avoid
- **Skipping dry-run:** Always run dry-run first to see exact impact
- **Code updates before migration:** Update code AFTER database migration completes
- **Partial cache invalidation:** Invalidate ALL model-related caches, not just some
- **No before/after comparison:** Always capture row counts before migration for verification

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration deduplication logic | Custom duplicate detection | Existing migrate-consolidate-models.ts | Already handles all 5 FK tables, tested, validated |
| Cache key pattern matching | Manual key enumeration | cacheDeletePattern with SCAN | Non-blocking, handles large keyspaces, already implemented |
| Referential integrity checks | Custom FK validation | PostgreSQL's built-in constraint validation + migration's postValidate | Database enforces integrity, migration validates post-transaction |
| Transaction rollback | Manual state tracking | PostgreSQL transaction + deferred constraints | Database handles atomicity, migration uses SET CONSTRAINTS ALL DEFERRED |

**Key insight:** Phase 62 already built comprehensive migration scripts with deduplication, validation, and rollback. Phase 63's job is EXECUTION and CODE UPDATES, not reimplementing migration logic.

## Common Pitfalls

### Pitfall 1: Running Migration Without Dry-Run
**What goes wrong:** Unexpected data changes, no preview of impact
**Why it happens:** Eagerness to complete migration quickly
**How to avoid:** ALWAYS run with --dry-run first, review output, compare expected vs actual affected rows
**Warning signs:** Migration output shows unexpected row counts, conflicts appear that weren't anticipated

### Pitfall 2: Updating Code Before Database Migration
**What goes wrong:** Application references model IDs that don't exist yet, or references old IDs that are being migrated
**Why it happens:** Confusion about execution order
**How to avoid:** Database first, code second. Migration script updates database, THEN update MODEL_PROVIDER_ROUTES and provider definitions
**Warning signs:** API errors referencing "model not found", prediction workers failing with FK violations

### Pitfall 3: Incomplete Cache Invalidation
**What goes wrong:** Cached data references old model IDs, stale leaderboard results, wrong model counts
**Why it happens:** Not knowing all cache keys that reference model IDs
**How to avoid:** Use cacheDeletePattern with broad patterns (db:leaderboard:*, db:model:*, db:predictions:*), invalidate ALL stats caches
**Warning signs:** Leaderboard shows duplicate models, model count incorrect, prediction caches return 404

### Pitfall 4: Not Verifying Referential Integrity Post-Migration
**What goes wrong:** Orphaned foreign keys create data integrity issues, queries fail
**Why it happens:** Assuming migration script validation is enough
**How to avoid:** Run explicit queries to check for orphaned FKs: `SELECT COUNT(*) FROM predictions p WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id = p.model_id);`
**Warning signs:** Application errors referencing "FK constraint violation", admin dashboard shows models with 0 predictions but data exists

### Pitfall 5: Forgetting to Recalculate Leaderboard Aggregates
**What goes wrong:** Leaderboard totals don't match historical data after consolidation
**Why it happens:** Aggregates store pre-consolidation data, not auto-updated by FK changes
**How to avoid:** Trigger leaderboard recalculation job after migration (if exists), or invalidate all leaderboard caches to force fresh calculation
**Warning signs:** Leaderboard accuracy percentages inconsistent, model rankings incorrect after consolidation

## Code Examples

Verified patterns from existing codebase:

### Migration Execution Script Pattern
```bash
# Source: scripts/migrate-consolidate-models.ts (Phase 62)
# Standard execution flow for production

# Step 1: Dry-run with verbose output
npx tsx scripts/migrate-consolidate-models.ts --dry-run --verbose

# Step 2: Review dry-run output
# Verify:
# - Affected row counts match expectations
# - No unexpected conflicts detected
# - Pre-validation shows correct totals

# Step 3: Execute migration with logging
npx tsx scripts/migrate-consolidate-models.ts --verbose 2>&1 | tee logs/migration-consolidate-$(date +%Y%m%d-%H%M%S).log

# Step 4: Verify success
# Check for "✅ Migration committed successfully" in output
# Verify post-validation shows 0 orphaned FKs, 0 unique violations
```

### Cache Invalidation Pattern
```typescript
// Source: src/lib/cache/redis.ts (existing invalidateModelCountCaches pattern)
import { cacheDeletePattern, cacheDelete, cacheKeys } from '@/lib/cache/redis';
import { loggers } from '@/lib/logger/modules';

export async function invalidateModelConsolidationCaches(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    loggers.cache.warn('Redis not available - skipping cache invalidation');
    return;
  }

  try {
    await Promise.all([
      // All model-related caches
      cacheDelete(cacheKeys.activeModels()),
      cacheDelete(cacheKeys.activeModelCount()),
      cacheDelete(cacheKeys.topPerformingModel()),
      cacheDelete(cacheKeys.allModelHealth()),

      // All leaderboard caches (include model names/IDs)
      cacheDeletePattern('db:leaderboard:*'),

      // All stats caches
      cacheDelete(cacheKeys.overallStats()),
      cacheDeletePattern('db:stats:*'),

      // All model-specific stat caches
      cacheDeletePattern('db:model:*:stats'),

      // All prediction caches (may reference old model IDs in keys)
      cacheDeletePattern('db:predictions:*'),
    ]);

    loggers.cache.info('Invalidated all model consolidation caches');
  } catch (error) {
    loggers.cache.error({
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to invalidate model consolidation caches');
    throw error;
  }
}
```

### Post-Migration Verification Queries
```sql
-- Source: Derived from migrate-consolidate-models.ts postValidate function
-- Run these queries after migration to verify data integrity

-- 1. Check for orphaned FKs in predictions table
SELECT COUNT(*) as orphaned_predictions
FROM predictions p
WHERE NOT EXISTS (
  SELECT 1 FROM models m WHERE m.id = p.model_id
);
-- Expected: 0

-- 2. Check for orphaned FKs in llm_model_stats table
SELECT COUNT(*) as orphaned_stats
FROM llm_model_stats s
WHERE NOT EXISTS (
  SELECT 1 FROM models m WHERE m.id = s.model_id
);
-- Expected: 0

-- 3. Verify old model IDs no longer exist in predictions
SELECT COUNT(*) as old_model_predictions
FROM predictions
WHERE model_id IN ('deepseek-r1-0528-syn', 'kimi-k2-thinking-syn', 'kimi-k2.5-syn');
-- Expected: 0 (all consolidated to base IDs)

-- 4. Verify consolidated model IDs exist
SELECT COUNT(*) as consolidated_predictions
FROM predictions
WHERE model_id IN ('deepseek-r1', 'kimi-k2-thinking', 'kimi-k2.5');
-- Expected: > 0 (sum of old + new predictions)

-- 5. Check for unique constraint violations
SELECT match_id, model_id, COUNT(*) as duplicate_count
FROM predictions
GROUP BY match_id, model_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (deduplication removed all conflicts)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual FK updates without deferred constraints | SET CONSTRAINTS ALL DEFERRED in transaction | PostgreSQL feature (always available) | Allows updating to non-existent FKs during migration, validated at COMMIT |
| KEYS command for pattern deletion | SCAN with cursor iteration | Redis 2.8+ (2014) | Non-blocking, production-safe for large keyspaces |
| Single-stage migration scripts | Multi-stage with pre/post validation | Best practice | Catches issues before commit, provides rollback data |
| Manual duplicate detection | Window functions (ROW_NUMBER) for dedup | PostgreSQL 8.4+ (2009) | Single-query deduplication with deterministic ordering |

**Current best practices (2026):**
- Drizzle ORM codebase-first approach with schema versioning under VCS
- Deferred constraint checking during complex FK migrations
- SCAN-based cache invalidation over KEYS (non-blocking)
- Comprehensive pre/post validation with checksums

**Deprecated/outdated:**
- Using KEYS command in production (blocks Redis server)
- Migrations without dry-run mode
- FK updates without transaction atomicity
- Cache invalidation without pattern-based deletion

## Open Questions

1. **Should leaderboard recalculation be automatic or manual?**
   - What we know: Cache invalidation forces fresh calculation on next request
   - What's unclear: Whether aggregates are stored and need explicit recalc job
   - Recommendation: Invalidate all leaderboard caches (`db:leaderboard:*`), rely on cache miss to trigger fresh calculation. If aggregates exist in separate table, need explicit recalc script.

2. **Should model sync (sync-models.ts) run automatically after code updates?**
   - What we know: `syncModelsToDatabase()` upserts provider definitions to models table
   - What's unclear: Whether sync happens on deploy or needs manual trigger
   - Recommendation: Run sync script AFTER code updates to ensure models table reflects new provider structure. Check `src/instrumentation.ts` to see if sync runs on startup.

3. **What happens to predictions.provider_used for consolidated models?**
   - What we know: Phase 61 added provider_used column, Phase 62 migration uses it for rollback
   - What's unclear: Should provider_used be updated to reflect new consolidated ID?
   - Recommendation: KEEP provider_used as-is (preserves which provider actually served the request). Migration only updates model_id, not provider_used. This maintains rollback capability.

## Sources

### Primary (HIGH confidence)
- Phase 62 migration scripts: scripts/migrate-consolidate-models.ts, scripts/rollback-consolidate-models.ts (reviewed)
- Current codebase: src/lib/llm/index.ts (MODEL_PROVIDER_ROUTES), src/lib/cache/redis.ts (cache patterns) (reviewed)
- Phase 62 plan: .planning/phases/62-migration-script-development/62-01-PLAN.md (reviewed)

### Secondary (MEDIUM confidence)
- [Drizzle ORM Migrations Documentation](https://orm.drizzle.team/docs/migrations) - Migration best practices
- [PostgreSQL Deferrable Constraints](https://hashrocket.com/blog/posts/deferring-database-constraints) - Constraint deferral patterns
- [Redis Cache Invalidation 2026](https://oneuptime.com/blog/post/2026-01-25-redis-cache-invalidation/view) - Modern cache invalidation strategies
- [Redis SCAN vs KEYS](https://www.drupal.org/project/redis/issues/2851625) - Production-safe pattern deletion

### Tertiary (LOW confidence)
- None (all findings verified against codebase or official documentation)

## Metadata

**Confidence breakdown:**
- Migration script execution: HIGH - scripts already built, tested in Phase 62
- Code consolidation: HIGH - patterns clear from existing codebase structure
- Cache invalidation: HIGH - existing patterns in redis.ts, well-documented
- Leaderboard recalculation: MEDIUM - unclear if aggregates stored separately or calculated fresh

**Research date:** 2026-02-08
**Valid until:** 30 days (stable domain - database migration patterns don't change frequently)

## Critical Context from Phase 62

**Phase 62 Deliverables (already complete):**
- `scripts/migrate-consolidate-models.ts` - Forward migration with deduplication, validation, dry-run
- `scripts/rollback-consolidate-models.ts` - Rollback using provider_used column

**CONSOLIDATION_MAP (3 models only):**
```typescript
const CONSOLIDATION_MAP: Record<string, string> = {
  'deepseek-r1-0528-syn': 'deepseek-r1',
  'kimi-k2-thinking-syn': 'kimi-k2-thinking',
  'kimi-k2.5-syn': 'kimi-k2.5',
};
```

**Important:** Only these 3 models consolidate. The other 10 Synthetic-only models (deepseek-v3-0324-syn, deepseek-v3.1-terminus-syn, etc.) keep their -syn suffix—they don't have base routing IDs because they're Synthetic-exclusive.

**Migration Features (Phase 62):**
- Pre-validation: Counts total/affected rows, detects conflicts
- Deduplication: Resolves duplicate predictions (keeps newest created_at)
- Multi-table update: Updates model_id across all 5 FK tables
- Post-validation: Checks orphaned FKs, unique constraints
- Dry-run mode: Preview changes without committing
- Idempotent: Safe to run multiple times

**Rollback Capability:**
- Uses provider_used column to safely reverse predictions table
- Limitation: Aggregated values (llm_model_stats, model_balances, model_usage) cannot be un-merged
- Should be run BEFORE Phase 63 code changes, not after

## Phase 63 Execution Checklist

- [ ] Run migration dry-run, review output
- [ ] Execute forward migration in production
- [ ] Update MODEL_PROVIDER_ROUTES (remove 3 -syn entries from routes)
- [ ] Update SYNTHETIC_PROVIDERS array (remove 3 consolidated provider definitions)
- [ ] Run model sync script (if not auto-triggered)
- [ ] Invalidate all model-related caches
- [ ] Verify leaderboard recalculation (manual trigger if needed)
- [ ] Run post-migration verification queries (0 orphaned FKs)
- [ ] Compare before/after row counts
- [ ] Verify application functionality (predictions API, leaderboard, admin dashboard)
