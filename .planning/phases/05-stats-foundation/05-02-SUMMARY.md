---
phase: 05-stats-foundation
plan: 02
status: complete
started: 2026-02-02T09:48:13Z
completed: 2026-02-02
duration: ~3 min

# Dependency mapping
requires:
  - 05-01 # Stats service with canonical formulas

provides:
  - Fixed query functions using correct accuracy formula
  - Competition pages show consistent accuracy with leaderboard
  - Model detail pages show consistent accuracy with leaderboard

affects:
  - 05-03 # Any remaining migration will build on this

# Technology tracking
tech-stack:
  patterns:
    - Standardized SQL accuracy formula across codebase

# File tracking
key-files:
  modified:
    - src/lib/db/queries.ts

# Decisions
decisions:
  - decision: Fix all correctTendencies to use > 0 pattern
    reason: IS NOT NULL includes 0-point wrong predictions, inflating accuracy ~7%
    context: Found additional bug in getModelStatsByCompetitionWithRank during execution
---

# Phase 5 Plan 2: Fix Query Accuracy Formulas Summary

**One-liner:** Fixed accuracy formulas in query functions to match stats service canonical formula (> 0, not IS NOT NULL)

## What Was Built

Fixed incorrect accuracy calculations in database query functions that were causing inconsistent accuracy numbers across different pages.

### Changes Made

1. **getTopModelsByCompetition** (line 273-275)
   - Changed `IS NOT NULL` to `> 0` for correctTendencies
   - Changed denominator from `COUNT(predictions.id)` to `SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END)`
   - Competition pages now show same accuracy as leaderboard

2. **getModelPredictionStats** (line 2022-2023)
   - Changed `IS NOT NULL` to `> 0` for correctTendencies
   - Fixed wrongTendencies to check `= 0 OR IS NULL` instead of just `IS NULL`
   - Model detail pages now show correct accuracy

3. **Documentation comment** (after imports)
   - Added canonical formula reference pointing to stats service
   - Warned against IS NOT NULL pattern
   - Prevents future accuracy formula bugs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getModelStatsByCompetitionWithRank accuracy formula**

- **Found during:** Task 2 verification
- **Issue:** Same IS NOT NULL pattern in another function not listed in plan
- **Fix:** Changed to `> 0` for consistency
- **Files modified:** src/lib/db/queries.ts
- **Commit:** 6b612e5

## Verification Results

| Check | Result |
|-------|--------|
| No IS NOT NULL in accuracy calculations | PASS (1 in doc comment only) |
| correctTendencies uses > 0 | PASS (5 occurrences) |
| Documentation comment exists | PASS |
| TypeScript compiles | PASS (no errors in queries.ts) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9581074 | fix(05-02): correct getTopModelsByCompetition accuracy formula |
| 2 | 6b612e5 | fix(05-02): correct getModelPredictionStats and related accuracy formulas |
| 3 | de89ec3 | docs(05-02): add stats accuracy formula reference comment |

## Impact

- Competition pages now show correct accuracy (was ~7% inflated)
- Model detail pages show correct accuracy (matching leaderboard)
- All accuracy calculations use consistent formula:
  - Numerator: `tendencyPoints > 0`
  - Denominator: `status = 'scored'`
  - Protection: `NULLIF(denom, 0) + COALESCE(result, 0)`

## Next Steps

Plan 05-03 will migrate any remaining API endpoints or components to use the stats service directly.
