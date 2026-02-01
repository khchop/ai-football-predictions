---
phase: 02-data-accuracy
plan: 01
subsystem: scoring
tags: [postgresql, transactions, race-conditions, for-update, drizzle-orm]
dependency-graph:
  requires: []
  provides: ["transaction-safe-settlement", "atomic-streak-updates", "row-level-locking"]
  affects: ["02-02", "02-03", "02-04"]
tech-stack:
  added: []
  patterns: ["SELECT FOR UPDATE", "transaction-wrapped scoring", "post-commit cache invalidation"]
key-files:
  created: []
  modified:
    - src/lib/db/queries.ts
    - src/lib/queue/workers/scoring.worker.ts
    - src/lib/queue/workers/predictions.worker.ts
decisions:
  - "Streak updates inside same transaction as prediction scoring for atomicity"
  - "FOR UPDATE lock on both predictions and models tables"
  - "Cache invalidation guaranteed after transaction commits"
metrics:
  duration: "4 min"
  completed: "2026-02-01"
---

# Phase 2 Plan 1: Transaction-Safe Settlement Summary

Transaction-wrapped prediction settlement with FOR UPDATE row-level locking prevents race conditions when concurrent settlement jobs attempt to score the same match.

## What Was Done

### Task 1: Transactional Scoring Function
Added `scorePredictionsTransactional` function to `queries.ts`:
- Uses `db.transaction()` wrapper for atomic operations
- SELECT predictions FOR UPDATE locks rows during scoring
- Prevents concurrent settlement jobs from double-scoring
- Returns structured result with success/failure counts

### Task 2: Worker Refactoring
Refactored `scoring.worker.ts` to use transactional settlement:
- Replaced individual prediction updates with single transaction call
- Removed now-unused imports (updatePredictionScores, updateModelStreak)
- Simplified worker logic with clear separation of concerns
- Cache invalidation guaranteed to happen ONLY after transaction commits

### Task 3: Atomic Streak Updates (Included in Task 1)
Added `updateModelStreakInTransaction` helper function:
- Uses FOR UPDATE lock on model row
- Called within same transaction as prediction scoring
- Prevents lost updates when multiple predictions for same model scored concurrently

## Key Changes

### src/lib/db/queries.ts
```typescript
// New function with FOR UPDATE locking
export async function scorePredictionsTransactional(
  matchId: string,
  actualHome: number,
  actualAway: number,
  quotas: { home: number; draw: number; away: number }
): Promise<{ success: boolean; scoredCount: number; ... }>

// Helper with model row locking
async function updateModelStreakInTransaction(
  tx: any,
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
): Promise<void>
```

### src/lib/queue/workers/scoring.worker.ts
```typescript
// Simplified: one transaction call replaces scoring loop
const result = await scorePredictionsTransactional(
  matchId, actualHome, actualAway, quotas
);

// Cache invalidation AFTER transaction commits
if (result.success && result.scoredCount > 0) {
  await invalidateMatchCaches(matchId);
}
```

## Verification

All verification checks passed:
- [x] `scorePredictionsTransactional` uses `db.transaction()` with `.for('update')`
- [x] Scoring worker calls this function instead of individual updates
- [x] Cache invalidation happens ONLY after transaction commits
- [x] Model streak updates use FOR UPDATE within same transaction
- [x] Build completes without errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript backoffStrategy type signature**
- **Found during:** Build verification
- **Issue:** Pre-existing type error in `predictions.worker.ts` - `type` parameter was `string` but BullMQ expects `string | undefined`
- **Fix:** Changed type signature to `type?: string`
- **Files modified:** `src/lib/queue/workers/predictions.worker.ts`
- **Commit:** 7c9c437

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d82fedb | feat | Add transactional prediction scoring with FOR UPDATE locking |
| 3f5fc1f | refactor | Use transactional settlement in scoring worker |
| 7c9c437 | fix | Fix TypeScript backoffStrategy type signature |

## Next Steps

- Phase 02-02: Leaderboard totals verification (cumulative points query)
- Phase 02-03: Streak tracking correctness (voided/cancelled match handling)
- Phase 02-04: Cache invalidation timing improvements

## Must-Haves Verification

- [x] All 35 predictions for a match are scored exactly once (FOR UPDATE prevents concurrent access)
- [x] No prediction is scored twice when two settlement jobs run concurrently (row lock)
- [x] Cache shows updated data only after all predictions are committed (post-commit invalidation)
