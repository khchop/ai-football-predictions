---
phase: 06-data-migration
plan: 01
subsystem: stats-migration
tags: [accuracy, migration, data-quality, typescript]

# Dependencies
requires:
  - 05-stats-foundation
provides:
  - stats_pre_migration snapshot table
  - verification report documenting accuracy correction
  - cache invalidation logic for production deployment
affects:
  - 06-02 (user communication)
  - future stats queries (now use corrected formula)

# Tech
tech-stack.added:
  - none (used existing pg Pool, fs, path modules)
tech-stack.patterns:
  - idempotent migration script
  - snapshot-before-modify pattern
  - graceful degradation (Redis optional)

# Files
key-files.created:
  - scripts/recalculate-accuracy.ts
  - .planning/phases/06-data-migration/verification-report.json
key-files.modified:
  - none (database-only changes)

# Decisions
decisions:
  - key: snapshot-table-pattern
    choice: Create stats_pre_migration table BEFORE migration
    rationale: Enables rollback if users report issues, provides audit trail
    alternatives: [direct update without snapshot, external backup]
  - key: verification-report-format
    choice: JSON file with before/after comparison per model
    rationale: Machine-readable for blog post generation, human-readable for review
    alternatives: [CSV format, database table only]
  - key: cache-invalidation-timing
    choice: Invalidate after snapshot creation, not after data update
    rationale: No data update needed (formula already fixed in Phase 5), just documenting impact
    alternatives: [invalidate only on deploy, manual invalidation]

# Metrics
duration: 3 min
completed: 2026-02-02
---

# Phase 06 Plan 01: Accuracy Recalculation Migration Summary

> **One-liner:** Created snapshot table and verification report revealing ~48% accuracy drop from fixing IS NOT NULL → > 0 bug

## What Was Built

### 1. Idempotent Migration Script (`scripts/recalculate-accuracy.ts`)

**Purpose:** Document the impact of the Phase 5 accuracy formula correction

**Key features:**
- Creates `stats_pre_migration` snapshot table with pre-fix accuracy values (IS NOT NULL formula)
- Generates verification report comparing old vs new accuracy (> 0 formula)
- Invalidates all stats-related caches (when Redis configured)
- Supports `--dry-run` flag for safe testing
- Idempotent: checks for existing snapshot before running

**Pattern followed:**
Based on existing `scripts/migrate-betting-system.ts` pattern:
- PostgreSQL Pool connection with error handling
- Environment variable validation (DATABASE_URL)
- Transaction-safe operations
- Comprehensive logging

### 2. Snapshot Table (`stats_pre_migration`)

**Schema:**
```sql
CREATE TABLE stats_pre_migration AS
SELECT
  m.id as model_id,
  m.display_name,
  COUNT(p.id) FILTER (WHERE p.status = 'scored') as scored_predictions,
  SUM(CASE WHEN p.tendency_points IS NOT NULL THEN 1 ELSE 0 END) as correct_tendencies_old,
  COALESCE(ROUND(100.0 * SUM(CASE WHEN p.tendency_points IS NOT NULL THEN 1 ELSE 0 END)
    / NULLIF(COUNT(p.id) FILTER (WHERE p.status = 'scored'), 0)::numeric, 1), 0) as old_accuracy,
  now() as snapshot_created_at
FROM models m
LEFT JOIN predictions p ON p.model_id = m.id
WHERE m.active = true
GROUP BY m.id, m.display_name;
```

**Purpose:**
- Rollback reference if users report issues
- Audit trail for before/after comparison
- Blog post content source (show side-by-side comparison)
- 30-day retention before archival

**Contents:** 29 active models with pre-migration accuracy values

### 3. Verification Report

**Location:** `.planning/phases/06-data-migration/verification-report.json`

**Summary statistics:**
- Total models analyzed: 29
- Flagged models (|delta| > 15%): 28
- Average accuracy delta: **-47.8%**
- Max delta: 0% (no increases detected ✓)
- Min delta: -60.1%

**Key findings:**

