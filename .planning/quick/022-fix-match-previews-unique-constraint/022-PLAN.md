# Quick Task 022: Fix match_previews unique constraint

## Problem

`match_previews` table missing UNIQUE constraint on `match_id`, causing all `ON CONFLICT` upserts to fail:
```
error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

Impact:
- All match preview inserts failing (94 failures, 343 DLQ entries)
- LLM API credits consumed but results discarded
- Match detail pages showing no preview content

## Root Cause

Schema defined `matchId` with regular `index()` but not `.unique()`. The `generator.ts` uses `onConflictDoUpdate({ target: matchPreviews.matchId })` which requires a unique constraint.

## Fix

1. Add `.unique()` to `matchId` in `src/lib/db/schema.ts`
2. Add post-deploy task to apply `ALTER TABLE ... ADD CONSTRAINT` in production
