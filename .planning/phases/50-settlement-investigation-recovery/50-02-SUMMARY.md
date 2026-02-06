---
phase: 50-settlement-investigation-recovery
plan: 02
subsystem: queue-settlement
tags: [admin-api, backfill, settlement, retry, dlq, idempotent]
status: complete

# Dependencies
requires:
  - 50-01 # Investigation script + conditional retry logic
provides:
  - admin-settlement-retry-api
  - zero-prediction-detection
  - settlement-backfill-script
affects:
  - 50-03 # Will use backfill script for comprehensive settlement
  - 50-04 # Admin API for monitoring/recovery

# Tech Stack
tech-stack:
  added:
    - none # Uses existing infrastructure
  patterns:
    - admin-retry-pattern # Fetch failed jobs, remove, re-queue with fresh data
    - idempotent-job-ids # settle-retry-*, settle-backfill-*, settle-zero-pred-*
    - dual-source-retry # Retry from both queue.getFailed() and DLQ

# Files
key-files:
  created:
    - src/app/api/admin/settlement/retry/route.ts
    - scripts/backfill-settlement.ts
  modified:
    - src/lib/queue/workers/backfill.worker.ts

# Decisions
decisions:
  - id: SETTLE-RETRY-01
    title: Admin retry fetches fresh match data from DB
    rationale: Failed jobs may have stale data; fresh data ensures accuracy
    alternatives: [Re-queue original job data]
    chosen: Fetch from DB via getMatchById

  - id: SETTLE-RETRY-02
    title: Retry from both queue.getFailed() and DLQ
    rationale: Failed jobs may exist in either location; both must be handled
    pattern: Same dual-source pattern as admin DLQ endpoint

  - id: SETTLE-RETRY-03
    title: Backfill worker detects zero-prediction matches
    rationale: Automated hourly detection ensures pipeline gaps are caught
    implementation: Step 6 in backfill.worker.ts after scoring step
    priority: Lower priority (2 vs 1) since scoring worker handles conditional retry

  - id: SETTLE-BACKFILL-01
    title: Backfill script uses two separate jobId patterns
    rationale: Distinguish pending-prediction vs zero-prediction matches for debugging
    patterns: [settle-backfill-*, settle-backfill-zero-*]
    idempotent: true

# Metrics
duration: 178s
completed: 2026-02-06
---

# Phase 50 Plan 02: Settlement Retry & Backfill Summary

**One-liner:** Admin retry API for failed settlement jobs + backfill worker zero-prediction detection + one-shot settlement backfill script

## What Was Built

### Admin Settlement Retry API

Created `/api/admin/settlement/retry` endpoint with two operations:

**POST** - Retry failed settlement jobs:
- Fetches failed jobs from `settlementQueue.getFailed()`
- Fetches settlement jobs from DLQ via `getDeadLetterJobs()`
- For each failed job:
  1. Remove from queue/DLQ
  2. Fetch fresh match data via `getMatchById()`
  3. Skip if match not found or not finished
  4. Re-queue with idempotent jobId: `settle-retry-${matchId}` or `settle-retry-dlq-${matchId}`
- Returns: `{ retriedFromQueue, retriedFromDlq, skipped, errors }`

**DELETE** - Clear failed jobs without retrying:
- Removes all failed jobs from settlement queue
- Removes all settlement entries from DLQ
- Returns: `{ clearedFromQueue, clearedFromDlq }`

**Auth & Rate Limiting:**
- Uses `requireAdminAuth()` for authentication
- Rate limited to 10 req/min via `RATE_LIMIT_PRESETS.admin`
- Follows same pattern as existing admin DLQ endpoint

### Extended Backfill Worker

Added step 6 to `backfill.worker.ts` (after step 5 scoring):

```typescript
// 6. Find finished matches with zero predictions (may need upstream pipeline re-run)
const zeroPredictionMatches = await getFinishedMatchesWithZeroPredictions(7);
```

- Calls `getFinishedMatchesWithZeroPredictions(7)` to find finished matches with no predictions
- Queues settlement jobs with idempotent jobId: `settle-zero-pred-${matchId}`
- Uses priority 2 (lower than normal settlement)
- Scoring worker will handle conditional retry logic (analysis exists → retry, no analysis → skip)

### One-Shot Settlement Backfill Script

Created `scripts/backfill-settlement.ts`:

**Purpose:** Settle all finished matches from last N days (default 7)

**Coverage:**
1. Matches with pending predictions → `getMatchesNeedingScoring()`
2. Matches with zero predictions → `getFinishedMatchesWithZeroPredictions(days)`

**Features:**
- CLI argument: `--days N` (default 7)
- Idempotent jobIds: `settle-backfill-${matchId}`, `settle-backfill-zero-${matchId}`
- Priority 1 for pending predictions (high), priority 2 for zero-prediction matches (lower)
- Checks for existing jobs to prevent duplicates
- Prints detailed summary with stats and errors

**Output:**
```
Matches with pending predictions: N
Matches with zero predictions:    M
Jobs queued:                      K
Duplicates skipped:               L
Errors:                           X
```

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a4bc59d | Admin settlement retry API + extended backfill worker |
| 2 | a95a077 | One-shot settlement backfill script |

## Decisions Made

