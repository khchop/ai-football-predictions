---
phase: 63-model-consolidation-execution
plan: 01
subsystem: llm-infrastructure
tags: [provider-unification, model-consolidation, database-migration, cache-invalidation]
requires:
  - phase-62-migration-scripts
provides:
  - consolidated-provider-configuration
  - synthetic-model-id-cleanup
  - rename-migration-script
  - post-consolidation-script
affects:
  - src/lib/llm/providers/synthetic.ts
  - src/lib/llm/index.ts
  - scripts/rename-syn-models.ts
  - scripts/post-consolidation.ts
tech-stack:
  added: []
  patterns: [deferred-constraints, stub-row-handling, comprehensive-cache-invalidation]
key-files:
  created:
    - scripts/rename-syn-models.ts
    - scripts/post-consolidation.ts
  modified:
    - src/lib/llm/providers/synthetic.ts
    - src/lib/llm/index.ts
decisions:
  - id: CONS-04
    desc: Delete stub target model rows before renaming -syn models
    rationale: sync-models.ts created stub rows for clean IDs before migration ran
    impact: Migration script now handles both fresh databases and databases with sync-models stubs
completed: 2026-02-08T20:42:39Z
metrics:
  duration: 451s
  tasks: 3
  files_modified: 4
  deviations: 1
---

# Phase 63 Plan 01: Provider Configuration Update & Rename Migration

**Update application code to reflect 3-model consolidation and rename 10 Synthetic-exclusive model IDs**

## Overview

Removed 3 consolidated Synthetic provider instances, renamed all 10 remaining Synthetic provider IDs by dropping -syn suffix, updated MODEL_PROVIDER_ROUTES to reflect 2-tier routing (removed 3-tier deepseek-r1 route), and created rename migration script plus post-consolidation operational script.

## Tasks Completed

### Task 1: Remove consolidated providers and rename all -syn provider IDs
**Files:** `src/lib/llm/providers/synthetic.ts`, `src/lib/llm/index.ts`
**Commit:** af0a272

- Removed 3 consolidated provider instances (deepseek-r1-0528-syn, kimi-k2-thinking-syn, kimi-k2.5-syn)
- Renamed all 10 remaining Synthetic provider IDs by dropping -syn suffix:
  - qwen3-235b-thinking-syn → qwen3-235b-thinking
  - deepseek-v3-0324-syn → deepseek-v3-0324
  - deepseek-v3.1-terminus-syn → deepseek-v3.1-terminus
  - deepseek-v3.2-syn → deepseek-v3.2
  - minimax-m2-syn → minimax-m2
  - minimax-m2.1-syn → minimax-m2.1
  - glm-4.6-syn → glm-4.6
  - glm-4.7-syn → glm-4.7
  - qwen3-coder-480b-syn → qwen3-coder-480b
  - gpt-oss-120b-syn → gpt-oss-120b
- Updated displayName strings to remove " (Synthetic)" suffix from all 10 models
- Updated SYNTHETIC_PROVIDERS array to export exactly 10 providers (was 13)
- Updated MODEL_PROVIDER_ROUTES:
  - Removed kimi-k2-thinking and kimi-k2.5 entries (single-provider models)
  - Updated deepseek-r1 from 3-tier to 2-tier (Together → OpenRouter)
- Updated ALL_PROVIDERS comment: 39 total models (29 Together + 10 Synthetic)
- Updated provider ID conventions comment: Synthetic uses clean IDs (no -syn suffix)
- Zero -syn suffixes remain in provider IDs

**Verification:**
- Application builds successfully: ✓
- Zero -syn suffixes in provider IDs: ✓ (grep returns 0)
- SYNTHETIC_PROVIDERS has 10 entries: ✓
- kimi-k2-thinking and kimi-k2.5 routes removed: ✓

### Task 2: Create post-consolidation operational script
**Files:** `scripts/post-consolidation.ts`
**Commit:** 0e44f72

