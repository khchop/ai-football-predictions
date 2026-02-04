---
phase: 32-make-failures-visible
plan: 01
subsystem: error-handling
tags: [bullmq, error-handling, retry-logic, content-generation]

requires:
  - 31-investigation-diagnosis

provides:
  - error-throwing content generation
  - bullmq retry integration
  - diagnostic error context

affects:
  - 33-fix-html-tags
  - 34-restore-missing-content
  - 35-infrastructure-fixes

tech-stack:
  added: []
  patterns:
    - error-throwing functions
    - bullmq UnrecoverableError
    - diagnostic error context

key-files:
  created:
    - src/lib/errors/content-errors.ts
  modified:
    - src/lib/content/match-content.ts
    - src/lib/queue/workers/content.worker.ts
    - scripts/backfill-post-match-content.ts
    - scripts/regenerate-post-match-content.ts
    - src/app/api/admin/generate-faq/route.ts
    - src/app/api/cron/generate-content/route.ts

decisions:
  - title: "Use BullMQ UnrecoverableError for fatal errors"
    rationale: "BullMQ provides UnrecoverableError specifically to signal non-retryable failures. Extending this class prevents unnecessary retry attempts for match-not-found and match-not-finished cases."
    alternatives: ["Custom fatal error class", "Error codes in message"]
    impact: "Reduces wasted retry attempts and API costs"

  - title: "Include diagnostic context in all errors"
    rationale: "Context (matchId, teams, contentType, timestamp, originalError) enables proper debugging and monitoring without needing to correlate logs across systems."
    alternatives: ["Minimal error messages", "Log context separately"]
    impact: "Improved observability and faster debugging"

  - title: "Worker scan job continues on individual failures"
    rationale: "The scan job (which processes 10 matches per run) should not halt entirely if one match fails. Individual content generation jobs (when triggered directly by BullMQ) will throw and retry properly."
    alternatives: ["Fail entire scan on first error", "Queue individual jobs instead of inline processing"]
    impact: "More robust backfill process"

duration: 5min
completed: 2026-02-04
---

# Phase 32 Plan 01: Make Failures Visible Summary

**One-liner:** Converted content generation from silent return false to proper error throwing with BullMQ retry integration and diagnostic context

## What Was Built

Replaced the silent failure pattern (`return false`) in all content generation functions with proper error throwing, enabling BullMQ's retry mechanism and dead letter queue visibility. Created custom error classes that distinguish between retryable (network/API failures) and fatal (match not found) errors, with full diagnostic context for debugging.

## Tasks Completed

| Task | Commit | Files | Result |
|------|--------|-------|--------|
| 1. Create content error classes | 4da375d | src/lib/errors/content-errors.ts | RetryableContentError and FatalContentError classes with diagnostic context |
| 2. Convert match-content.ts to throw errors | 6d99b26 | src/lib/content/match-content.ts, 2 scripts | All 4 functions now throw instead of return false |
| 3. Update content worker | d21cdd3 | src/lib/queue/workers/content.worker.ts | Removed boolean checks, added try/catch for scan robustness |
| 4. Fix API routes (deviation) | f7da003 | 2 API route files | Updated routes to handle void signatures |

**Total commits:** 4 (3 planned tasks + 1 deviation)

## Technical Implementation

### Error Class Architecture

Created two error types in `src/lib/errors/content-errors.ts`:

1. **RetryableContentError** (extends Error)
   - For transient failures (network errors, rate limits, API failures)
   - Includes context: matchId, homeTeam, awayTeam, contentType, timestamp, originalError
   - Triggers BullMQ retry with exponential backoff

2. **FatalContentError** (extends UnrecoverableError from BullMQ)
   - For permanent failures (match not found, match not finished)
   - Includes context: matchId, reason, timestamp
   - Prevents BullMQ retry attempts (moves to dead letter queue)

3. **classifyError() helper**
   - Determines if unknown errors should be retryable or fatal
   - Based on error message patterns (authentication, network, etc.)

### Function Signature Changes

All 4 content generation functions changed from `Promise<boolean>` to `Promise<void>`:

