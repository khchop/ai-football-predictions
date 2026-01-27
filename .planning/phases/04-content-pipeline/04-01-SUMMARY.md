---
phase: 04-content-pipeline
plan: "01"
subsystem: content-pipeline
tags: [bullmq, roundup, content-queue]
---

# Phase 4 Plan 1: BullMQ Content Queue for Post-Match Roundups

## Summary

Set up BullMQ content queue infrastructure for automatic post-match roundup generation. **Noted significant deviation**: Tasks 1 and 2 were already implemented in the codebase. Only Task 3 (content worker handler) required implementation.

**One-liner:** BullMQ roundup generation queue with 60-second delay from settlement to content worker

## Dependency Graph

| Relationship | Target | Description |
|--------------|--------|-------------|
| requires | Phase 3 | UI components for leaderboard display |
| provides | Plan 04-02 | Ready queue infrastructure for roundup generation |
| affects | Plan 04-02 | Content worker already wired to receive roundup jobs |

## Tech Stack

### Added

No new libraries. Using existing BullMQ infrastructure.

### Patterns Established

- Delayed job scheduling with 60-second delay (`delayMs: 60000`)
- Job deduplication via `jobId: roundup-{matchId}`
- Non-blocking roundup scheduling from settlement worker

## Key Files

### Created

No new files created.

### Modified

| File | Changes |
|------|---------|
| `src/lib/queue/types.ts` | Already contains `GenerateRoundupPayload` interface (lines 74-81) |
| `src/lib/queue/workers/scoring.worker.ts` | Already contains `schedulePostMatchRoundup` function (lines 306-336) |
| `src/lib/queue/workers/content.worker.ts` | Added `generate-roundup` handler and `generatePostMatchRoundupContent` function |

### Referenced

| File | Purpose |
|------|---------|
| `src/lib/queue/index.ts` | Queue constants (`QUEUE_NAMES.CONTENT`, `JOB_TYPES.GENERATE_ROUNDUP`) |

## Decisions Made

### Roundup Handler Placement

**Choice:** Add handler in existing content worker rather than creating new worker
**Rationale:** Content worker already handles similar content generation jobs (match_previews, league_roundups). Reuse existing worker reduces operational complexity.

### Placeholder Implementation

**Choice:** Placeholder function returns success immediately
**Rationale:** Plan 2 will implement actual roundup generation. This plan only sets up queue infrastructure. Placeholder allows queue to process jobs without errors.

## Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| Queue types export new job type | ✅ Verified | `GenerateRoundupPayload` exists in types.ts |
| schedulePostMatchRoundup queues with delay | ✅ Verified | Function exists in scoring.worker.ts (lines 306-336) |
| Settlement worker triggers roundup generation | ✅ Verified | Called at scoring.worker.ts:232 |
| Content worker accepts roundup jobs | ✅ Verified | Handler added at content.worker.ts:69-72 |

## Deviations from Plan

### Already Implemented (Not New Work)

**1. [Task 1] Add roundup job type and payload to queue types**

- **Status:** Already existed in codebase
- **Location:** `src/lib/queue/types.ts` lines 74-81
- **Finding:** `GenerateRoundupPayload` interface already defined with `type: 'generate-roundup'` and `data.matchId`/`data.triggeredAt`
- **Action:** No changes needed

**2. [Task 2] Create schedulePostMatchRoundup function in settlement worker**

- **Status:** Already existed in codebase (in scoring.worker.ts, not settlement.worker.ts)
- **Location:** `src/lib/queue/workers/scoring.worker.ts` lines 306-336
- **Finding:** Function already implements 60-second delay, job deduplication, proper logging
- **Note:** Plan referenced `settlement.worker.ts` but actual file is `scoring.worker.ts`
- **Action:** No changes needed

**3. [Task 3] Add roundup type handler to content worker**

- **Status:** Required implementation
- **Changes:**
  - Added `generate-roundup` case in job type switch (line 69)
  - Created `generatePostMatchRoundupContent` placeholder function (lines 480-502)
- **Action:** Implemented successfully

### No Authentication Gates

No authentication was required for this task.

## Metrics

| Metric | Value |
|--------|-------|
| Duration | ~5 minutes |
| Tasks completed | 1 of 3 (2 pre-existing) |
| Commits | 1 |

## Next Steps

Plan 04-02 will implement the actual roundup generation logic in `generatePostMatchRoundupContent` function. Queue infrastructure is now ready.

### Readiness for Plan 04-02

- ✅ Queue types defined
- ✅ Settlement worker schedules roundups
- ✅ Content worker receives roundup jobs
- ⏳ Roundup generation logic (placeholder)

---
*Generated: 2026-01-27*
