---
phase: 31-investigation-diagnosis
plan: 01
subsystem: diagnostics
tags: [database, bullmq, redis, workers, queue, content-generation]

# Dependency graph
requires:
  - phase: 30-match-page-rewrite
    provides: Match page with content sections expecting generated content
provides:
  - Complete diagnostic report identifying root cause of content generation failure
  - Database audit with quantified impact (5 matches affected)
  - Worker health assessment confirming server not running
  - Evidence-based root cause analysis (HIGH confidence)
affects: [32-make-failures-visible, 33-fix-generation-triggers, 34-backfill-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [diagnostic-queries, process-inspection, root-cause-methodology]

key-files:
  created:
    - .planning/phases/31-investigation-diagnosis/31-INVESTIGATION.md
  modified: []

key-decisions:
  - "Root cause confirmed: Application server not running (workers never started)"
  - "REDIS_URL missing from environment (required for BullMQ queue system)"
  - "Post-match content uses different generation mechanism (not dependent on workers)"

patterns-established:
  - "Database audit methodology: timeline analysis, content completeness queries, quality checks"
  - "Worker health checks: process inspection, environment validation, architecture review"
  - "Root cause analysis: hypothesis testing, alternative cause elimination, confidence levels"

# Metrics
duration: 4min
completed: 2026-02-04
---

# Phase 31 Plan 01: Investigation & Diagnosis Summary

**Database audit reveals 5 matches missing pre-match/betting content due to application server not running since 2026-02-01 evening**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-04T12:22:49Z
- **Completed:** 2026-02-04T12:26:30Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Confirmed root cause: Application server not running (HIGH confidence)
- Quantified impact: 5 matches (5%) missing pre-match and betting content
- Identified missing REDIS_URL configuration blocking queue system initialization
- Documented evidence-based root cause analysis ruling out alternative hypotheses

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Database audit + Worker health check** - `1749f5a` (docs)
   - Database queries showing 5 matches missing content since 2026-02-01
   - Process inspection confirming no server running
   - REDIS_URL missing from environment

**Plan metadata:** Included in task commit (diagnostic phase)

## Files Created/Modified

- `.planning/phases/31-investigation-diagnosis/31-INVESTIGATION.md` - Complete diagnostic report with database audit, worker health check, timeline correlation, and root cause analysis with HIGH confidence level

## Decisions Made

1. **Root cause determination:** Application server not running (workers never started)
   - **Confidence:** HIGH
   - **Evidence:** No server process, missing REDIS_URL, worker architecture requires server boot
   - **Impact:** Pre-match and betting content generation completely halted

2. **Alternative causes ruled out:**
   - Silent failures: Ruled out (post-match content works, proving generation functions operational)
   - Rate limits: Ruled out (no workers running to make API calls)
   - Worker crashes: Ruled out (workers never started)
   - Scheduling issues: Ruled out (requires Redis connection)

3. **Post-match content mechanism identified:**
   - Works independently of queue workers
   - Likely triggered synchronously via API route or webhook after match settlement
   - Explains why post-match content continued working while pre-match/betting stopped

## Deviations from Plan

None - plan executed exactly as written. All database queries, worker health checks, and root cause analysis completed as specified.

## Issues Encountered

1. **Type casting required for SQL queries:**
   - **Issue:** `kickoff_time` stored as TEXT in database, not TIMESTAMP
   - **Resolution:** Added `::timestamp` type casts to all date comparison queries
   - **Impact:** Minor - queries ran successfully after correction

2. **No Redis CLI access:**
   - **Issue:** Cannot inspect BullMQ queue state, DLQ, or job history directly
   - **Resolution:** Inferred queue health from process inspection and environment check
   - **Impact:** Cannot see job history, but root cause clear from server/environment status

3. **No worker logs accessible:**
   - **Issue:** Cannot determine exact shutdown time or reason from logs
   - **Resolution:** Used database timestamps to infer shutdown window (after 2026-02-01 19:31 UTC)
   - **Impact:** Minor - timeline sufficiently precise for root cause determination

## User Setup Required

None - this is a diagnostic phase. No code changes or service configuration.

## Next Phase Readiness

**Ready for Phase 32 (Make Failures Visible):**
- Root cause confirmed with HIGH confidence
- Impact quantified: 5 matches affected, specific date range identified
- Architecture understood: scan_match_content worker dependency mapped
- Blockers identified: Missing REDIS_URL, server not running

**Blockers for future phases:**
- Server must be started with valid REDIS_URL before content generation can resume
- Verify workers start successfully via logs (check instrumentation.ts initialization)
- Confirm scan_match_content job executes hourly as scheduled

**Concerns:**
- Silent failure pattern still exists in code (functions return false instead of throwing)
- Phase 32 should make these failures visible before Phase 33 fixes them
- Post-match content mechanism should be documented for consistency

---
*Phase: 31-investigation-diagnosis*
*Completed: 2026-02-04*