1. **Admin retry fetches fresh match data** - Failed jobs may have stale scores/status; always fetch from DB for accuracy
2. **Retry from both queue.getFailed() and DLQ** - Jobs can fail into either location; dual-source ensures complete coverage
3. **Backfill worker runs hourly zero-prediction detection** - Automated detection ensures pipeline gaps are caught without manual intervention
4. **Separate jobId patterns for pending vs zero-prediction** - Debugging benefit: `settle-backfill-*` vs `settle-backfill-zero-*`
5. **All operations use idempotent jobIds** - Safe to run multiple times; BullMQ rejects duplicate jobIds

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Admin Retry Pattern

```typescript
// 1. Get failed jobs from queue
const failedJobs = await settlementQueue.getFailed(0, -1);

// 2. For each job: remove, fetch fresh data, re-queue
await job.remove();
const matchData = await getMatchById(matchId);
await settlementQueue.add(JOB_TYPES.SETTLE_MATCH, {...}, { jobId: `settle-retry-${matchId}` });

// 3. Also check DLQ
const dlqJobs = await getDeadLetterJobs(1000, 0);
const settlementDlqJobs = dlqJobs.filter(j => j.queueName === 'settlement-queue');
// ... same pattern: fetch fresh data, re-queue, delete from DLQ
```

### Idempotent Job Patterns

| Context | Pattern | Purpose |
|---------|---------|---------|
| Admin retry (queue) | `settle-retry-${matchId}` | Retry from failed queue |
| Admin retry (DLQ) | `settle-retry-dlq-${matchId}` | Retry from DLQ |
| Backfill worker | `settle-zero-pred-${matchId}` | Hourly zero-prediction detection |
| Backfill script (pending) | `settle-backfill-${matchId}` | One-shot pending settlement |
| Backfill script (zero) | `settle-backfill-zero-${matchId}` | One-shot zero-prediction settlement |

All patterns prevent duplicate processing via BullMQ's jobId uniqueness constraint.

## Verification Results

**Build:** ✓ Passed (webpack build successful)

**Admin API:**
- ✓ POST /api/admin/settlement/retry exists
- ✓ DELETE /api/admin/settlement/retry exists
- ✓ Uses `requireAdminAuth()` + `RATE_LIMIT_PRESETS.admin`
- ✓ Follows same pattern as admin DLQ endpoint

**Backfill Worker:**
- ✓ Imports `getFinishedMatchesWithZeroPredictions`
- ✓ Step 6 added after scoring step
- ✓ Uses priority 2 for zero-prediction jobs

**Backfill Script:**
- ✓ Compiles with tsx
- ✓ Supports `--days N` argument
- ✓ Uses idempotent jobIds
- ✓ Covers both pending and zero-prediction matches
- ✓ Prints detailed summary

**Idempotency:**
- ✓ All job operations check for existing jobs before queuing
- ✓ Running twice produces no duplicates (BullMQ jobId constraint)

## Requirements Validated

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SETTLE-03 | ✓ | Backfill worker detects zero-prediction matches (step 6) |
| SETTLE-04 | ✓ | Admin retry API created for failed settlement jobs |

## Integration Points

**Dependencies:**
- `src/lib/queue/index.ts` - getSettlementQueue, JOB_TYPES
- `src/lib/queue/dead-letter.ts` - getDeadLetterJobs, deleteDeadLetterEntry
- `src/lib/db/queries.ts` - getMatchById, getMatchesNeedingScoring, getFinishedMatchesWithZeroPredictions
- `src/lib/utils/rate-limiter.ts` - Rate limiting
- `src/lib/utils/admin-auth.ts` - Admin authentication

**Used By:**
- Phase 50-03: Comprehensive settlement backfill using script
- Phase 50-04: Admin monitoring dashboard showing retry stats

## Next Phase Readiness

**Ready for Phase 50-03:**
- ✓ Backfill script ready to run for comprehensive settlement
- ✓ Admin retry API available for manual intervention
- ✓ Backfill worker will catch future zero-prediction matches automatically

**Blockers:** None

**Concerns:** None

## Production Deployment Notes

**Before deploying:**
1. Verify REDIS_URL configured in production environment
2. Test admin API with production credentials

**After deploying:**
1. Run investigation script from 50-01: `npx tsx scripts/investigate-settlement-failures.ts`
2. If failed jobs exist, run admin retry: `POST /api/admin/settlement/retry`
3. Run backfill script for comprehensive settlement: `npx tsx scripts/backfill-settlement.ts`
4. Monitor settlement queue via admin dashboard
5. Backfill worker will now automatically catch zero-prediction matches hourly

**Usage:**

```bash
# Investigate failures
npx tsx scripts/investigate-settlement-failures.ts

# Retry failed jobs via API
curl -X POST https://kroam.xyz/api/admin/settlement/retry \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Comprehensive backfill (last 7 days)
npx tsx scripts/backfill-settlement.ts

# Custom lookback window
npx tsx scripts/backfill-settlement.ts --days 14

# Clear failed jobs without retrying
curl -X DELETE https://kroam.xyz/api/admin/settlement/retry \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Self-Check: PASSED

**Created files:**
- ✓ src/app/api/admin/settlement/retry/route.ts
- ✓ scripts/backfill-settlement.ts

**Modified files:**
- ✓ src/lib/queue/workers/backfill.worker.ts

**Commits:**
- ✓ a4bc59d (Task 1)
- ✓ a95a077 (Task 2)
