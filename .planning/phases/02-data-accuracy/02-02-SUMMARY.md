---
phase: 02
plan: 02
subsystem: scoring
tags: [quota, kicktipp, scoring, formula]
dependency-graph:
  requires: []
  provides: [kicktipp-accurate-quota-calculation]
  affects: [leaderboard-accuracy, model-rankings]
tech-stack:
  added: []
  patterns: [kicktipp-quota-formula, unit-testing]
key-files:
  created:
    - src/lib/utils/__tests__/scoring.test.ts
  modified:
    - src/lib/utils/scoring.ts
decisions:
  - id: kicktipp-formula
    choice: "Use documented Kicktipp formula: (MAX / (10 * P)) - (MAX / 10) + MIN"
    reason: "Matches official Kicktipp scoring documentation, properly rewards rare predictions"
metrics:
  duration: 3.5 min
  completed: 2026-02-01
---

# Phase 02 Plan 02: Kicktipp-Accurate Quota Calculation Summary

Corrected quota point calculation to match Kicktipp's standard formula, ensuring rare predictions earn more points (up to 6) and common predictions earn fewer (minimum 2).

## What Changed

### Task 1: Fixed calculateQuotas Formula
**Commit:** 4194b80

**Before (incorrect):**
```typescript
const rawQuota = total / count;  // Simple ratio
```

**After (Kicktipp formula):**
```typescript
const P = count / total;  // Proportion of predictions for tendency
const rawQuota = (MAX_QUOTA / (10 * P)) - (MAX_QUOTA / 10) + MIN_QUOTA;
```

Key differences:
- P is now `count/total` (proportion) not `total/count` (inverse)
- Formula matches Kicktipp documentation exactly
- Unpredicted outcomes correctly receive MAX_QUOTA (6 points)

### Task 2: Unit Tests for Edge Cases
**Commit:** 1d7a246

Created comprehensive test suite covering:
- Empty predictions (returns MIN_QUOTA for all)
- Unpredicted outcomes (returns MAX_QUOTA)
- Even distribution (mid-range quotas)
- Rare predictions (higher quotas, clamped to MAX)
- Boundary validation (all quotas in [2, 6] range)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/utils/scoring.ts` | Corrected formula, updated comments |
| `src/lib/utils/__tests__/scoring.test.ts` | New: 5 unit tests for quota calculation |

## Verification Results

1. Formula present in code: PASS
2. Unit tests pass: PASS (5/5 tests)
3. No TypeScript errors in scoring.ts: PASS
4. Build: Pre-existing errors in other files (not related to this plan)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Quota calculation is now Kicktipp-accurate
- Scoring worker will use correct quotas when settling matches
- Ready for 02-03 (Match Settlement Accuracy)
