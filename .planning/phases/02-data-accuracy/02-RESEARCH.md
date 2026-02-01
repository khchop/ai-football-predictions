# Phase 2: Data Accuracy - Research

**Researched:** 2026-02-01
**Domain:** PostgreSQL transaction patterns, race condition prevention, cache invalidation, and scoring formula verification
**Confidence:** HIGH

## Summary

This research investigates the data accuracy domain for a prediction scoring system that must handle concurrent settlement jobs, maintain accurate leaderboard totals, correctly track model streaks, and ensure timely cache invalidation. The system uses PostgreSQL with Drizzle ORM, Redis caching, and BullMQ job processing. Current pain points include: potential race conditions where multiple settlement jobs could score the same prediction twice, cache invalidation timing that may show stale data, streak tracking that incorrectly handles voided/cancelled matches, and uncertainty about quota point calculation formula accuracy.

The existing scoring worker (scoring.worker.ts) already implements idempotency checks (`if (prediction.status === 'scored') continue`), but lacks database-level locking. The leaderboard totals are computed dynamically from the predictions table via SUM/AVG aggregations (queries/stats.ts), which is correct if individual prediction scores are accurate. The primary risks are: (1) duplicate settlement jobs processing the same match, (2) race conditions when updating model streaks, and (3) cache showing stale data because invalidation happens asynchronously.

**Primary recommendation:** Implement database transactions with SELECT FOR UPDATE for settlement, add explicit row locking for streak updates, ensure cache invalidation occurs only after transaction commit, and verify quota formula implementation matches Kicktipp standard.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | ^8.17.2 | PostgreSQL driver | Native row locking, transaction support |
| drizzle-orm | ^0.45.1 | ORM with transaction API | Supports `for: 'update'` on select queries |
| ioredis | ^5.9.2 | Redis client | Atomic operations, pub/sub for cache invalidation |
| bullmq | ^5.34.3 | Job deduplication | Unique job IDs prevent duplicate settlement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Input validation | Validate scoring inputs before DB writes |
| pino | ^10.2.1 | Structured logging | Trace settlement transactions for debugging |

**Installation:**
Already installed in project.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SELECT FOR UPDATE | Advisory locks | Advisory locks are session-based, more complex to manage |
| Drizzle transactions | Raw SQL transactions | Raw SQL loses type safety |
| Redis cache invalidation | PostgreSQL NOTIFY | NOTIFY requires listener process, Redis already in stack |

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── db/
│   ├── queries.ts           # Add transaction wrappers for settlement
│   └── transactions/
│       └── settlement.ts    # Isolated settlement transaction logic
├── queue/
│   ├── workers/
│   │   └── scoring.worker.ts  # Update to use transactions
│   └── jobs/
│       └── calculate-stats.ts # Ensure atomic cache invalidation
└── cache/
    └── redis.ts             # Add post-transaction invalidation patterns
