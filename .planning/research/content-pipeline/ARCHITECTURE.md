# Architecture Patterns: Content Generation Pipeline Reliability

**Domain:** BullMQ-based content generation for AI football predictions
**Researched:** 2026-02-04
**Confidence:** HIGH (based on comprehensive codebase analysis)
**Focus:** Why content is NOT being generated and how to make it reliable

---

## Executive Summary

After comprehensive codebase analysis, the content generation pipeline has a well-designed architecture but suffers from **observability gaps** and **silent failure modes** that make diagnosing "no content" issues difficult. The system has multiple content generation paths with different trigger mechanisms, and failures in any part of this chain can result in missing content without clear error signals.

**Key Finding:** The architecture is fundamentally sound, but the failure modes are opaque. Content generation failures return `false` rather than throwing, making them invisible in job completion logs.

---

## Current Architecture

### Component Diagram

```
                                    CONTENT GENERATION FLOW

  +----------------+     +------------------+     +-------------------+
  |  Fixtures      |     |  Analysis        |     |  Predictions      |
  |  Worker        |---->|  Worker          |---->|  Worker           |
  |  (T-6h scan)   |     |  (T-6h per match)|     |  (T-30m per match)|
  +----------------+     +------------------+     +-------------------+
                                                           |
                                                           v
  +----------------+     +------------------+     +-------------------+
  |  Content       |     |  Scoring         |     |  Live Score       |
  |  Queue         |<----|  Worker          |<----|  Worker           |
  |  (scan jobs)   |     |  (post-match)    |     |  (match monitor)  |
  +----------------+     +------------------+     +-------------------+
         |
         v
  +--------------------------------------------------+
  |              CONTENT WORKER                       |
  |  - scan_matches (hourly at :10)                  |
  |  - scan_match_content (hourly at :15)            |
  |  - match_preview (per-match)                     |
  |  - generate-roundup (post-match)                 |
  |  - league_roundup (weekly Monday)                |
  |  - model_report (monthly)                        |
  +--------------------------------------------------+
         |
         v
  +--------------------------------------------------+
  |              TOGETHER AI                          |
  |  - Llama 4 Maverick 17B                          |
  |  - JSON structured responses                     |
  |  - Text prose responses                          |
  +--------------------------------------------------+
         |
         v
  +--------------------------------------------------+
  |              POSTGRESQL                           |
  |  - match_content table                           |
  |  - match_roundups table                          |
  |  - match_previews table                          |
  |  - blog_posts table                              |
  +--------------------------------------------------+
```

### Content Types and Trigger Points

| Content Type | Trigger | Queue Job | Storage |
|-------------|---------|-----------|---------|
| Pre-match (~150-200 words) | After odds refresh (T-6h) | `scan_match_content` backfill | `match_content.preMatchContent` |
| Betting (~150-200 words) | After predictions (T-30m) | `scan_match_content` backfill | `match_content.bettingContent` |
| Post-match (~150-200 words) | After scoring completes | `scoring.worker.ts` direct call | `match_content.postMatchContent` |
| Match Roundup (long-form) | After stats calculation | `generate-roundup` job | `match_roundups.narrative` |
| League Roundup | Weekly Monday 08:00 | `scan_league_roundups` | `blog_posts` |
| Match Preview | 1-6h before kickoff | `scan_matches` + `match_preview` | `match_previews` |

---

## Investigation Strategy

### Step 1: Identify the Break Point

The "no content" problem can occur at multiple points. Investigate in this order:

**1.1 Are jobs being scheduled?**
```bash
# Check repeatable jobs are registered
curl -H "X-Admin-Password: $ADMIN_PASSWORD" https://kroam.xyz/api/admin/queue-status | jq '.repeatable'

# Expected repeatable jobs for content:
# - scan-matches-repeatable (hourly at :10)
# - scan-match-content-repeatable (hourly at :15)
# - league-roundups-weekly (Monday 08:00)
# - model-report-monthly (1st of month 09:00)
```

**1.2 Are workers running?**
```bash
# Check worker logs for ready events
grep "Ready and listening" logs/*.log

# Check for content worker specifically
grep "worker:content" logs/*.log | tail -20
```

