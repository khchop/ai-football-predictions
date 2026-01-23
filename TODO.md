# TODO: Remaining System Improvements

**Generated:** 2026-01-23  
**Source:** Deep system analysis (84 total issues identified)  
**Status:** Batches 1-2 complete (10 issues fixed), Batches 3-5 pending

---

## Overview

| Priority | Count | Fixed | Status |
|----------|-------|-------|--------|
| **CRITICAL** | 4 | 4 | ✅ Batch 1 complete |
| **HIGH** | 18 | 6 | 🔄 Batch B complete (6 fixed), Batches 3-5 pending (12 remaining) |
| **MEDIUM** | 49 | 0 | 📋 Documented for future work |
| **LOW** | 13 | 0 | 📋 Documented for future work |

---

## MEDIUM Priority Issues (49 total)

### Database & Query Optimization (8 issues)

- [ ] **N+1 loop in settleBetsTransaction** - `src/lib/db/queries.ts:718-745`
  - Issue: Settlement loop executes 60+ individual UPDATE queries for large batches
  - Fix: Use SQL CASE expressions for batch updates
  - Impact: Transaction time bloat and lock contention
  - Effort: 30 min

- [ ] **`createBets` without balance update exposed** - `src/lib/db/queries.ts:595-598`
  - Issue: Public function creates bets without updating model balance
  - Fix: Make `createBets` private, force use of `createBetsWithBalanceUpdate`
  - Impact: Potential data inconsistency if wrong function used
  - Effort: 10 min

- [ ] **Undefined return without null check** - `src/lib/db/queries.ts:155, 179, 298`
  - Issue: Functions return `result[0]` which could be `undefined`
  - Fix: Document as `T | undefined` or explicitly return `null`
  - Impact: Runtime errors if callers don't check for undefined
  - Effort: 15 min

- [ ] **Connection pool exhaustion risk** - `src/lib/db/queries.ts:710-747`
  - Issue: Long transactions with N+1 queries exhaust 10-connection pool
  - Fix: Optimize settleBetsTransaction and batch updates
  - Impact: Request queueing and timeouts under load
  - Effort: 30 min (tied to N+1 fix)

- [ ] **Inconsistent lock ordering (deadlock risk)** - `src/lib/db/queries.ts:311+`
  - Issue: Different transactions lock tables in different orders
  - Fix: Document and enforce consistent order: `models -> bets -> modelBalances`
  - Impact: Future deadlock potential if code changes
  - Effort: 20 min

- [ ] **Silent cache failure in upserts** - `src/lib/db/queries.ts:40, 288`
  - Issue: Cache invalidation errors aren't caught, fail whole operation
  - Fix: Wrap cache operations in try-catch or fire-and-forget
  - Impact: Database operations fail when Redis is down
  - Effort: 15 min

- [ ] **Health recording race condition** - `src/lib/db/queries.ts:412-453`
  - Issue: Model health stats can be racy under concurrent predictions
  - Fix: Atomic conditional updates or move into transaction
  - Impact: Slightly inaccurate health statistics
  - Effort: 25 min

- [ ] **Raw SQL type casting** - `src/lib/db/queries.ts:1038-1058`
  - Issue: Manual type assertions on COUNT(*) results
  - Fix: Use proper SQL casting (already done with `::int`)
  - Impact: Potential precision loss for very large counts
  - Effort: 10 min

---

### API Security & Rate Limiting (9 issues)

- [x] **Rate limiter fails open** - `src/lib/utils/rate-limiter.ts:40-48`
  - Fixed: Added failClosed option (true for admin, false for public)
  - Implementation: Admin routes reject if Redis unavailable, public allow
  - Date: 2026-01-23

- [x] **IP spoofing via X-Forwarded-For** - `src/lib/utils/rate-limiter.ts:90-116`
  - Fixed: Only trust CF-Connecting-IP, validate IP format, use fingerprint fallback
  - Implementation: Added isValidIP() validation, prevents arbitrary values
  - Date: 2026-01-23

