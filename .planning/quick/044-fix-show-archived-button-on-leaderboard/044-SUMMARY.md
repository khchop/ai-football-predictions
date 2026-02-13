---
phase: quick-044
plan: 01
type: summary
subsystem: stats-queries
tags:
  - bug-fix
  - leaderboard
  - archived-models
  - database-queries
dependency_graph:
  requires: []
  provides:
    - "Functional 'Show Archived' toggle on leaderboard"
  affects:
    - src/lib/db/queries/stats.ts#getLeaderboard
    - src/lib/db/queries/stats.ts#getLeaderboardWithTrends
tech_stack:
  added: []
  patterns:
    - "Conditional OR filtering with Drizzle ORM"
key_files:
  created: []
  modified:
    - src/lib/db/queries/stats.ts
decisions: []
metrics:
  duration_seconds: 56
  completed_at: "2026-02-13T20:45:39Z"
  tasks_completed: 1
  commits: 1
---

# Quick Task 044: Fix Show Archived Button on Leaderboard Summary

**One-liner:** Fixed leaderboard queries to actually show archived models when the "Show Archived" toggle is enabled by using OR condition instead of AND.

## Objective

Fix the "Show Archived" toggle on the leaderboard so archived models actually appear when toggled on. Both `getLeaderboard()` and `getLeaderboardWithTrends()` were always filtering `WHERE active = true`, silently excluding archived models (which have `active = false`) even when `includeArchived` was true.

## Implementation

### Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix active/archived filter logic in both leaderboard queries | 3b61139 | src/lib/db/queries/stats.ts |

### Changes Made

**Location 1: `getLeaderboard()` (line 287)**

```typescript
// Before:
const whereConditions: any[] = [eq(models.active, true)];

// After:
const activeCondition = filters?.includeArchived
  ? or(eq(models.active, true), eq(models.archived, true))!
  : eq(models.active, true);
const whereConditions: any[] = [activeCondition];
```

**Location 2: `getLeaderboardWithTrends()` in `buildBaseConditions()` (line 449)**

```typescript
// Before:
const conditions: any[] = [eq(models.active, true)];

// After:
const activeCondition = filters?.includeArchived
  ? or(eq(models.active, true), eq(models.archived, true))!
  : eq(models.active, true);
const conditions: any[] = [activeCondition];
```

Both functions already had the `or` import from `drizzle-orm`. The `!` non-null assertion is safe because `or()` with two arguments always returns a defined value.

The existing `if (!filters?.includeArchived) { conditions.push(eq(models.archived, false)) }` blocks remain unchanged — they still correctly exclude archived models when the toggle is off.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- ✓ Changes applied to both query functions
- ✓ Logic pattern identical in both locations
- ✓ Default behavior preserved (archived off = only active, non-archived models)
- ✓ New behavior: archived on = active models OR archived models
- ✓ Git commit created successfully

## Impact

- **Fixed:** Leaderboard "Show Archived" toggle now functional
- **Default behavior:** Unchanged (shows only active, non-archived models)
- **New behavior:** When toggled on, archived models appear in results alongside active models
- **No breaking changes:** Existing API contracts preserved

## Self-Check

Verifying created files and commits:

```bash
# Check commit exists
git log --oneline --all | grep -q "3b61139"
```

**Result:** ✓ FOUND: commit 3b61139

```bash
# Check file modified
git diff HEAD~1 HEAD src/lib/db/queries/stats.ts
```

**Result:** ✓ FOUND: 8 insertions, 2 deletions in src/lib/db/queries/stats.ts

## Self-Check: PASSED

All commits verified, file changes confirmed.