**1.3 Are jobs processing?**
```bash
# Check queue-status for active/completed jobs
curl -H "X-Admin-Password: $ADMIN_PASSWORD" https://kroam.xyz/api/admin/queue-status | jq '.queues["content-queue"]'

# Expected: completed > 0, failed low
```

**1.4 Are jobs succeeding but returning false?**

This is the **most likely culprit**. Content generation functions return `false` on failure instead of throwing:

```typescript
// From match-content.ts - failures are silent!
} catch (error) {
  log.error({ matchId, err: error.message }, 'Pre-match content generation failed');
  return false;  // <-- Job completes "successfully" with false result
}
```

Check job return values:
```bash
# Check job results for falsy returns
curl -H "X-Admin-Password: $ADMIN_PASSWORD" https://kroam.xyz/api/admin/queue-status | \
  jq '.recentJobs[] | select(.queue == "content-queue")'
```

**1.5 Is Together AI failing?**
```bash
# Check Together AI client logs
grep "together-client" logs/*.log | grep -E "(error|failed)"

# Common failures:
# - TOGETHER_API_KEY not set
# - Rate limiting (429)
# - JSON parsing errors
# - Timeout
```

**1.6 Is the database write failing?**
```bash
# Check for database errors in content logs
grep "content" logs/*.log | grep -E "(error|failed|constraint)"
```

### Step 2: Specific Failure Scenarios

**Scenario A: No Jobs in Queue**

Root cause: Workers not started or repeatable jobs not registered.

Investigation:
1. Check `instrumentation.ts` ran on startup
2. Check `setupRepeatableJobs()` completed
3. Check Redis connection is healthy

**Scenario B: Jobs Complete but Content Missing**

Root cause: Generation returning `false` without throwing.

Investigation:
1. Query database for `match_content` records with NULL fields
2. Check logs for "generation failed" without corresponding DLQ entries
3. Review Together AI error responses

**Scenario C: Jobs Failing and Retrying**

Root cause: Transient errors (rate limits, timeouts).

Investigation:
1. Check DLQ for exhausted jobs
2. Check job `attemptsMade` values
3. Review error messages in failed jobs

**Scenario D: Match Not Found for Content Generation**

Root cause: Timing issue - match not in correct status when content scan runs.

Investigation:
1. Check match status transitions
2. Verify `kickoffTime` calculations in query filters
3. Check timezone handling (Europe/Berlin vs UTC)

---

## Reliability Patterns

### Pattern 1: Idempotent Content Generation

**What:** Content generation should be safe to retry without duplicates.

**Implementation:**
```typescript
// GOOD: Upsert pattern (already implemented)
await db.insert(matchContent)
  .values({ id: contentId, matchId, ... })
  .onConflictDoUpdate({
    target: matchContent.matchId,
    set: { ... }
  });
```

**Status:** Already implemented correctly in `match-content.ts`.

### Pattern 2: Explicit Failure Signaling

**What:** Content generation failures should throw, not return false.

**Current Problem:**
```typescript
// BAD: Silent failure
} catch (error) {
  log.error({ matchId, err }, 'Failed');
  return false;  // Job "succeeds" but content missing
}
```

**Recommended:**
```typescript
// GOOD: Explicit failure for retries
} catch (error) {
  log.error({ matchId, err }, 'Failed');
  throw error;  // Job fails, triggers retry
}

// OR: Return result object
return { success: false, error: error.message };
```

### Pattern 3: Dead Letter Queue Utilization

**What:** Failed jobs should be inspectable in DLQ.

**Current Implementation:**
- DLQ exists at `src/lib/queue/dead-letter.ts`
- Jobs added when `attemptsMade >= opts.attempts`
- 30-day TTL, 1000 entry max

**Gap:** Non-blocking content generation (`generatePostMatchContent`) catches errors and doesn't throw, so never reaches DLQ.

### Pattern 4: Backfill Mechanism

**What:** Periodic scans find and fill content gaps.