- [x] **Anonymous rate limit fallback** - `src/lib/utils/rate-limiter.ts:115`
  - Fixed: Use request fingerprinting (User-Agent hash) instead of 'anonymous'
  - Implementation: Fingerprinting is not spoofable, protects against bypasses
  - Date: 2026-01-23

- [x] **Missing request body size limits** - All POST endpoints
  - Fixed: Added middleware.ts with 10KB admin / 100KB public limits
  - Implementation: Checks Content-Length, returns 413 if exceeded
  - Date: 2026-01-23

- [x] **No CORS configuration** - `next.config.ts`
  - Fixed: Created src/middleware.ts with strict CORS policy
  - Implementation: Same-origin only + NEXT_PUBLIC_BASE_URL, localhost in dev
  - Date: 2026-01-23

- [ ] **Potential IDOR in model bets** - `src/app/api/models/[id]/bets/route.ts:15-50`
  - Issue: Any user can access any model's betting data
  - Note: May be intentionally public - verify before fixing
  - Impact: If sensitive, private betting data exposed
  - Effort: 15 min (after verification)

- [x] **Missing CSRF protection** - State-changing endpoints
  - Status: Not needed - header-based auth provides implicit protection
  - Rationale: Custom headers cannot be set cross-origin, eliminates CSRF
  - Note: Would require explicit tokens if cookie-based auth added
  - Date: 2026-01-23

- [ ] **API errors logged but not thrown** - `src/lib/football/h2h.ts:55-57`
  - Issue: API returns errors in response, they're logged but function continues
  - Fix: Throw errors instead of silent failures
  - Impact: Bad data written to database when API indicates error
  - Effort: 20 min

- [x] **Admin errors expose details** - `src/app/api/admin/*/route.ts` (multiple)
  - Fixed: All admin routes now use sanitizeError()
  - Implementation: Updated data, queue-status, dlq routes; re-enable-model already done
  - Date: 2026-01-23

- [ ] **Missing request body size limits** - All POST endpoints
  - Issue: No explicit body size limits before parsing
  - Fix: Configure Next.js body size limits or add middleware
  - Impact: Memory exhaustion DoS via large payloads
  - Effort: 20 min

- [ ] **No CORS configuration** - `next.config.ts`
  - Issue: No explicit CORS headers configured
  - Fix: Add middleware with appropriate CORS policy
  - Impact: Cross-origin requests may be blocked or exposed
  - Effort: 20 min

- [ ] **Potential IDOR in model bets** - `src/app/api/models/[id]/bets/route.ts:15-50`
  - Issue: Any user can access any model's betting data
  - Note: May be intentionally public - verify before fixing
  - Impact: If sensitive, private betting data exposed
  - Effort: 15 min (after verification)

- [ ] **Missing CSRF protection** - State-changing endpoints
  - Issue: Admin operations rely only on header auth (no tokens)
  - Fix: Add CSRF token validation for POST/PUT/DELETE
  - Impact: Combined with XSS, could allow state changes
  - Effort: 45 min

- [ ] **API errors logged but not thrown** - `src/lib/football/h2h.ts:55-57`
  - Issue: API returns errors in response, they're logged but function continues
  - Fix: Throw errors instead of silent failures
  - Impact: Bad data written to database when API indicates error
  - Effort: 20 min

- [ ] **Admin errors expose details** - `src/app/api/admin/*/route.ts` (multiple)
  - Issue: Admin endpoints expose raw error messages
  - Fix: Use error-sanitizer even for admin (they should read logs)
  - Impact: Exposes internal system details
  - Effort: 15 min

---

### External API Integration (15 issues)

- [ ] **Hardcoded timeouts not configurable** - `src/lib/llm/providers/base.ts:147-148`
  - Issue: 15s single / 20s batch timeouts hardcoded
  - Fix: Make configurable via environment or constructor
  - Impact: Batch predictions may timeout with many models
  - Effort: 20 min

