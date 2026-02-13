---
phase: quick-044
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/queries/stats.ts
autonomous: true
must_haves:
  truths:
    - "Toggling 'Show Archived' on leaderboard displays archived models alongside active ones"
    - "Default leaderboard view (archived off) still only shows active, non-archived models"
  artifacts:
    - path: "src/lib/db/queries/stats.ts"
      provides: "Corrected active/archived filter logic in both query functions"
      contains: "or(eq(models.active, true), eq(models.archived, true))"
  key_links:
    - from: "src/lib/db/queries/stats.ts#getLeaderboard"
      to: "models.active + models.archived columns"
      via: "conditional WHERE clause"
      pattern: "filters\\?\\.includeArchived"
    - from: "src/lib/db/queries/stats.ts#getLeaderboardWithTrends"
      to: "models.active + models.archived columns"
      via: "conditional WHERE clause in buildBaseConditions"
      pattern: "filters\\?\\.includeArchived"
---

<objective>
Fix the "Show Archived" toggle on the leaderboard so archived models actually appear when toggled on.

Purpose: Archived models have `active = false`, but both `getLeaderboard()` and `getLeaderboardWithTrends()` always filter `WHERE active = true`, silently excluding archived models even when `includeArchived` is true.

Output: Corrected query logic in `src/lib/db/queries/stats.ts`
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/db/queries/stats.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix active/archived filter logic in both leaderboard queries</name>
  <files>src/lib/db/queries/stats.ts</files>
  <action>
Two locations need the same fix pattern. `or` is already imported from drizzle-orm.

**Location 1: `getLeaderboard()` ~line 287**

Replace:
```typescript
const whereConditions: any[] = [eq(models.active, true)];
```

With:
```typescript
const activeCondition = filters?.includeArchived
  ? or(eq(models.active, true), eq(models.archived, true))!
  : eq(models.active, true);
const whereConditions: any[] = [activeCondition];
```

**Location 2: `getLeaderboardWithTrends()` ~line 449 inside `buildBaseConditions()`**

Replace:
```typescript
const conditions: any[] = [eq(models.active, true)];
```

With:
```typescript
const activeCondition = filters?.includeArchived
  ? or(eq(models.active, true), eq(models.archived, true))!
  : eq(models.active, true);
const conditions: any[] = [activeCondition];
```

The `!` non-null assertion is safe because `or()` with two arguments always returns a defined value.

The existing `if (!filters?.includeArchived) { push(eq(models.archived, false)) }` block immediately below each location stays as-is -- it still correctly excludes archived models when the toggle is off.
  </action>
  <verify>
1. `npx tsc --noEmit` passes (no type errors)
2. `npm run build` succeeds
3. Manual verification: On the leaderboard page, toggling "Show Archived" should now display archived models in the results
  </verify>
  <done>
When `includeArchived` is true, the WHERE clause uses `(active = true OR archived = true)` instead of just `active = true`, allowing archived (inactive) models to appear. Default behavior unchanged.
  </done>
</task>

</tasks>

<verification>
- TypeScript compilation passes with no errors
- Build succeeds
- Leaderboard default view: shows only active, non-archived models (same as before)
- Leaderboard with "Show Archived" on: shows active models AND archived models
</verification>

<success_criteria>
Archived models appear in leaderboard results when the "Show Archived" toggle is enabled. No regression in default (archived-off) behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/044-fix-show-archived-button-on-leaderboard/044-SUMMARY.md`
</output>