| Metric | Old (IS NOT NULL) | New (> 0) | Delta |
|--------|-------------------|-----------|-------|
| Avg accuracy | ~93% | ~44% | -47.8% |
| Qwen 2.5 72B | 99.3% | 50.7% | -48.6% |
| Mistral Small 3 | 94.3% | 34.2% | -60.1% |

**Root cause:** The IS NOT NULL formula counted `tendencyPoints = 0` (wrong predictions that were scored) as "correct", severely inflating accuracy metrics.

**Reality check:** The corrected ~44% accuracy is realistic for football match prediction difficulty. Models predicting outcomes correctly less than half the time is expected for a challenging domain with high inherent randomness.

## Decisions Made

### 1. No Data Update Required

**Context:** Phase 5 already fixed the formula in all queries (tendencyPoints > 0)

**Decision:** Migration creates snapshot and verification report only - no UPDATE queries

**Rationale:**
- Formula already corrected in src/lib/services/stats.ts
- Live queries already returning correct values
- Snapshot preserves pre-fix state for reference only
- Avoids touching production data unnecessarily

### 2. Flag Models with Large Deltas

**Threshold:** |delta| > 15 percentage points

**Result:** 28 of 29 models flagged (expected due to bug's severity)

**Purpose:**
- Identify models most affected by correction
- Highlight in user communication (blog post)
- Validate no unexpected increases (all deltas negative)

### 3. Graceful Redis Handling

**Pattern:** Optional cache invalidation with logging

**Implementation:**
```typescript
const cacheFns = await getCacheFunctions();
if (!cacheFns) {
  console.log('⚠️  Cache invalidation skipped (functions not available)');
  return;
}
```

**Benefit:** Migration works in both development (no Redis) and production (Redis configured)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Migration Execution Flow

1. **Connection validation**
   - Check DATABASE_URL environment variable
   - Test connection with SELECT 1
   - Log connection string (masked password)

2. **Idempotency check**
   - Query information_schema.tables for stats_pre_migration
   - Exit early if already ran (prevents duplicate snapshots)
   - Override with DROP TABLE in dry-run mode for testing

3. **Snapshot creation**
   - DROP TABLE IF EXISTS (for reruns)
   - CREATE TABLE AS SELECT with old formula
   - CREATE INDEX on model_id for fast lookups
   - Return row count for verification

4. **Verification report generation**
   - Query snapshot joined with live predictions
   - Calculate new accuracy with > 0 formula
   - Compute deltas and flag large changes
   - Generate summary statistics
   - Save JSON file to planning directory

5. **Cache invalidation** (production only)
   - Import cache functions dynamically
   - Check Redis availability
   - Invalidate patterns: db:leaderboard:*, db:stats:*, db:model:*
   - Log results

### Error Handling

- **Missing DATABASE_URL:** Exit with clear error message
- **Connection failure:** Pool handles retries, exits on timeout
- **Missing Redis:** Gracefully skip cache invalidation with warning
- **Import errors:** Log and continue (cache invalidation optional)

### Testing Strategy

- **Dry-run mode:** `--dry-run` flag for safe testing
- **Idempotency:** Can re-run migration without side effects
- **Logging:** Comprehensive output at each step

## Verification & Quality

### Pre-Migration Verification

```bash
npx tsx scripts/recalculate-accuracy.ts --dry-run
```

Output:
```
Would perform the following:
  1. Create snapshot table with 29 models
  2. Generate verification report comparing old vs new accuracy
  3. Save report to .planning/phases/06-data-migration/verification-report.json
  4. Invalidate cache patterns
```

### Post-Migration Verification

**Snapshot table created:**
```sql
SELECT COUNT(*) FROM stats_pre_migration;
-- Result: 29 models
```

**Verification report generated:**
```bash
cat verification-report.json | jq '.summary'
# {
#   "avgDelta": -47.8,
#   "maxDelta": 0,
#   "minDelta": -60.1
# }
```

**No accuracy increases detected:**
- All deltas are negative or zero
- Expected: accuracy should drop (bug fix)
- Actual: average -47.8% drop (bug was severe)

### Success Criteria Met

- [x] stats_pre_migration table created with ~29 model snapshots
- [x] verification-report.json exists with complete before/after comparison
- [x] Average accuracy delta is negative (expected correction direction)
- [x] No models show accuracy INCREASE (maxDelta = 0)
- [x] Cache invalidation logic in place (executes when Redis available)
- [x] Script is idempotent and safe to re-run

## Next Phase Readiness

### For Plan 06-02 (User Communication)

**Provides:**
- verification-report.json with exact before/after values per model
- Side-by-side comparison data for blog post
- Flagged models for highlighting in communication

**Blocker:** None

**Recommendation:** Generate blog post explaining:
1. Why accuracy dropped (bug fix, not model degradation)
2. What the bug was (IS NOT NULL counting 0-point predictions)
3. Why new numbers are realistic (~44% accuracy for football is expected)
4. How to interpret the new metrics (tendency accuracy vs exact accuracy)

### For Production Deployment

**Pre-deployment checklist:**
- [x] Migration script tested with --dry-run
- [x] Verification report reviewed
- [x] No unexpected accuracy increases
- [ ] Redis configured (REDIS_URL environment variable)
- [ ] Blog post published explaining changes
- [ ] Changelog entry created

**Deployment steps:**
1. Run migration script: `npx tsx scripts/recalculate-accuracy.ts`
2. Verify snapshot table created: `SELECT COUNT(*) FROM stats_pre_migration;`
3. Review verification report: `cat verification-report.json | jq .summary`
4. Cache invalidation will run automatically (if Redis configured)
5. Monitor application for errors (stats should render correctly)

**Rollback plan:**
If users report issues, stats_pre_migration table contains original values.
Can restore old formula temporarily while investigating.

## Key Insights

### Bug Severity Underestimated

**Initial estimate:** ~7% accuracy drop (from plan context)

**Actual impact:** ~48% accuracy drop (7x worse than expected)

**Root cause:**
```sql
-- Old (buggy):
WHERE tendency_points IS NOT NULL  -- includes 0-point wrong predictions

-- New (correct):
WHERE tendency_points > 0  -- only non-zero tendency points
```

**Implication:** Many predictions had `tendency_points = 0` (wrong tendency, 0 points awarded). The IS NOT NULL formula counted these as "correct", severely inflating accuracy.

### Realistic Accuracy Values

**Before fix:** 93% average (unrealistic for football prediction)

**After fix:** 44% average (realistic for domain difficulty)

**Context:**
- Football matches have inherent randomness (upsets, late goals, refereeing)
- Even professional analysts struggle to predict >50% of outcomes
- Models predicting tendency (win/draw/loss) correctly ~45% of time is solid performance
- Exact score prediction is even harder (~10-15% accuracy expected)

### User Communication Critical

**Risk:** Users will see accuracy "drop" from 93% to 44% and assume:
- Models got worse
- System is broken
- Data was lost

**Mitigation:** Proactive communication via blog post BEFORE deployment:
- Explain the bug and fix
- Show before/after comparison
- Emphasize: models didn't change, only the calculation
- Provide context on realistic accuracy expectations
- Highlight that lower accuracy doesn't mean lower value (models still outperform random guessing)

## Files Modified

### Created

1. **scripts/recalculate-accuracy.ts** (346 lines)
   - Idempotent migration script with dry-run support
   - Snapshot creation, verification report generation, cache invalidation
   - Comprehensive error handling and logging

2. **.planning/phases/06-data-migration/verification-report.json** (273 lines)
   - Complete before/after accuracy comparison for 29 models
   - Summary statistics, flagged models, per-model deltas

### Database Changes

1. **stats_pre_migration table** (new)
   - 29 rows (one per active model)
   - Preserves pre-migration accuracy values
   - Indexed on model_id for fast lookups

### Modified

None (formula already fixed in Phase 5)

## Commits

1. `6356c66` - feat(06-01): add idempotent accuracy recalculation migration script
2. `0c6dadd` - feat(06-01): execute accuracy migration and generate verification report
3. `d26ac3c` - docs(06-01): verify cache invalidation logic

**Total changes:**
- 2 files created
- 619 lines added
- 1 database table created
- 3 atomic commits

---

**Phase 06 Plan 01 complete.** Migration script created, executed successfully, and verification report generated. Ready for Plan 06-02: User Communication.