- [ ] **No retry on JSON parse failure** - `src/lib/llm/providers/base.ts:212-217`
  - Issue: JSON parse errors thrown immediately without retry
  - Fix: Treat as transient, retry with exponential backoff
  - Impact: Transient network glitches cause permanent failure
  - Effort: 20 min

- [ ] **Duplicated fetchFromAPI implementations** - Multiple files
  - Files: `api-client.ts`, `api-football.ts`, `h2h.ts`, `team-statistics.ts`, `standings.ts`, etc.
  - Issue: Retry logic duplicated across 7+ modules
  - Fix: Consolidate into central `api-client.ts` utility
  - Impact: Maintenance burden, inconsistent behavior
  - Effort: 45 min

- [ ] **URL logging pattern risk** - `src/lib/football/api-football.ts:32`
  - Issue: Logging full URLs could leak API keys if structure changes
  - Fix: Only log endpoints, not full URLs with params
  - Impact: Future API key exposure if URL structure changes
  - Effort: 10 min

- [ ] **Rate limit detection via string matching** - `src/lib/football/api-client.ts:75-83`
  - Issue: Uses `.includes()` to detect rate limit errors
  - Fix: Prefer HTTP 429 status code detection
  - Impact: Fragile - false positive/negatives if messages change
  - Effort: 15 min

- [ ] **Hardcoded 60s retry-after** - `src/lib/football/api-client.ts:78-82`
  - Issue: Hardcoded retry-after instead of reading from headers
  - Fix: Check `Retry-After` header, fallback to 60s
  - Impact: May over/under-wait for rate limit recovery
  - Effort: 15 min

- [ ] **Rate limit headers not used proactively** - `src/lib/football/api-client.ts:54-58`
  - Issue: Remaining requests logged but not used for throttling
  - Fix: Slow requests proactively before hitting limit
  - Impact: System hits rate limit unnecessarily
  - Effort: 30 min

- [ ] **Score range too permissive (0-20)** - `src/lib/llm/prompt.ts:103-111`
  - Issue: LLMs can hallucinate scores like 15-0
  - Fix: Tighter validation (e.g., 0-7 for safe range)
  - Impact: Unrealistic predictions harm user trust
  - Effort: 10 min

- [ ] **No odds value validation** - `src/lib/football/match-analysis.ts:193-266`
  - Issue: Odds values extracted without validation
  - Fix: Verify decimal format and reasonable ranges
  - Impact: Malformed odds displayed to users
  - Effort: 20 min

- [ ] **Standings error vs empty indistinguishable** - `src/lib/football/standings.ts:181-184`
  - Issue: Error returns 0 updated, same as "no standings available"
  - Fix: Return custom error or wrap in Try type
  - Impact: Can't monitor data freshness
  - Effort: 15 min

- [ ] **6 raw API responses stored per match** - `src/lib/football/match-analysis.ts:549-567`
  - Issue: ~50-100KB JSON per match stored in database
  - Fix: Only store processed results, archive raw responses
  - Impact: Database bloat, ~30-60MB per 100 matches/day
  - Effort: 45 min

- [ ] **All fixtures loaded into memory at once** - `src/lib/football/api-football.ts:117-129`
  - Issue: All fixtures accumulated in single array
  - Fix: Process and cache fixtures in batches
  - Impact: Memory spike on busy days with 100+ fixtures
  - Effort: 25 min

- [ ] **Single success closes circuit breaker** - `src/lib/utils/circuit-breaker.ts:134-148`
  - Issue: Only 1 success in half-open closes circuit
  - Fix: Require 2-3 consecutive successes
  - Impact: Circuit oscillates with intermittent failures
  - Effort: 10 min

- [ ] **Lineups assumes exactly 2 elements** - `src/lib/football/lineups.ts:94`
  - Issue: Destructuring `[lineup1, lineup2]` without length check
  - Fix: Validate array length before destructuring
  - Impact: Crash if API returns 1 or 3+ lineups
  - Effort: 10 min