- Deactivates 3 consolidated -syn model rows in models table (deepseek-r1-0528-syn, kimi-k2-thinking-syn, kimi-k2.5-syn)
- Comprehensive cache invalidation:
  - Specific keys: activeModels, activeModelCount, topPerformingModel, allModelHealth, overallStats
  - Pattern-based: db:leaderboard:*, db:stats:*, db:model:*:stats, db:predictions:*, db:models:*
- Post-migration integrity verification (8 checks):
  1. Predictions - Orphaned FKs
  2. LLM Model Stats - Orphaned FKs
  3. Bets - Orphaned FKs
  4. Model Balances - Orphaned FKs
  5. Model Usage - Orphaned FKs
  6. Remaining -syn References (3 consolidated IDs)
  7. Predictions - Unique Constraint (match_id, model_id)
  8. Total Active Models (informational)
- Clear PASS/FAIL output with color coding
- Supports --dry-run for safe preview
- Supports --verbose for detailed output
- Exit codes: 0 on success, 1 on verification failure

**Verification:**
- Script runs with --dry-run: ✓
- Produces verification output: ✓ (8 checks shown)
- Detects existing -syn references (expected before migration): ✓ (279 references found)

### Task 3: Create rename migration script for 10 Synthetic-exclusive models
**Files:** `scripts/rename-syn-models.ts`
**Commit:** e5cc3b5

- Renames 10 Synthetic-exclusive model IDs by dropping -syn suffix
- Updates model_id across 6 tables: models + 5 FK tables (predictions, llm_model_stats, bets, model_balances, model_usage)
- Pre-validation:
  - Counts rows per old model_id across all tables
  - Checks if target IDs already exist in models table
  - Reports total rows to be renamed (872 rows in test run)
- Handles stub target model rows (created by sync-models.ts) by deleting them first (Deviation CONS-04)
- Uses SET CONSTRAINTS ALL DEFERRED to allow FK updates within single transaction
- Rename execution order:
  1. Delete stub target model rows (if they exist)
  2. Rename in models table FIRST (FK constraint source)
  3. Rename in all 5 FK tables (predictions, llm_model_stats, bets, model_balances, model_usage)
- Post-validation (4 checks):
  1. No old model_ids remain across all tables
  2. Row counts match pre-migration for all new model_ids
  3. No orphaned FK references
  4. No -syn suffixes remain in ANY table
- Supports --dry-run for safe preview
- Supports --verbose for detailed output
- Idempotent (safe to run multiple times)
- Exit codes: 0 on success, 1 on validation failure

**Verification:**
- Script runs with --dry-run --verbose: ✓
- Detects 6 stub target model rows (created by sync-models): ✓
- Reports 872 total rows to be renamed: ✓
- Shows per-model breakdown with row counts: ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stub target model rows exist in models table**
- **Found during:** Task 3 - Initial script execution
- **Issue:** sync-models.ts created stub model rows for clean IDs (qwen3-235b-thinking, deepseek-v3.2, etc.) before migration ran. Script's safety check detected these and failed with "Target model IDs already exist - migration cannot proceed safely."
- **Fix:** Added Step 0 to delete stub target model rows BEFORE renaming -syn models. The stub rows are safe to delete because they contain no real data - the -syn model rows have all the predictions and stats.
- **Files modified:** scripts/rename-syn-models.ts
- **Commit:** e5cc3b5 (included in Task 3 commit)
- **Verification:** Script now runs successfully with --dry-run and reports "Deleted N stub model rows" before renaming

**Decision logged:** CONS-04 - Delete stub target model rows before renaming -syn models

## Verification Results

All success criteria met:

- [x] Provider configuration reflects 3-model consolidation (39 total models: 29 Together + 10 Synthetic)
- [x] All 10 Synthetic-exclusive provider IDs renamed without -syn suffix in code
- [x] MODEL_PROVIDER_ROUTES contains only multi-provider routes (deepseek-r1 2-tier, qwen3-235b 2-tier, llama-4-scout 2-tier)
- [x] Rename migration script ready to update database model_ids for 10 Synthetic-exclusive models
- [x] Post-consolidation script ready for production execution
- [x] Application builds successfully

**Build verification:**
```
npx next build --webpack
✓ Compiled successfully
```

**Provider count verification:**
- SYNTHETIC_PROVIDERS: 10 entries (was 13)
- ALL_PROVIDERS comment: "Together: 29 models, Synthetic: 10 exclusive models = 39 total"
- Zero -syn suffixes in provider IDs

**Route verification:**
- MODEL_PROVIDER_ROUTES has 3 entries (was 5)
- deepseek-r1: 2-tier (Together → OpenRouter)
- qwen3-235b: 2-tier (Together → OpenRouter)
- llama-4-scout: 2-tier (Together → OpenRouter)
- kimi-k2-thinking and kimi-k2.5: REMOVED (single-provider models)

**Script verification:**
- scripts/rename-syn-models.ts runs with --dry-run ✓
- scripts/post-consolidation.ts runs with --dry-run ✓
- Both scripts produce detailed verification output ✓

## Self-Check: PASSED

**Created files exist:**
```bash
[ -f "scripts/rename-syn-models.ts" ] && echo "FOUND: scripts/rename-syn-models.ts"
# FOUND: scripts/rename-syn-models.ts

[ -f "scripts/post-consolidation.ts" ] && echo "FOUND: scripts/post-consolidation.ts"
# FOUND: scripts/post-consolidation.ts
```

**Modified files exist:**
```bash
[ -f "src/lib/llm/providers/synthetic.ts" ] && echo "FOUND: src/lib/llm/providers/synthetic.ts"
# FOUND: src/lib/llm/providers/synthetic.ts

[ -f "src/lib/llm/index.ts" ] && echo "FOUND: src/lib/llm/index.ts"
# FOUND: src/lib/llm/index.ts
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "af0a272" && echo "FOUND: af0a272"
# FOUND: af0a272

git log --oneline --all | grep -q "0e44f72" && echo "FOUND: 0e44f72"
# FOUND: 0e44f72

git log --oneline --all | grep -q "e5cc3b5" && echo "FOUND: e5cc3b5"
# FOUND: e5cc3b5
```

All files and commits verified.

## Next Steps

**Phase 63 Plan 02 (next):** Execute migration scripts
- Run rename-syn-models.ts to update database model_ids
- Run post-consolidation.ts to deactivate old models and verify integrity
- Update sync-models.ts to use clean provider IDs from configuration

**Post-deployment verification:**
- Verify no -syn suffixes remain in database (all 5 FK tables)
- Verify model count shows 39 models (29 Together + 10 Synthetic)
- Verify predictions work with renamed model IDs
- Verify leaderboard and stats pages render correctly after cache invalidation

## Impact Assessment

**Breaking changes:** None (backward compatible - migration scripts handle all database updates)

**Provider count change:** 42 → 39 total models (-3 consolidated)

**Routing changes:**
- deepseek-r1: 3-tier → 2-tier (removed Synthetic fallback)
- kimi-k2-thinking: 2-tier → REMOVED (single-provider)
- kimi-k2.5: 2-tier → REMOVED (single-provider)

**Database migration required:** YES
- rename-syn-models.ts: Updates 872 rows across 6 tables (in test run)
- post-consolidation.ts: Deactivates 3 old model rows, invalidates caches

**Risk level:** Medium
- Migration scripts tested with --dry-run
- Rollback capability via Phase 62 rollback script (for consolidation)
- Rename migration is idempotent (safe to run multiple times)
- Post-consolidation verification catches integrity issues before commit

**Recommendation:** Execute migrations during maintenance window with database backup
