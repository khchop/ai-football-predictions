# Quick Task 045: Deep fix leaderboard Show Archived toggle

## Root Cause Analysis

The Show Archived toggle appeared broken because **zero models had `archived=true`** in the database. The `archived` column was added in migration 006 but never populated. Models were deactivated (`active=false`) without being archived.

## Tasks

### Task 1: Archive inactive models with prediction data
- Run SQL: `UPDATE models SET archived = true WHERE active = false AND id IN (SELECT DISTINCT model_id FROM predictions WHERE status = 'scored')`
- Result: 37 models archived

### Task 2: Fix deactivateOldModels() to auto-archive
- Update `src/lib/db/queries.ts` `deactivateOldModels()` to set `archived: true` alongside `active: false`
- Prevents future models from being deactivated without being archived

### Task 3: Fix remaining unfiltered query branch
- Third missed location in `getLeaderboard()` unfiltered branch (line 378) still had `eq(models.active, true)` without the OR clause