- [ ] **Incomplete array element validation** - `src/lib/football/lineups.ts:68-71`
  - Issue: `formatStartingXI` doesn't check if array elements are null
  - Fix: Add element-level null checks
  - Impact: Runtime error on malformed lineup data
  - Effort: 10 min

---

### Queue Infrastructure (9 issues)

- [ ] **Scheduled jobs may overlap with backfill** - `src/lib/queue/scheduler.ts` vs `src/lib/queue/workers/backfill.worker.ts`
  - Issue: Scheduler creates `analyze-${id}`, backfill creates `backfill-analyze-${id}`
  - Fix: Consolidate job IDs or check for existing jobs
  - Impact: Duplicate analysis jobs for same match
  - Effort: 20 min

- [ ] **No timezone validation** - `src/lib/queue/setup.ts:24-26, 49-51, 87-89, 110-112`
  - Issue: `Europe/Berlin` hardcoded without validation
  - Fix: Validate timezone exists at startup
  - Impact: Jobs run at wrong time if timezone DB unavailable
  - Effort: 15 min

- [ ] **No cleanup for cancelled matches** - `src/lib/queue/scheduler.ts:163-192`
  - Issue: `cancelMatchJobs` only removes waiting/delayed jobs
  - Fix: Detect cancelled matches and clean up automatically
  - Impact: Stale jobs execute for cancelled matches
  - Effort: 30 min

- [ ] **Connection not closed on shutdown** - `src/lib/queue/index.ts:34-95`
  - Issue: Redis connection never explicitly closed
  - Fix: Add graceful shutdown handler
  - Impact: Resource leaks in long-running processes
  - Effort: 20 min

- [ ] **No health check before queue operations** - `src/lib/queue/index.ts:39-43`
  - Issue: `isQueueConnectionHealthy()` exists but never called
  - Fix: Call before critical operations
  - Impact: Queue operations may silently fail
  - Effort: 15 min

- [ ] **No automatic DLQ alerting** - `src/lib/queue/dead-letter.ts`
  - Issue: Failed jobs stored but no alert mechanism
  - Fix: Log warning when DLQ exceeds threshold
  - Impact: Failed jobs go unnoticed indefinitely
  - Effort: 20 min

- [ ] **No global rate limiting across workers** - All workers
  - Issue: Each worker sets own concurrency, combined may exceed API limits
  - Fix: Implement global rate limiter across all workers
  - Impact: API rate limiting errors under concurrent load
  - Effort: 60 min

- [ ] **Live score polling unbounded concurrency** - `src/lib/queue/workers/live-score.worker.ts:58-70`
  - Issue: Each live match self-schedules, errors schedule again
  - Fix: Dedup re-scheduling, cap concurrent polls
  - Impact: Exponential job growth during errors
  - Effort: 30 min

- [ ] **Repeatable job update doesn't remove old pattern** - `src/lib/queue/setup.ts:14-128`
  - Issue: Changing cron pattern doesn't remove old one
  - Fix: Delete old repeatable jobs before adding new ones
  - Impact: Old schedules persist unless manually cleaned
  - Effort: 20 min

---

### Cache Issues (7 issues)

- [ ] **Fire-and-forget cache set** - `src/lib/cache/redis.ts:301-304`
  - Issue: Cache writes are fire-and-forget with swallowed errors
  - Fix: Log failures, monitor cache hit rate
  - Impact: Failed cache writes go undetected
  - Effort: 15 min

- [ ] **`null` value caching issue** - `src/lib/cache/redis.ts:163-177, 294`
  - Issue: Legitimate cached `null` values cause re-fetch
  - Fix: Use sentinel value or distinguish cache miss from null
  - Impact: API queries repeated unnecessarily
  - Effort: 20 min

- [ ] **No connection pool configuration** - `src/lib/cache/redis.ts:32-43`
  - Issue: Using ioredis defaults without tuning
  - Fix: Configure max connections, pre-warming
  - Impact: Connection establishment latency under load
  - Effort: 20 min