**Current Implementation:**
- `scan_match_content` runs hourly at :15
- Queries for matches missing each content type
- Rate limited to 10 generations per scan

**Status:** Well designed, but relies on queries that may miss edge cases.

### Pattern 5: Circuit Breaker for LLM Calls

**What:** Protect against cascading failures from LLM provider issues.

**Current Implementation:**
- Uses `fetchWithRetry` with configured retry policy
- `TOGETHER_CONTENT_RETRY` config in retry-config.ts
- `TOGETHER_CONTENT_TIMEOUT_MS` timeout

**Gap:** No circuit breaker pattern - if Together AI is down, all jobs will fail and retry indefinitely until exhausted.

---

## Anti-Patterns Identified

### Anti-Pattern 1: Silent Failure Returns

**What happens:** Functions return `false` instead of throwing errors.
**Why bad:** Jobs appear successful, no DLQ entry, no retry.
**Location:** `generatePreMatchContent`, `generateBettingContent`, `generatePostMatchContent` in `src/lib/content/match-content.ts`

### Anti-Pattern 2: Non-Blocking Error Handling

**What happens:** `try/catch` logs error but continues.
**Why bad:** Downstream expects content, finds none.
**Location:** `src/lib/queue/workers/scoring.worker.ts` line 128-133:
```typescript
try {
  await generatePostMatchContent(matchId);
} catch (err) {
  log.warn({ matchId, err }, 'Post-match content generation failed (non-blocking)');
}
```

### Anti-Pattern 3: Multiple Content Tables

**What happens:** Content split across `match_content`, `match_roundups`, `match_previews`, `blog_posts`.
**Why bad:** Hard to audit completeness, complex queries.
**Mitigation:** `getMatchContentUnified` exists but adds complexity.

### Anti-Pattern 4: Timezone Assumptions

**What happens:** Cron jobs use `Europe/Berlin`, kickoff times use UTC strings.
**Why bad:** Edge cases around DST transitions, midnight crossings.
**Location:** `src/lib/queue/setup.ts` and query filters in `src/lib/content/queries.ts`.

---

## Monitoring and Alerting

### Current Monitoring

| Metric | Source | Gap |
|--------|--------|-----|
| Queue job counts | `/api/admin/queue-status` | No alerting |
| DLQ entries | `/api/admin/dlq` | Alert at 50 entries (log only) |
| Worker ready events | pino logs | No aggregation |
| Content generation success | logs | No metrics |
| Together AI errors | logs | No circuit breaker |

### Recommended Additions

**1. Content Generation Success Rate**
```typescript
// Track generation outcomes
metrics.increment('content.generation', {
  type: 'pre_match',
  success: result ? 'true' : 'false',
});
```

**2. Content Gap Alert**
```sql
-- Finished matches from last 24h without post-match content
SELECT COUNT(*) FROM matches m
LEFT JOIN match_content mc ON m.id = mc.match_id
WHERE m.status = 'finished'
  AND m.kickoff_time > NOW() - INTERVAL '24 hours'
  AND mc.post_match_content IS NULL;
```

**3. Queue Health Dashboard**
- Active workers by queue
- Job completion rate
- Average processing time
- Retry rate

---

## Component Boundaries

### Queue Layer (`src/lib/queue/`)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `index.ts` | Queue creation, connection | Redis |
| `scheduler.ts` | Match job scheduling | All queues |
| `setup.ts` | Repeatable job registration | Content queue |
| `catch-up.ts` | Startup recovery | All queues |
| `dead-letter.ts` | Failed job storage | Redis |

### Worker Layer (`src/lib/queue/workers/`)

| Component | Responsibility | Triggers Content |
|-----------|---------------|------------------|
| `content.worker.ts` | Content job processing | Directly generates |
| `scoring.worker.ts` | Match settlement | Calls `generatePostMatchContent` |
| `analysis.worker.ts` | Match data gathering | Enables pre-match content |
| `predictions.worker.ts` | AI predictions | Enables betting content |

### Content Layer (`src/lib/content/`)