```typescript
// Before
export async function generatePreMatchContent(matchId: string): Promise<boolean> {
  try {
    // ... generation logic
    return true;
  } catch (error) {
    log.error('Failed');
    return false; // Silent failure
  }
}

// After
export async function generatePreMatchContent(matchId: string): Promise<void> {
  let match: typeof matches.$inferSelect | undefined;

  try {
    // ... generation logic
    // Success = no throw
  } catch (error) {
    if (error instanceof FatalContentError) throw error;

    throw new RetryableContentError('Pre-match content failed', {
      matchId,
      homeTeam: match?.homeTeam || 'Unknown',
      awayTeam: match?.awayTeam || 'Unknown',
      contentType: 'pre-match',
      timestamp: new Date().toISOString(),
      originalError: error,
    });
  }
}
```

### Worker Integration

Updated `scanMatchesMissingContent` in content.worker.ts to handle void-returning functions:

```typescript
// Before
const success = await generatePreMatchContent(match.matchId);
if (success) {
  results.preMatch.generated++;
} else {
  results.preMatch.failed++;
}

// After
try {
  await generatePreMatchContent(match.matchId);
  results.preMatch.generated++;
} catch (err) {
  results.preMatch.failed++;
  // Scan continues, individual jobs will retry via BullMQ
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript errors in API routes**
- **Found during:** Task 2 verification
- **Issue:** Two API routes (`generate-faq`, `generate-content`) were checking boolean return values that no longer exist, causing TypeScript compilation errors
- **Fix:** Removed boolean checks, functions now throw errors that propagate to catch blocks
- **Files modified:** `src/app/api/admin/generate-faq/route.ts`, `src/app/api/cron/generate-content/route.ts`
- **Commit:** f7da003

**Rationale:** These compilation errors blocked TypeScript verification and would have prevented deployment. The fix was straightforward - remove boolean checks and let errors propagate naturally through try/catch blocks that already existed.

## Verification Results

All verification criteria passed:

1. **TypeScript compilation:** `npx tsc --noEmit` passes (excluding pre-existing test file errors)
2. **No silent failures:** 0 instances of `return false` in match-content.ts
3. **Error throwing:** 10 instances of `throw new` in match-content.ts (FatalContentError + RetryableContentError)
4. **Error classes exist:** RetryableContentError, FatalContentError, and classifyError exported from content-errors.ts

## Integration Points

### Upstream Dependencies
- **Phase 31 (Investigation):** Confirmed root cause was silent failures, not broken queue system
- **BullMQ:** Relies on BullMQ's retry mechanism and UnrecoverableError pattern

### Downstream Impact
- **Phase 33 (Fix HTML Tags):** Can now detect when HTML tag fixing fails (errors will be visible in DLQ)
- **Phase 34 (Restore Content):** Backfill jobs will properly retry transient failures and track permanent failures
- **Phase 35 (Infrastructure):** Error monitoring can distinguish between fatal and retryable failures

### Side Effects
- **Existing error logs:** Error messages now include full diagnostic context (may increase log volume slightly)
- **BullMQ dashboard:** Failed jobs now appear in failed queue with proper error context
- **Scripts:** All scripts using these functions updated to handle void return (no more boolean checks)

## Next Phase Readiness

**Phase 32 Plan 02 (Implement DLQ):** Ready to proceed

**Blockers:** None

**Open questions:** None

## Decisions Made

See frontmatter `decisions` section.

## Lessons Learned

1. **Error context is crucial:** Including matchId, teams, and contentType in every error made debugging trivial. Future error classes should follow this pattern.

2. **UnrecoverableError is powerful:** BullMQ's built-in UnrecoverableError prevents wasted retry attempts for truly fatal errors (match not found). This is better than custom retry logic.

3. **Variable scope in try/catch:** TypeScript requires careful variable scoping when referencing variables from try block in catch block. Declaring `let match` outside try block solved this.

4. **Scan job robustness:** The worker scan job should be resilient to individual failures - catching errors and continuing ensures backfill progresses even when some matches fail.

## Stats

- **Files created:** 1
- **Files modified:** 6
- **Lines added:** ~200
- **Lines removed:** ~40
- **Commits:** 4
- **Duration:** 5 minutes

---

**Phase 32-01 complete.** Content generation failures are now visible and retryable. Ready for Phase 32-02: Implement Dead Letter Queue.
