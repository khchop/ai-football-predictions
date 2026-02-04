---
phase: 32-make-failures-visible
plan: 02
wave: 2
subsystem: content-pipeline
tags: [bullmq, dlq, validation, retry, worker-config]

requires:
  - phase: 32
    plan: 01
    reason: "Error throwing infrastructure required for retry behavior"

provides:
  - "Content validation rejects invalid LLM output before database save"
  - "Worker lock duration prevents premature stalling"
  - "Heartbeat extends lock for long-running content generation"
  - "DLQ captures exhausted retries for manual review"
  - "Exponential backoff with 5 attempts for transient failures"

affects:
  - phase: 34
    plan: 01
    reason: "Backfill will use validated retry behavior"
  - phase: 36
    plan: 01
    reason: "Monitoring will track DLQ for failed jobs"

tech-stack:
  added: []
  patterns:
    - "BullMQ lock extension via heartbeat"
    - "Dead letter queue pattern for exhausted retries"
    - "Content validation before database save"
    - "Shared job options for consistency"

key-files:
  created: []
  modified:
    - "src/lib/content/match-content.ts"
    - "src/lib/queue/workers/content.worker.ts"
    - "src/lib/queue/index.ts"

decisions:
  - decision: "120-second lock duration"
    rationale: "Content generation takes 30-90s with LLM API calls"
    alternatives: ["60s (too short)", "300s (excessive)"]
    chosen: "120s balances safety with responsiveness"

  - decision: "30-second heartbeat interval"
    rationale: "Extends lock every 30s, well before 120s expiry"
    alternatives: ["60s (too risky)", "10s (too frequent)"]
    chosen: "30s provides 4x safety margin"

  - decision: "5 retry attempts with exponential backoff"
    rationale: "LLM APIs have transient failures, need multiple chances"
    alternatives: ["3 attempts (insufficient)", "10 attempts (excessive)"]
    chosen: "5 attempts: 30s, 1m, 2m, 4m, 8m (~15 min total)"

  - decision: "Concurrency 3"
    rationale: "Balance throughput with LLM API rate limits"
    alternatives: ["1 (too slow)", "5 (rate limit risk)"]
    chosen: "3 parallel jobs respects 30 req/min limit"

  - decision: "DLQ retention 7 days"
    rationale: "Failed jobs visible for manual review, auto-cleaned weekly"
    alternatives: ["1 day (too short)", "30 days (excessive)"]
    chosen: "7 days standard for operational troubleshooting"

metrics:
  duration: "3m 1s"
  completed: "2026-02-04"
---

# Phase 32 Plan 02: BullMQ Worker Configuration Summary

**One-liner:** Content worker with 120s lock, heartbeat extension, DLQ routing, and validation that rejects invalid LLM output

## What Was Delivered

**PIPE-02: Lock Duration & Heartbeat**
- Worker configured with 120-second `lockDuration`
- Heartbeat extends lock every 30 seconds for long jobs
- Stalled jobs detected at 30-second intervals
- Max 1 stall before job fails

**PIPE-03: Content Validation**
- `validateGeneratedContent()` function rejects:
  - Content shorter than minimum length (100 chars for prose)
  - Empty or whitespace-only content
  - Placeholder text (TODO, FIXME, [TEAM NAME], etc.)
  - LLM refusal patterns ("I cannot generate", "As an AI")
- Validation runs BEFORE database save
- FAQ-specific validation for question/answer minimum lengths

**PIPE-04: Dead Letter Queue**
- `CONTENT_DLQ` queue added to `QUEUE_NAMES`
- Failed jobs moved to DLQ after retry exhaustion
- DLQ jobs include full context (job data, error, stack trace, attempts)
- DLQ auto-cleans after 7 days

**Retry Configuration**
- `CONTENT_JOB_OPTIONS` shared across all content jobs
- 5 retry attempts with exponential backoff
- Backoff delays: 30s → 1m → 2m → 4m → 8m (~15 min total)
- Failed jobs retained 7 days for DLQ visibility

**Worker Configuration**
- Concurrency increased from 1 to 3 (per CONTEXT.md decision)
- Rate limiter: 30 requests per minute (respects Together AI limit)
- All event handlers log appropriately (completed, failed, stalled, error)

## Technical Implementation

### Task 1: Content Validation Helper

**File:** `src/lib/content/match-content.ts`

Added `validateGeneratedContent()` function after imports:
- Checks content length against configurable minimum (default 100 chars)
- Detects empty/whitespace-only content
- Pattern-matches 10 placeholder indicators
- Throws regular `Error` (caught by existing try/catch, wrapped in `RetryableContentError`)

