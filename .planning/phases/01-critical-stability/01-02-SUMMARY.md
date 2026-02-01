---
phase: 01-critical-stability
plan: 02
subsystem: queue
tags: [bullmq, error-handling, retry-strategy, worker-isolation, defensive-programming]

# Dependency graph
requires:
  - phase: 01-01
    provides: Database pool configuration with health monitoring
provides:
  - Error classification system (retryable, unrecoverable, unknown)
  - Defensive worker processing with null checks and model isolation
  - Error-type-aware backoff strategy (rate-limit, timeout, parse, default)
  - Worker lifecycle event handlers for observability
affects: [02-data-accuracy, prediction-reliability, worker-stability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Error classification for intelligent retry (retryable vs unrecoverable)
    - Per-model isolation in batch processing (one failure doesn't affect others)
    - Backoff strategy tuned to error types (rate-limit: 60s, timeout: linear, parse: exponential)
    - Structured logging with child loggers per job

key-files:
  created: []
  modified:
    - src/lib/queue/types.ts
    - src/lib/queue/workers/predictions.worker.ts

key-decisions:
  - "Error classification: retryable (network/timeout), unrecoverable (match started/cancelled), unknown (default retry)"
  - "Backoff strategy: rate-limit 60s fixed, timeout linear (5s increments max 30s), parse exponential (5s→10s→20s), default exponential+jitter"
  - "Model isolation: each model wrapped in try-catch, failures don't affect other models in batch"
  - "Null validation: check matchData and rawResponse for null/malformed before processing"

patterns-established:
  - "classifyError/isRetryable pattern for error-aware retry logic"
  - "Child logger per job with jobId, matchId, attempt context"
  - "Worker event handlers (completed, failed, error) for lifecycle monitoring"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 01 Plan 02: Defensive Error Handling Summary

**Worker error classification with retry strategy, null validation, and per-model isolation preventing batch failures**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T01:44:34Z
- **Completed:** 2026-02-01T01:47:19Z
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- Error classification system distinguishes retryable (network/timeout) from unrecoverable (match started/cancelled) errors
- Null/malformed API response validation prevents worker crashes
- Per-model isolation ensures one model failure doesn't stop other models in batch
- Error-type-aware backoff strategy optimizes retry timing (rate-limit: 60s, timeout: linear, default: exponential+jitter)
- Worker lifecycle event handlers provide observability (completed, failed, error events)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define job types and result interfaces** - `ef67b74` (feat)
2. **Task 2: Add error classification helper** - `30681ae` (feat)
3. **Task 3: Implement defensive worker processing** - `059c5c9` (feat)
4. **Task 4: Configure backoff strategy and event handlers** - `41ea38f` (feat)

## Files Created/Modified
- `src/lib/queue/types.ts` - Added PredictionJobData, JobResult, JobStatus, WorkerConfig interfaces
- `src/lib/queue/workers/predictions.worker.ts` - Error classification, defensive processing, backoff strategy, event handlers

## Decisions Made

**Error classification approach:**
- Retryable errors: timeout, ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ECONNRESET, rate-limit, 429
- Unrecoverable errors: match started, cancelled, postponed, kickoff passed
- Unknown errors: default to retry with backoff (safer than failing immediately)

**Backoff strategy tuning:**
- Rate-limit (429): 60s fixed - respect API rate limit windows
- Timeout: Linear (attemptsMade × 5s, max 30s) - quick recovery for transient network issues
- Parse errors: Exponential (5s → 10s → 20s) - LLM response format issues may need time
- Default: Exponential with 20% jitter (max 60s) - prevents thundering herd

**Model isolation:**
- Each model wrapped in try-catch within batch loop
- Failures recorded but don't throw (continue to next model)
- Changed error logs to warn-level for isolated failures (not top-level exceptions)
- Only record model health after successful batch insert to prevent partial state

**Null validation:**
- Check `typeof matchData !== 'object'` - handles null and non-object responses
- Check `!rawResponse || typeof rawResponse !== 'string'` - validates API response before parsing
- Return skip result instead of crashing on null data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded as planned with all verification criteria met.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Worker can handle null/malformed API responses gracefully
- Error classification enables intelligent retry vs skip decisions
- Model isolation prevents single model failures from affecting entire batch
- Backoff strategy optimizes retry timing based on error type
- Lifecycle logging provides visibility into job execution

**No blockers or concerns.**

---
*Phase: 01-critical-stability*
*Completed: 2026-02-01*