- [ ] **Event listener accumulation** - `src/lib/cache/redis.ts:99-108`
  - Issue: In `ensureRedisConnection`, listeners may accumulate
  - Fix: Use `once()` (already done) but add cleanup timeout
  - Impact: Rare: event listeners remain if connection hangs
  - Effort: 15 min

- [ ] **JSON serialization errors not specific** - `src/lib/cache/redis.ts:191`
  - Issue: `JSON.stringify` errors caught as generic cache error
  - Fix: Catch and log serialization errors distinctly
  - Impact: Hard to debug circular references
  - Effort: 15 min

- [ ] **Cache key collision risk** - `src/lib/cache/redis.ts:249`
  - Issue: User-supplied filter string used directly in key
  - Fix: Escape special characters or hash filters
  - Impact: Potential key collisions or incorrect invalidation
  - Effort: 20 min

- [ ] **TTL misconfiguration for live events** - `src/lib/cache/redis.ts:138-158`
  - Issue: `LINEUPS: 900s` and `ODDS: 1800s` too long for live betting
  - Fix: Reduce to 300s (5 min) for pre-match period
  - Impact: Users see outdated odds/lineups
  - Effort: 10 min

---

### Worker Issues (4 issues)

- [ ] **Errors in content worker not re-thrown** - `src/lib/queue/workers/content.worker.ts:158-160`
  - Issue: Errors in queue add loop caught and logged
  - Fix: Re-throw or track in results
  - Impact: Job appears successful even with failures
  - Effort: 15 min

- [ ] **Missing job context in error logging** - Multiple workers
  - Issue: Error logs missing job-specific context
  - Fix: Include matchId, jobId, retry count, etc.
  - Impact: Harder to debug specific failures
  - Effort: 30 min

- [ ] **Errors array unbounded size** - `src/lib/queue/workers/backfill.worker.ts:37+`
  - Issue: Errors array accumulates without limit
  - Fix: Cap error array (e.g., max 100 entries)
  - Impact: Memory waste on high-error scenarios
  - Effort: 10 min

- [ ] **Model success recorded before batch insert** - `src/lib/queue/workers/predictions.worker.ts:137-138`
  - Issue: Health recorded before batch insert succeeds
  - Fix: Record success only after batch insert
  - Impact: Health stats inconsistent with actual predictions
  - Effort: 15 min

---

## LOW Priority Issues (13 total)

### Database (1 issue)

- [ ] **Missing composite index** - `src/lib/db/schema.ts:349-355`
  - Issue: No composite index on `predictions.matchId + status`
  - Fix: Add `index('idx_predictions_match_status')`
  - Impact: Suboptimal query planner performance
  - Effort: 5 min

### Queue (6 issues)

- [ ] **Circuit breaker state not persisted** - `src/lib/utils/circuit-breaker.ts:71`
  - Issue: In-memory state lost on restart
  - Fix: Persist to Redis with 1-hour TTL
  - Impact: Failures immediately after restart not blocked
  - Effort: 30 min

- [ ] **Priority not consistently applied** - `src/lib/queue/scheduler.ts:47-109`
  - Issue: Some jobs have priority, others don't
  - Fix: Set priority: 10 for time-sensitive jobs
  - Impact: Non-critical jobs delay important ones
  - Effort: 20 min

- [ ] **No priority escalation for deadlines** - `src/lib/queue/scheduler.ts`
  - Issue: No boost to priority as kickoff approaches
  - Fix: Implement dynamic priority based on time-to-kickoff
  - Impact: Late jobs may miss their window
  - Effort: 45 min

- [ ] **Startup backfill jobs never cleaned** - `src/lib/queue/setup.ts:66-78`
  - Issue: Each restart creates new unique backfill job
  - Fix: Deduplicate or auto-clean old ones
  - Impact: Slow Redis memory growth over time
  - Effort: 20 min

