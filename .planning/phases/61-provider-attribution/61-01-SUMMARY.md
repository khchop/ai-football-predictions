---
phase: 61-provider-attribution
plan: 01
subsystem: observability
tags:
  - database-migration
  - schema-evolution
  - provider-tracking
  - observability
dependency_graph:
  requires:
    - phase: 60
      plan: 01
      provides: FallbackAPIResult with providerUsed field
  provides:
    - predictions table with provider_used and attempted_providers columns
    - predictions worker persists provider attribution
  affects:
    - phase: 61
      plan: 02
      why: Admin dashboard can now query provider_used
tech_stack:
  added:
    - Drizzle schema fields for provider attribution
  patterns:
    - Idempotent migration with IF NOT EXISTS
    - Nullable columns for historical data
    - Composite indexes for time-filtered queries
key_files:
  created:
    - drizzle/0015_add_provider_attribution.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/queue/workers/predictions.worker.ts
decisions:
  - what: Nullable provider attribution columns
    why: Historical predictions have no provider data
    alternative: Backfill with default values
    chosen: NULL preserves data integrity
  - what: JSON.stringify for attemptedProviders
    why: PostgreSQL TEXT column stores JSON as string
    alternative: Use JSONB column type
    chosen: TEXT keeps migration simple, Phase 62+ can add JSONB if needed
metrics:
  duration: 124s
  completed: 2026-02-08
  tasks_completed: 2
  commits: 2
  files_changed: 3
---

# Phase 61 Plan 01: Provider Attribution Schema Summary

**One-liner:** Added provider_used and attempted_providers columns to predictions table with idempotent migration and worker persistence

## What Was Built

Created database migration and updated predictions worker to persist provider attribution data (which provider actually served each prediction request and which providers were attempted during fallback chains).

**Core components:**
1. Migration file with idempotent DDL (IF NOT EXISTS pattern)
2. Drizzle schema with nullable provider attribution fields
3. Predictions worker extracts from FallbackAPIResult and persists to database

## Tasks Completed

### Task 1: Create migration and update Drizzle schema
**Commit:** fe8f114

Created `drizzle/0015_add_provider_attribution.sql` with:
- `provider_used TEXT` column (nullable)
- `attempted_providers TEXT` column (nullable, JSON-stringified array)
- Index on provider_used for admin dashboard GROUP BY queries
- Composite index on (created_at, provider_used) for time-filtered distribution queries

Updated `src/lib/db/schema.ts`:
- Added `providerUsed` and `attemptedProviders` fields to predictions table
- Added matching indexes to Drizzle schema
- Both fields nullable to preserve historical data integrity

**Verification:**
- Migration file has 4 idempotent DDL statements
- Schema contains both fields and indexes
- TypeScript compiles without errors

### Task 2: Update predictions worker to persist provider attribution
**Commit:** d0e9d73

Modified `src/lib/queue/workers/predictions.worker.ts`:
- Extract `providerUsed` from `apiResult.providerUsed` with fallback to `provider.id`
- Extract `attemptedProviders` and JSON.stringify for TEXT column storage
- Include both fields in every prediction insert
- Log providerUsed when it differs from requested provider (fallback case)

**Verification:**
- Worker extracts from FallbackAPIResult
- Both fields persisted in prediction inserts
- TypeScript compiles
- `npx next build --webpack` passes (full build verification)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:
- [x] Migration file exists with idempotent DDL
- [x] Schema has providerUsed and attemptedProviders fields on predictions table
- [x] Worker extracts apiResult.providerUsed and persists to prediction inserts
- [x] Full build passes without errors
- [x] No changes to FallbackAPIResult interface or callAPIWithFallback signature

## Self-Check

**Verification protocol:** Check created files exist and commits are in history.

```bash
# Check migration file
[ -f "drizzle/0015_add_provider_attribution.sql" ] && echo "FOUND: drizzle/0015_add_provider_attribution.sql" || echo "MISSING"
# FOUND: drizzle/0015_add_provider_attribution.sql

# Check schema changes
grep -q "providerUsed" src/lib/db/schema.ts && echo "FOUND: providerUsed in schema" || echo "MISSING"
# FOUND: providerUsed in schema

# Check worker changes
grep -q "apiResult.providerUsed" src/lib/queue/workers/predictions.worker.ts && echo "FOUND: worker extraction" || echo "MISSING"
# FOUND: worker extraction

# Check commits
git log --oneline --all | grep -q "fe8f114" && echo "FOUND: fe8f114" || echo "MISSING"
# FOUND: fe8f114

git log --oneline --all | grep -q "d0e9d73" && echo "FOUND: d0e9d73" || echo "MISSING"
# FOUND: d0e9d73
```

## Self-Check: PASSED

All files exist, all commits in history, all verifications passed.

## Next Phase Readiness

**Phase 61 Plan 02 (Admin Dashboard Provider Stats):**
- ✅ Ready - predictions.provider_used column available for GROUP BY queries
- ✅ Indexes in place for performant aggregation
- ✅ Historical data NULL-safe (admin queries can filter IS NOT NULL)

**No blockers for next plan.**

## Production Deployment Notes

**Database migration:**
```bash
# Apply migration to production database
psql $DATABASE_URL -f drizzle/0015_add_provider_attribution.sql
```

**Verification after deploy:**
```sql
-- Verify columns exist
\d+ predictions

-- Check new predictions have provider_used populated
SELECT id, match_id, model_id, provider_used, created_at
FROM predictions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected behavior:**
- Historical predictions: `provider_used = NULL`, `attempted_providers = NULL`
- New predictions: `provider_used` populated with actual provider ID
- Fallback cases: `attempted_providers` contains JSON array of attempted provider IDs

## Duration

**Total time:** 124 seconds (2 minutes)

**Breakdown:**
- Planning/context load: ~20s
- Task 1 (schema): ~40s
- Task 2 (worker): ~30s
- Verification/summary: ~34s