| Component | Responsibility | Database Tables |
|-----------|---------------|-----------------|
| `match-content.ts` | 3-section match content | `match_content` |
| `generator.ts` | Long-form content | `match_previews`, `blog_posts`, `match_roundups` |
| `together-client.ts` | LLM API calls | N/A |
| `queries.ts` | Content-related queries | All content tables |

---

## Data Flow Analysis

### Happy Path: Post-Match Content

```
1. Live Score Worker detects match finished
   |-> Updates match.status = 'finished'
   |-> Adds job to settlement queue

2. Scoring Worker processes settlement
   |-> Scores all predictions
   |-> Calls generatePostMatchContent(matchId)
       |-> Queries match data
       |-> Queries predictions with scores
       |-> Builds prompt
       |-> Calls Together AI
       |-> Saves to match_content table
   |-> Triggers stats calculation
   |-> NOTE: Roundup now triggered by stats worker

3. Content available for frontend
```

### Failure Points

```
Point A: Live score worker fails to detect finish
|-- Recovery: catch-up.ts checks stuck matches every 2 min
|-- Symptom: match.status stays 'live' indefinitely

Point B: Settlement job fails
|-- Recovery: BullMQ retries 5 times with exponential backoff
|-- Recovery: Job goes to DLQ after exhaustion
|-- Symptom: predictions not scored, no content trigger

Point C: generatePostMatchContent fails silently
|-- NO RECOVERY: Error caught, returns false
|-- NO RECOVERY: No DLQ entry
|-- Symptom: match scored but no content

Point D: Together AI unavailable
|-- Recovery: fetchWithRetry handles transient errors
|-- Symptom: rate limit or timeout errors in logs

Point E: Database write fails
|-- Recovery: Transaction rollback, error thrown
|-- Symptom: Postgres constraint violation in logs
```

---

## Recommended Architecture Changes

### Priority 1: Make Content Failures Visible

**Change:** Modify content generation to throw on failure instead of returning false.

**Impact:** Jobs will fail properly, trigger retries, and eventually reach DLQ.

**Files:**
- `src/lib/content/match-content.ts`
- `src/lib/queue/workers/scoring.worker.ts`

### Priority 2: Add Content Completeness Check

**Change:** Add a periodic job that scans for content gaps and logs/alerts.

**Implementation:**
```typescript
// New job type: CHECK_CONTENT_GAPS
// Runs hourly
// Queries for finished matches without content
// Logs warning or triggers backfill
```

### Priority 3: Unified Content Status

**Change:** Add `content_status` enum to matches table.

**Values:** `none`, `partial`, `complete`
**Benefit:** Easy to query and monitor content completeness.

### Priority 4: Circuit Breaker for Together AI

**Change:** Implement circuit breaker pattern for LLM calls.

**Implementation:** Use existing `circuit-breaker.ts` pattern for content generation.

---

## Integration Points

### BullMQ Configuration

```typescript
// From index.ts - current configuration
defaultJobOptions: {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 30000,  // 30s -> 60s -> 120s -> 240s -> 480s
  },
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
}
```

### Redis Connection

```typescript
// From index.ts - connection handling
connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 500, 5000);
  },
});
```

### Together AI Configuration

```typescript
// From together-client.ts
const MODEL = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
const PRICING = {
  inputCostPerMillion: 0.27,
  outputCostPerMillion: 0.85,
};
```

---

## Sources

- Codebase analysis: `src/lib/queue/`, `src/lib/content/`, `src/lib/queue/workers/`
- BullMQ documentation: Best practices for job retries and DLQ
- Pino logging: Structured logging patterns

---

## Summary for Roadmap

The content generation pipeline architecture is well-designed with proper idempotency, retry mechanisms, and backfill capabilities. However, the **silent failure pattern** (returning `false` instead of throwing) creates a blind spot where content can be missing without any clear signal in monitoring systems.

**Phase recommendations:**

1. **Phase 1: Investigation** - Run the investigation steps to identify the specific break point
2. **Phase 2: Make Failures Visible** - Convert silent failures to thrown errors
3. **Phase 3: Improve Observability** - Add content completeness monitoring
4. **Phase 4: Harden Pipeline** - Add circuit breaker, improve backfill queries