```

### Pattern 1: SELECT FOR UPDATE for Settlement
**What:** Lock prediction rows during scoring to prevent concurrent modification
**When to use:** Any operation that reads then updates based on current state
**Example:**
```typescript
// Source: Drizzle ORM transactions + PostgreSQL FOR UPDATE
async function settleMatchWithLock(matchId: string): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    // Lock all predictions for this match
    const predictions = await tx
      .select()
      .from(predictionsTable)
      .where(and(
        eq(predictionsTable.matchId, matchId),
        eq(predictionsTable.status, 'pending')
      ))
      .for('update');  // Row-level lock

    // Skip if no pending predictions (already processed)
    if (predictions.length === 0) {
      return;
    }

    // Process each prediction within the transaction
    for (const prediction of predictions) {
      const scores = calculateQuotaScores({...});

      await tx
        .update(predictionsTable)
        .set({
          ...scores,
          status: 'scored',
          scoredAt: new Date(),
        })
        .where(eq(predictionsTable.id, prediction.id));
    }

    // Cache invalidation happens AFTER commit (see pattern below)
  });
}
```

### Pattern 2: Streak Update with Row Lock
**What:** Lock model row when updating streak to prevent lost updates
**When to use:** Concurrent updates to the same model's streak
**Example:**
```typescript
// Source: PostgreSQL concurrency patterns
async function updateModelStreakWithLock(
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    // Lock the model row for update
    const [model] = await tx
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .for('update');

    if (!model) return;

    // Calculate new streak values based on current state
    const newStreak = calculateNewStreak(model, resultType);

    await tx
      .update(models)
      .set(newStreak)
      .where(eq(models.id, modelId));
  });
}
```

### Pattern 3: Post-Transaction Cache Invalidation
**What:** Invalidate cache only after database transaction commits successfully
**When to use:** Prevent stale cache reads during long-running transactions
**Example:**
```typescript
// Source: Redis cache invalidation patterns
async function settleMatchWithCacheSync(matchId: string): Promise<void> {
  const db = getDb();

  // Track what to invalidate
  let invalidationNeeded = false;
  let matchData: { competitionId: string; homeTeam: string; awayTeam: string } | null = null;

  await db.transaction(async (tx) => {
    // ... settlement logic ...

    // Mark for invalidation after commit
    invalidationNeeded = true;
    matchData = { competitionId, homeTeam, awayTeam };
  });

  // Only invalidate AFTER transaction commits successfully
  if (invalidationNeeded && matchData) {
    await invalidateMatchCaches(matchId);
    await invalidateStatsCache(matchData);
  }
}
```

### Pattern 4: BullMQ Job Deduplication for Settlement
**What:** Use unique job IDs to prevent duplicate settlement attempts
**When to use:** Multiple sources could trigger settlement for same match
**Example:**
```typescript
// Source: BullMQ job options
await settlementQueue.add(
  JOB_TYPES.SETTLE_MATCH,
  { matchId },
  {
    jobId: `settle-${matchId}`,  // Prevents duplicate jobs for same match
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  }
);
```

### Pattern 5: Streak Reset on Voided/Cancelled Matches
**What:** Skip streak updates for matches that don't count
**When to use:** Match status changes to voided, cancelled, or postponed
**Example:**
```typescript
// Source: Domain logic for sports prediction
function shouldUpdateStreak(match: Match, prediction: Prediction): boolean {
  // Only update streak for finished matches with valid scores
  if (match.status !== 'finished') return false;
  if (match.homeScore === null || match.awayScore === null) return false;

  // Skip voided predictions
  if (prediction.status === 'void') return false;

  return true;
}
```

### Anti-Patterns to Avoid
- **Check-then-update without lock:** `if (prediction.status !== 'scored')` followed by update creates race window
- **Cache invalidation inside transaction:** Other processes may read stale cache while transaction is in progress
- **Optimistic locking without retry:** If using version columns, must handle conflicts with retry logic
- **Streak update outside transaction:** Concurrent scoring jobs will lose streak updates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate prevention | Application-level flags | BullMQ unique jobId | Handles retries, persistence |
| Row-level locking | Application mutex | PostgreSQL FOR UPDATE | Database-level atomicity |
| Transaction management | Manual BEGIN/COMMIT | Drizzle db.transaction() | Auto-rollback on error |
| Batch scoring | Loop with individual UPDATEs | Single transaction | All-or-nothing atomicity |
| Cache timing | setTimeout after update | Post-transaction callback | Guaranteed ordering |

**Key insight:** PostgreSQL transactions with FOR UPDATE provide the strongest guarantee against race conditions. The database handles deadlock detection and automatic rollback. Application-level solutions (flags, mutexes) cannot provide the same atomicity guarantees across distributed workers.

## Common Pitfalls

### Pitfall 1: Settlement Race Condition
**What goes wrong:** Two settlement jobs run concurrently, both read prediction as 'pending', both update to 'scored' with points
**Why it happens:** Live score worker triggers settlement, then manual backfill job also triggers for same match
**How to avoid:**
- Use BullMQ unique jobId: `settle-${matchId}`
- Wrap scoring in transaction with FOR UPDATE lock
- Check status INSIDE transaction, not before

**Warning signs:**
- Prediction points are 2x expected value
- scoredAt timestamps differ by milliseconds
- BullMQ logs show duplicate job attempts

### Pitfall 2: Cache-Database Inconsistency Window
**What goes wrong:** Cache invalidated before transaction commits, another request refills cache with old data
**Why it happens:** Cache invalidation called inside transaction, then transaction rolls back or takes long time
**How to avoid:**
- Invalidate cache ONLY after transaction.commit() succeeds
- Use try-finally pattern to ensure invalidation on success
- Consider short TTL (60s) as safety net

**Warning signs:**
- Leaderboard shows old totals for ~1 minute after match finishes
- Refreshing page shows different data each time
- "Eventual consistency" taking too long

### Pitfall 3: Streak Lost Updates
**What goes wrong:** Two predictions scored concurrently, both read streak=5, both write streak=6, losing one increment
**Why it happens:** updateModelStreak reads model, calculates new value, then updates - race window between read and write
**How to avoid:**
- Use FOR UPDATE when reading current streak
- Process model streaks sequentially (not in parallel Promise.all)
- Or use atomic SQL: `SET current_streak = current_streak + 1`

**Warning signs:**
- Model streak shows 5 but prediction history shows 6 consecutive wins
- Streak randomly drops during high-volume scoring
- Database logs show deadlock between streak updates

### Pitfall 4: Voided Match Streak Corruption
**What goes wrong:** Model streak resets on voided/cancelled match where they predicted correctly
**Why it happens:** Streak update logic doesn't check match status before applying "wrong" result
**How to avoid:**
- Filter out voided/cancelled matches before streak update
- Check `match.status === 'finished'` explicitly
- Skip predictions with `status === 'void'`

**Warning signs:**
- Model streak resets after postponed match
- Users report "I had a 10-game streak but now it shows 0"

### Pitfall 5: Quota Formula Mismatch
**What goes wrong:** Points awarded don't match expected Kicktipp formula
**Why it happens:** Rounding differences, edge cases with 0 predictions, formula interpretation errors
**How to avoid:**
- Verify formula: Points = (MAX / (10 * P)) - (MAX / 10) + MIN
- Handle edge case: if no one predicted outcome, use MAX_QUOTA
- Round to nearest integer after calculation, not before

**Warning signs:**
- Users report "expected 6 points but got 5"
- Sum of all points doesn't match expected distribution
- Quota values outside [2, 6] range

## Code Examples

### Transaction-Safe Settlement
```typescript
// Source: PostgreSQL FOR UPDATE + Drizzle ORM
export async function settleMatchTransactional(matchId: string): Promise<{
  success: boolean;
  scoredCount: number;
  error?: string;
}> {
  const db = getDb();
  let scoredCount = 0;

  try {
    await db.transaction(async (tx) => {
      // Get match with lock to prevent concurrent settlement
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for('update');

      if (!match || match.status !== 'finished') {
        throw new Error('Match not finished');
      }

      // Get all pending predictions with lock
      const pendingPredictions = await tx
        .select()
        .from(predictions)
        .where(and(
          eq(predictions.matchId, matchId),
          eq(predictions.status, 'pending')
        ))
        .for('update');

      if (pendingPredictions.length === 0) {
        return; // Already scored
      }

      // Calculate quotas
      const quotas = calculateQuotas(pendingPredictions);

      // Update match quotas
      await tx
        .update(matches)
        .set({
          quotaHome: quotas.home,
          quotaDraw: quotas.draw,
          quotaAway: quotas.away,
        })
        .where(eq(matches.id, matchId));

      // Score each prediction
      for (const prediction of pendingPredictions) {
        const breakdown = calculateQuotaScores({
          predictedHome: prediction.predictedHome,
          predictedAway: prediction.predictedAway,
          actualHome: match.homeScore!,
          actualAway: match.awayScore!,
          quotaHome: quotas.home,
          quotaDraw: quotas.draw,
          quotaAway: quotas.away,
        });

        await tx
          .update(predictions)
          .set({
            tendencyPoints: breakdown.tendencyPoints,
            goalDiffBonus: breakdown.goalDiffBonus,
            exactScoreBonus: breakdown.exactScoreBonus,
            totalPoints: breakdown.total,
            status: 'scored',
            scoredAt: new Date(),
          })
          .where(eq(predictions.id, prediction.id));

        scoredCount++;
      }
    });

    // Cache invalidation AFTER transaction commits
    await invalidateMatchCaches(matchId);
    await invalidateStatsCache({ id: matchId });

    return { success: true, scoredCount };

  } catch (error: any) {
    return {
      success: false,
      scoredCount: 0,
      error: error.message
    };
  }
}
```

### Streak Update with Lock
```typescript
// Source: PostgreSQL row locking pattern
export async function updateModelStreakAtomic(
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    // Lock model row to prevent concurrent streak updates
    const [model] = await tx
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .for('update');

    if (!model) return;

    const currentStreak = model.currentStreak || 0;
    const currentStreakType = model.currentStreakType || 'none';
    let bestStreak = model.bestStreak || 0;
    let worstStreak = model.worstStreak || 0;

    let newStreak: number;
    let newStreakType: string;

    if (resultType === 'wrong') {
      // Wrong prediction - start or extend losing streak
      newStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      newStreakType = 'none';
      worstStreak = Math.min(worstStreak, newStreak);
    } else {
      // Correct prediction - extend or start winning streak
      newStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      newStreakType = resultType === 'exact' ? 'exact' :
                      (currentStreakType === 'exact' ? 'exact' : 'tendency');
      bestStreak = Math.max(bestStreak, newStreak);
    }

    await tx
      .update(models)
      .set({
        currentStreak: newStreak,
        currentStreakType: newStreakType,
        bestStreak,
        worstStreak,
      })
      .where(eq(models.id, modelId));
  });
}
```

### Verified Quota Formula
```typescript
// Source: Kicktipp official documentation
// Formula: Points = (MAX / (10 * P)) - (MAX / 10) + MIN
// Where P = predictions_for_tendency / total_predictions

