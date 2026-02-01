---
phase: 03-infrastructure-performance
plan: 03
subsystem: infrastructure
tags: [api-football, budget-enforcement, redis, graceful-degradation, reliability]

requires:
  - phase-02-data-accuracy
  - redis-caching-infrastructure

provides:
  - API-Football request budget tracking (100/day)
  - Automatic midnight UTC budget reset
  - Graceful Redis degradation with 5s cooldown

affects:
  - future-api-rate-limiting
  - future-cost-tracking

tech-stack:
  added: []
  patterns:
    - Redis INCR for atomic counters
    - TTL-based automatic reset
    - Fail-open pattern (availability > enforcement)
    - In-memory cooldown state for degraded mode

key-files:
  created:
    - src/lib/football/api-budget.ts
  modified:
    - src/lib/football/api-client.ts
    - src/lib/cache/redis.ts

decisions:
  - decision: Use Redis INCR for atomic budget counting
    rationale: Prevents race conditions in concurrent request scenarios
    impact: Thread-safe budget tracking

  - decision: Fail open when Redis unavailable for budget tracking
    rationale: Availability more important than strict enforcement during degraded mode
    impact: System continues working during Redis outages

  - decision: 5-second cooldown for Redis retry attempts
    rationale: Prevents connection spam while allowing quick recovery detection
    impact: Balance between rapid recovery and reduced retry overhead

metrics:
  duration: 2.8 min
  tasks_completed: 3
  commits: 3
  files_modified: 3
  deviations: 0
  completed: 2026-02-01
---

# Phase 3 Plan 3: API Budget & Redis Degradation Summary

**One-liner:** API-Football 100/day budget enforcement with atomic Redis counters and graceful degradation with 5s cooldown

## What Was Built

Added API budget enforcement for API-Football free tier (100 requests/day) and improved Redis graceful degradation to ensure system continues when Redis is temporarily unavailable.

### Task 1: API Budget Tracking Module
Created `src/lib/football/api-budget.ts` with:
- Atomic INCR-based request counting (prevents race conditions)
- TTL-based automatic reset at midnight UTC (no manual cleanup)
- Fail-open pattern when Redis unavailable (availability > strict enforcement)
- BudgetExceededError with reset time information
- getBudgetStatus for monitoring

**Key implementation:** Redis INCR provides atomic increment-and-check, TTL automatically resets counter at midnight UTC without manual intervention.

### Task 2: Budget Check Integration
Integrated budget enforcement into `src/lib/football/api-client.ts`:
- Budget check BEFORE making external API request
- BudgetExceededError propagates with reset time
- Re-exported BudgetExceededError for convenience

**Result:** All API-Football requests now tracked against daily budget, blocked when limit exceeded.

### Task 3: Redis Graceful Degradation
Enhanced `src/lib/cache/redis.ts` with systematic degradation handling:
- `shouldUseRedis()`: Check with in-memory cooldown state (5s)
- `markRedisUnavailable()`: Set cooldown and log degraded mode
- Updated all cache operations (get/set/delete) to fail gracefully
- Updated `withCache` to continue without caching during degradation

**Result:** Application serves requests (uncached) when Redis unavailable, with clear degraded mode logging and automatic recovery after cooldown.

## Technical Details

### Budget Tracking Pattern

```typescript
// Atomic increment with TTL-based reset
const currentCount = await redis.incr(BUDGET_KEY);
if (currentCount === 1) {
  await redis.expire(BUDGET_KEY, getSecondsUntilMidnightUTC());
}
if (currentCount > DAILY_REQUEST_LIMIT) {
  throw new BudgetExceededError(...);
}
```

**Why this works:**
- INCR is atomic (no race conditions)
- TTL automatically resets at midnight UTC
- Set TTL only on first request (count = 1)

### Graceful Degradation Pattern

```typescript
let redisUnavailableUntil = 0;

function shouldUseRedis(): boolean {
  if (redisUnavailableUntil > Date.now()) return false;
  return getRedis() !== null;
}

function markRedisUnavailable(error?: unknown): void {
  redisUnavailableUntil = Date.now() + 5000;
  // log degraded mode
}
```

**Why 5 seconds:**
- Prevents connection spam during outage
- Short enough for quick recovery detection
- Balances resilience with performance

## Decisions Made

### 1. Atomic INCR for Budget Tracking
**Context:** Need thread-safe request counting across concurrent workers

**Decision:** Use Redis INCR (atomic increment)

**Alternatives considered:**
- GET + increment + SET: Race condition risk
- Lua script: More complex, INCR sufficient

**Rationale:** INCR provides atomic check-and-increment, preventing double-counting in concurrent scenarios

**Impact:** Thread-safe budget tracking, no manual locking needed

---

### 2. Fail-Open Budget Enforcement
**Context:** Budget tracking requires Redis, but Redis can fail

**Decision:** Allow requests when Redis unavailable (fail open)

**Alternatives considered:**
- Fail closed: Block requests during Redis outage
- In-memory fallback: Complex state sync across workers

**Rationale:** Availability more important than strict enforcement. Better to occasionally exceed budget than block all requests during Redis outage.

**Impact:** System continues serving during Redis degradation, minimal budget enforcement gaps

---

### 3. 5-Second Cooldown for Redis Retry
**Context:** Redis errors should prevent repeated connection spam

**Decision:** 5-second cooldown before retrying Redis operations

**Alternatives considered:**
- No cooldown: Spam connections during outage
- Exponential backoff: Unnecessary complexity for temporary failures
- 30-second cooldown: Too long, delays recovery

**Rationale:** 5 seconds prevents spam while allowing quick recovery detection

**Impact:** Reduced connection overhead during outages, rapid recovery when Redis comes back

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

### Verification Performed

1. **TypeScript compilation:** ✓ No errors
2. **File existence:** ✓ api-budget.ts created
3. **Code integration:** ✓ Budget check in api-client.ts
4. **Graceful degradation:** ✓ shouldUseRedis/markRedisUnavailable present

### Manual Testing Needed

Budget tracking will be verified in production through:
- Monitor API-Football request count in logs
- Verify BudgetExceededError when limit reached
- Check automatic reset at midnight UTC

Redis degradation will be verified through:
- Observe degraded mode logging when Redis fails
- Confirm application continues serving (uncached)
- Verify 5s cooldown prevents connection spam

## Impact Analysis

### Immediate Benefits

1. **Cost control:** API-Football budget enforced, prevents unexpected API blocks
2. **Observability:** Budget status visible in logs
3. **Reliability:** System continues during Redis outages
4. **Performance:** 5s cooldown reduces connection overhead during degraded mode

### Future Considerations

1. **Budget alerts:** Add monitoring for 90% budget utilization
2. **Admin endpoint:** Expose budget status in admin API
3. **Multi-tier support:** Extend to handle paid tier limits (different quotas)
4. **Graceful startup:** Consider warming Redis connection at app startup

### Risks Addressed

- **Budget overrun:** Request tracking prevents exceeding free tier limit
- **Redis outages:** Graceful degradation ensures availability
- **Connection spam:** Cooldown prevents repeated failed connection attempts
- **Manual reset:** TTL-based reset eliminates maintenance overhead

## Next Phase Readiness

### Blockers
None

### Concerns
None

### Prerequisites for Next Plan
None - ready to proceed with plan 03-04

## Commits

- `b80b139`: feat(03-03): create API budget tracking module
- `9ee158b`: feat(03-03): integrate budget check into API client
- `cb52bd9`: feat(03-03): improve Redis graceful degradation

**Total:** 3 commits, 3 files modified (1 created, 2 updated), 166 seconds