Integrated validation in 4 content generation functions:
1. `generatePreMatchContent` - validates prose before DB save
2. `generateBettingContent` - validates prose before DB save
3. `generatePostMatchContent` - validates prose before DB save
4. `generateFAQContent` - validates each Q&A for minimum lengths

**Why validation works with retry:**
- Validation occurs BEFORE catch block
- Thrown errors caught by existing try/catch
- Wrapped in `RetryableContentError` with full diagnostic context (from Plan 01)
- BullMQ retries with exponential backoff
- LLM may produce valid content on subsequent attempts

### Task 2: Worker Lock & DLQ Configuration

**Files:** `src/lib/queue/workers/content.worker.ts`, `src/lib/queue/index.ts`

**Lock Configuration:**
```typescript
{
  lockDuration: 120000,      // 2 minutes
  stalledInterval: 30000,    // Check every 30s
  maxStalledCount: 1,        // Fail after 1 stall
}
```

**Heartbeat Pattern:**
```typescript
const heartbeatInterval = setInterval(async () => {
  if (job.token) {
    await job.extendLock(job.token, 120000); // Extend by 2 min
  }
}, 30000); // Every 30s

try {
  // Job processing
} finally {
  clearInterval(heartbeatInterval); // Always cleanup
}
```

**DLQ Implementation:**
- Added `CONTENT_DLQ: 'content-dlq'` to `QUEUE_NAMES`
- Updated `setupContentWorkerEvents()` to move exhausted jobs to DLQ
- DLQ job includes: original job data, error message, stack trace, attempts, timestamp
- Auto-cleanup after 7 days via `removeOnComplete`

### Task 3: Retry Configuration

**File:** `src/lib/queue/workers/content.worker.ts`

Created shared `CONTENT_JOB_OPTIONS`:
```typescript
const CONTENT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 30000, // 30s base
  },
  removeOnComplete: {
    age: 86400,    // 24 hours
    count: 100,
  },
  removeOnFail: {
    age: 604800,   // 7 days
  },
};
```

Updated 2 queue.add calls:
1. `scanMatchesNeedingPreviews()` - generates match preview jobs
2. `scanAndGenerateLeagueRoundups()` - generates league roundup jobs

All jobs now use consistent retry behavior via spread operator: `...CONTENT_JOB_OPTIONS`

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Context | Impact |
|----------|---------|--------|
| Validation throws regular Error, not RetryableContentError | Validation runs BEFORE catch block | Errors caught and wrapped with full context by existing error handling (Plan 01) |
| Heartbeat in finally block cleanup | Ensures interval always cleared | Prevents interval leak on job completion/failure |
| Concurrency 3 instead of 1 | Plan specified per CONTEXT.md | Increased throughput while respecting rate limits |
| DLQ auto-cleanup 7 days | Balance visibility with storage | Standard operational troubleshooting window |

## Success Criteria Met

- ✅ PIPE-02: Content queue uses 120-second lock duration
- ✅ PIPE-03: Content validation runs before database save
- ✅ PIPE-04: Failed jobs reach dead letter queue after retry exhaustion
- ✅ Worker has heartbeat pattern for long jobs
- ✅ Jobs configured with 5 attempts and exponential backoff
- ✅ DLQ jobs kept for 7 days

## Testing Notes

**Not yet tested** (requires running server):
- Lock extension during long-running jobs
- DLQ movement after 5 failed attempts
- Content validation rejection of invalid LLM output
- Stalled job detection at 30-second intervals

**Can be tested in Phase 34** (backfill execution):
- Validation will reject any placeholder text
- Retries will handle transient LLM API failures
- DLQ will capture exhausted retries

## Next Phase Readiness

**Ready for:**
- Phase 33 (HTML tag fixes) - worker configuration independent
- Phase 34 (backfill) - retry and validation infrastructure complete
- Phase 36 (monitoring) - DLQ ready for monitoring dashboard

**Blockers:** None

**Concerns:**
- Validation patterns may need tuning based on actual LLM output in production
- Heartbeat frequency (30s) chosen conservatively, could be optimized based on actual job durations

## Commits

```
0906a35 feat(32-02): add content validation helper
6a9cfec feat(32-02): configure worker with lock duration, heartbeat, and DLQ
8f0f9e3 feat(32-02): configure job retry settings
```

**Total:** 3 atomic commits (1 per task)

## Related Documentation

- **CONTEXT.md:** Concurrency 3, 5 retries, exponential backoff, 2-minute lock
- **RESEARCH.md:** Lock extension pattern (Pattern 5), DLQ implementation (Pattern 4)
- **32-01-SUMMARY.md:** Error throwing infrastructure (RetryableContentError, FatalContentError)
