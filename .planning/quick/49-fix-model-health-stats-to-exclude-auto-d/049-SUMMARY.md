---
phase: quick-049
plan: 01
subsystem: observability
tags: [model-health, auto-disable, stats, bug-fix]
dependency_graph:
  requires: [models.autoDisabled column, model-stats queries]
  provides: [accurate health stats excluding auto-disabled models]
  affects: [health dashboard, regression detection, daily aggregation]
tech_stack:
  added: []
  patterns: [drizzle-orm compound filters]
key_files:
  created: []
  modified:
    - src/lib/db/queries/model-stats.ts
decisions:
  - "Filter auto-disabled models using and(eq(models.active, true), eq(models.autoDisabled, false))"
  - "Apply filter consistently across all three active model query functions"
metrics:
  duration_seconds: 64
  completed: 2026-02-14
  tasks: 1
  files_modified: 1
  commits: 1
---

# Phase Quick-049 Plan 01: Fix Model Health Stats to Exclude Auto-Disabled Summary

**One-liner:** Auto-disabled models now properly excluded from health stats aggregation, dashboard summary, and regression detection using compound filters.

## Overview

Fixed model health stats queries to exclude auto-disabled models (autoDisabled=true) from active model calculations. Previously, queries only filtered by `active=true`, which caused auto-disabled models to inflate failure counts and show 0% success rates, making the health dashboard misleading.

## Implementation

### Changes Made

Updated three query functions in `src/lib/db/queries/model-stats.ts`:

1. **aggregateDailyStats()** (line 175)
   - Changed: `.where(eq(models.active, true))`
   - To: `.where(and(eq(models.active, true), eq(models.autoDisabled, false)))`
   - Impact: Daily stats aggregation no longer counts auto-disabled models as "failed"

2. **getAllModelHealthSummary()** (line 343)
   - Changed: `.where(eq(models.active, true))`
   - To: `.where(and(eq(models.active, true), eq(models.autoDisabled, false)))`
   - Impact: Health dashboard excludes auto-disabled models from active list

3. **detectRegressions()** (line 422)
   - Changed: `.where(eq(models.active, true))`
   - To: `.where(and(eq(models.active, true), eq(models.autoDisabled, false)))`
   - Impact: Regression detection only monitors truly active models

### Technical Details

- Used existing `and` and `eq` imports from drizzle-orm (line 12)
- Used existing `models` schema import (line 15)
- The `autoDisabled` column is a boolean field on the models table
- No new dependencies or imports required

## Verification

✅ All three functions now filter autoDisabled: `grep -c "and(eq(models.active, true), eq(models.autoDisabled, false))" src/lib/db/queries/model-stats.ts` → 3

✅ TypeScript compiles without errors in model-stats.ts

✅ Filters applied at lines 175, 343, 422 as confirmed by: `grep -n "autoDisabled" src/lib/db/queries/model-stats.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Impact

### Before
- Auto-disabled models counted as "active" in health stats
- Inflated failure counts for intentionally disabled models
- Health dashboard showed 0% success rates for auto-disabled models
- Misleading regression alerts for models that were purposely disabled

### After
- Auto-disabled models completely excluded from health calculations
- Clean health dashboard showing only truly active models
- Accurate success rates and regression detection
- Stats align with user expectations of "active" models

## Self-Check

✅ **PASSED**

Files verified:
```
FOUND: /Users/pieterbos/Documents/bettingsoccer/src/lib/db/queries/model-stats.ts
```

Commits verified:
```
FOUND: a694bde
```

Changes verified:
```
3 occurrences of autoDisabled filter at lines 175, 343, 422
TypeScript compiles without errors in modified file
```

---

**Completed:** 2026-02-14
**Commit:** a694bde
**Duration:** 64 seconds