- [ ] **DLQ index not cleaned when entries expire** - `src/lib/queue/dead-letter.ts:54-63`
  - Issue: ZSET index has stale keys for expired entries
  - Fix: Trim index when retrieving DLQ jobs
  - Impact: Fewer DLQ entries returned than exist
  - Effort: 15 min

- [ ] **No validation of cron patterns** - `src/lib/queue/setup.ts`
  - Issue: Cron patterns are raw strings with no validation
  - Fix: Use cron validation library at startup
  - Impact: Invalid cron patterns silently fail
  - Effort: 15 min

### Cache (2 issues)

- [ ] **Cache warming doesn't verify writes** - `src/lib/cache/warming.ts:52-94`
  - Issue: Reports warming success without verifying data cached
  - Fix: Verify with follow-up cache hits
  - Impact: False positive - cache may not be warm
  - Effort: 20 min

- [ ] **Health check can serve stale status** - `src/lib/cache/redis.ts:65-86`
  - Issue: 30-second cooldown caches health status
  - Fix: Reduce cooldown during degradation
  - Impact: App retries failed operations for 30 seconds
  - Effort: 15 min

### Workers (2 issues)

- [ ] **Dynamic import in content worker** - `src/lib/queue/workers/content.worker.ts:122`
  - Issue: `await import('../index')` is unusual and fragile
  - Fix: Use static import at file top
  - Impact: Runtime resolution error if path changes
  - Effort: 5 min

- [ ] **Zero-point predictions not logged** - `src/lib/queue/workers/scoring.worker.ts:112-114`
  - Issue: Only logs when `breakdown.total > 0`
  - Fix: Log all predictions for completeness
  - Impact: Missing visibility into zero-point cases
  - Effort: 5 min

### Other (2 issues)

- [ ] **Per-job timeout not configurable** - `src/lib/queue/scheduler.ts:121-143`
  - Issue: All jobs use 2-minute timeout
  - Fix: Allow per-job override (e.g., 10min for predictions)
  - Impact: Some jobs timeout prematurely, others hold resources too long
  - Effort: 20 min

- [ ] **Queue add errors silently swallowed** - `src/lib/queue/workers/lineups.worker.ts:52-72`
  - Issue: Prediction queue add errors caught but not returned
  - Fix: Include in job result for visibility
  - Impact: Silent prediction job failures
  - Effort: 10 min

---

## Suggested Implementation Order

### Batch A: Database Optimization (1.5 hours)
1. Fix N+1 in settleBetsTransaction (30 min)
2. Make createBets private (10 min)
3. Fix undefined returns (15 min)
4. Fix cache failure handling (15 min)
5. Add composite index (5 min)

### Batch B: API Hardening (2 hours)
1. Rate limiter improvements (30 min)
2. CORS configuration (20 min)
3. Request body limits (20 min)
4. CSRF protection (45 min)
5. Admin error sanitization (15 min)

### Batch C: External API Robustness (2.5 hours)
1. Consolidate fetchFromAPI (45 min)
2. Improve error handling (30 min)
3. Response validation (30 min)
4. Timeout configurability (20 min)
5. Rate limit improvements (15 min)

### Batch D: Queue Improvements (2 hours)
1. Job deduplication (20 min)
2. Global rate limiting (60 min)
3. Auto-cleanup for cancelled matches (30 min)
4. Connection management (20 min)
5. DLQ improvements (10 min)

### Batch E: Cache & TTL Tuning (1.5 hours)
1. TTL adjustments for live events (10 min)
2. Null value caching (20 min)
3. Connection pooling (20 min)
4. Cache warming verification (20 min)
5. Health check improvement (15 min)

---

## Notes

- Issues are grouped by subsystem for easier batch fixing
- Line numbers reference code state at analysis time (2026-01-23)
- Some issues may be interdependent - check before implementing
- Consider addressing related issues together (e.g., all rate limiting at once)
- Each issue includes estimated effort for planning

---

**Last Updated:** 2026-01-23  
**Total Remaining:** 62 MEDIUM + LOW issues  
**Next Batch:** After Batch 1 security fixes complete
