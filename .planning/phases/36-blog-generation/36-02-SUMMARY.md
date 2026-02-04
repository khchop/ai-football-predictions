---
phase: 36
plan: 02
subsystem: content-generation
tags: [error-handling, blog-generation, bullmq]
dependency-graph:
  requires: [32-01, 32-02]
  provides: [blog-error-handling, blog-scheduler-verification]
  affects: [production-blog-generation]
tech-stack:
  added: []
  patterns: [retryable-error-pattern, fatal-error-pattern]
key-files:
  created: []
  modified:
    - src/lib/content/generator.ts
decisions:
  - decision: "Use RetryableContentError for LLM failures"
    rationale: "Enables BullMQ retry mechanism for transient failures"
  - decision: "Use FatalContentError for validation failures"
    rationale: "Hallucination detection is permanent failure, no retry"
metrics:
  duration: 2min
  completed: 2026-02-04
---

# Phase 36 Plan 02: Blog Error Handling Summary

**One-liner:** Aligned blog generation (league roundups, model reports) with match content error handling pattern - RetryableContentError for LLM failures, FatalContentError for validation failures, verified schedulers

## What Actually Shipped

### Error Handling in generator.ts

1. **Import added:** `RetryableContentError` and `FatalContentError` from `@/lib/errors/content-errors`

2. **generateLeagueRoundup:**
   - Wrapped `generateWithTogetherAI` call in try-catch
   - LLM failures throw `RetryableContentError` (rate limits, network errors)
   - Validation failures throw `FatalContentError` (hallucination detected - permanent)
   - `sanitizeContent` already applied to all output fields before DB save

3. **generateModelReport:**
   - Wrapped `generateWithTogetherAI` call in try-catch
   - LLM failures throw `RetryableContentError`
   - `sanitizeContent` already applied to all output fields before DB save

### Worker Error Propagation (Verified - No Changes Needed)

Content worker (`content.worker.ts`) already correctly:
- Handles `league_roundup` and `model_report` job types (lines 86, 91)
- Re-throws errors in `generateLeagueRoundupContent` (line 408)
- Re-throws errors in `generateModelReportContent` (line 441)
- Errors propagate to BullMQ for retry logic and DLQ routing

### Job Schedulers (Verified - No Changes Needed)

Both schedulers already registered in `setup.ts`:
- **league-roundups-weekly:** `0 8 * * 1` (Monday 08:00 Europe/Berlin)
- **model-report-monthly:** `0 9 1 * *` (1st of month 09:00 Europe/Berlin)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add RetryableContentError to blog generation functions | c4179d7 | src/lib/content/generator.ts |
| 2 | Verify blog job error propagation (no changes needed) | N/A | Verification only |
| 3 | Verify job schedulers (no changes needed) | N/A | Verification only |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use `RetryableContentError` for LLM failures | Enables BullMQ retry mechanism with exponential backoff |
| Use `FatalContentError` for validation failures | Hallucination detection is permanent - no point retrying |
| Keep `contentType` as `post-match` for blog errors | Most similar to blog content nature in error context |
| No worker changes needed | Already follows correct error propagation pattern |

## Deviations from Plan

None - plan executed exactly as written. Tasks 2 and 3 were verification-only and confirmed existing implementation is correct.

## Verification Results

1. TypeScript compilation: PASS (build succeeds)
2. RetryableContentError in generator.ts: PASS (import + 2 throw statements)
3. Job schedulers exist: PASS (league-roundups-weekly, model-report-monthly)
4. Error propagation in worker: PASS (throw error in both content functions)
5. sanitizeContent in blog functions: PASS (24 total calls, includes blog functions)

## Next Phase Readiness

Ready for production deployment:
- Blog generation errors will now trigger BullMQ retries
- Failed jobs will route to DLQ after retry exhaustion
- Schedulers trigger weekly roundups and monthly reports