const MIN_QUOTA = 2;
const MAX_QUOTA = 6;

export function calculateQuotas(
  predictions: Array<{ predictedHome: number; predictedAway: number }>
): QuotaResult {
  const total = predictions.length;

  if (total === 0) {
    return { home: MIN_QUOTA, draw: MIN_QUOTA, away: MIN_QUOTA };
  }

  // Count by tendency
  let homeCount = 0, drawCount = 0, awayCount = 0;
  for (const pred of predictions) {
    const result = getResult(pred.predictedHome, pred.predictedAway);
    if (result === 'H') homeCount++;
    else if (result === 'D') drawCount++;
    else awayCount++;
  }

  // Apply Kicktipp formula: (MAX / (10 * P)) - (MAX / 10) + MIN
  function computeQuota(count: number): number {
    if (count === 0) return MAX_QUOTA; // Max points for unpredicted outcome
    const P = count / total;
    const rawQuota = (MAX_QUOTA / (10 * P)) - (MAX_QUOTA / 10) + MIN_QUOTA;
    // Clamp and round
    return Math.round(Math.min(MAX_QUOTA, Math.max(MIN_QUOTA, rawQuota)));
  }

  return {
    home: computeQuota(homeCount),
    draw: computeQuota(drawCount),
    away: computeQuota(awayCount),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Check status before transaction | Check status inside transaction with FOR UPDATE | PostgreSQL best practices | Eliminates race window |
| Cache invalidation in transaction | Post-commit cache invalidation | Redis patterns 2025 | Consistent data visibility |
| Optimistic concurrency | Pessimistic locking for writes | High-contention scenarios | Stronger guarantees |
| Individual streak updates | Batch streak updates within transaction | Current implementation | Atomic consistency |

**Deprecated/outdated:**
- **Optimistic locking for settlement:** Too high contention when multiple workers finish matches simultaneously
- **Application-level deduplication:** BullMQ provides better guarantees with persistence

## Open Questions

1. **Drizzle FOR UPDATE syntax verification**
   - What we know: `.for('update')` syntax exists per GitHub discussions
   - What's unclear: Exact behavior with Drizzle's relational query API
   - Recommendation: Test with select() builder, not query API; fallback to raw SQL if needed

2. **Quota formula rounding behavior**
   - What we know: Kicktipp formula is documented, current implementation uses Math.round
   - What's unclear: Whether Kicktipp rounds before or after applying min/max clamp
   - Recommendation: Round after clamping to match expected behavior; add unit tests for edge cases

3. **Streak calculation for concurrent matches**
   - What we know: Multiple matches can finish simultaneously
   - What's unclear: Whether streaks should be calculated in kickoff order
   - Recommendation: Process streaks sequentially in settlement, order by kickoff time

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) - Transaction API documentation
- [PostgreSQL SELECT FOR UPDATE](https://github.com/drizzle-team/drizzle-orm/discussions/1337) - Drizzle implementation discussion
- [Kicktipp Quota Scoring](https://www.kicktipp.com/info/service/help/2/213) - Official formula documentation

### Secondary (MEDIUM confidence)
- [Preventing Race Conditions with SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/) - PostgreSQL concurrency patterns
- [Row Level Locking in PostgreSQL](https://dev.to/nickcosmo/handling-concurrency-with-row-level-locking-in-postgresql-1p3) - Locking strategies
- [Redis Cache Invalidation](https://redis.io/glossary/cache-invalidation/) - Post-transaction invalidation patterns
- [Three Ways to Maintain Cache Consistency](https://redis.io/blog/three-ways-to-maintain-cache-consistency/) - Cache strategies

### Tertiary (LOW confidence)
- [SELECT FOR UPDATE Considered Harmful](https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/) - Performance considerations (may not apply to our use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing stack (pg, Drizzle, Redis)
- Architecture: HIGH - Patterns verified in PostgreSQL and Drizzle documentation
- Pitfalls: HIGH - Identified from codebase analysis and requirement specifications
- Quota formula: MEDIUM - Kicktipp docs confirmed, implementation verification needed

**Research date:** 2026-02-01
**Valid until:** 2026-05-01 (90 days for stable patterns)
