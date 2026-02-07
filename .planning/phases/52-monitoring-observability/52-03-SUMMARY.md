---
phase: 52-monitoring-observability
plan: 03
subsystem: monitoring
tags: [admin-api, bullmq, dlq, pipeline-health, settlement-failures, rate-limiting]

# Dependency graph
requires:
  - phase: 52-01
    provides: Pipeline coverage calculation module (getMatchCoverage, classifyGapsBySeverity)
  - phase: 50-settlement-investigation
    provides: Dead letter queue infrastructure and getDeadLetterJobs()
  - phase: 49-pipeline-scheduling-fixes
    provides: Settlement queue and retry patterns
provides:
  - Admin pipeline health endpoint for gap detection (MON-02)
  - Admin settlement failures endpoint for investigation + retry (MON-05)
  - Severity-classified gap reporting
  - Dual-source settlement failure tracking (queue + DLQ)
affects: [monitoring, observability, admin-tools, operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin endpoint pattern: rate limit → auth → business logic → sanitized errors"
    - "Dual-source failure tracking (queue.getFailed + DLQ) for complete visibility"
    - "Severity-classified health reporting (critical/warning/info)"
    - "Individual retry with fresh DB data pattern"

key-files:
  created:
    - src/app/api/admin/pipeline-health/route.ts
    - src/app/api/admin/settlement-failures/route.ts
  modified: []

key-decisions:
  - "Both endpoints use RATE_LIMIT_PRESETS.admin (10 req/min) to prevent abuse"
  - "Settlement failures endpoint truncates error messages to 300 chars to prevent sensitive data leakage"
  - "Pipeline health uses 6-hour window for early warning (enough time to investigate + fix)"
  - "POST /settlement-failures retries single match with fresh DB data (not stale job data)"
  - "Separate rate limit keys per HTTP method (GET vs POST) for fair quota allocation"

patterns-established:
  - "Pattern 1: Admin endpoints follow rate-limit-first, auth-second sequence (established in 50-02)"
  - "Pattern 2: Error sanitization via sanitizeError() in all admin endpoints (prevents stack trace leakage)"
  - "Pattern 3: Dual-source monitoring (queue + DLQ) for complete failure visibility"
  - "Pattern 4: Severity classification for actionable prioritization (critical < 2h, warning 2-4h, info 4-6h)"

# Metrics
duration: 2min 46sec
completed: 2026-02-07
---

# Phase 52 Plan 03: Admin Dashboard Endpoints Summary

**Admin endpoints for pipeline gap detection (6h window, severity-classified) and settlement failure investigation with individual retry capability**

## Performance

- **Duration:** 2 min 46 sec
- **Started:** 2026-02-07T02:04:40Z
- **Completed:** 2026-02-07T02:07:26Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created GET /api/admin/pipeline-health with coverage summary + severity-classified gaps (MON-02)
- Created GET /api/admin/settlement-failures showing failed jobs from both queue and DLQ (MON-05)
- Created POST /api/admin/settlement-failures for individual match retry with fresh DB data
- Established admin endpoint pattern: rate limit → auth → business logic → sanitized errors
- Both endpoints return actionable diagnostics with error reasons, timestamps, and source tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline health admin endpoint** - `6bbc24c` (feat)
2. **Task 2: Create settlement failures admin endpoint** - `4e408aa` (feat)

## Files Created/Modified
- `src/app/api/admin/pipeline-health/route.ts` - Admin endpoint returning matches within 6h of kickoff without scheduled jobs, classified by severity (critical/warning/info)
- `src/app/api/admin/settlement-failures/route.ts` - Admin endpoint for viewing failed settlement jobs (queue + DLQ) and retrying specific matches with fresh data

## Decisions Made

**1. Use 6-hour window for pipeline health**
- Rationale: Provides enough early warning time to investigate and fix gaps before critical threshold (2h to kickoff)
- Impact: Ops team gets actionable alerts with sufficient time to respond

**2. Truncate error messages to 300 chars**
- Rationale: Prevents sensitive data leakage (stack traces, connection strings, secrets) in admin responses
- Impact: Error reasons visible for debugging but sanitized for security

**3. Separate rate limit keys per HTTP method**
- Rationale: GET /settlement-failures (viewing) and POST (retrying) have different impact - separate quotas prevent GET spam from blocking POST
- Impact: Rate limits apply independently to each HTTP method on settlement-failures endpoint

**4. Retry with fresh DB data instead of stale job data**
- Rationale: Failed jobs may have outdated match status/scores; fresh DB lookup ensures accurate settlement
- Impact: Retries use current match state from database via getMatchById()

**5. Remove existing failed jobs before retry**
- Rationale: Prevents duplicate settlement attempts for same match with different jobIds
- Impact: Checks and removes settle-${matchId}, settle-retry-${matchId}, settle-zero-pred-${matchId} before re-queuing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - followed exact pattern from src/app/api/admin/settlement/retry/route.ts for consistency.

## User Setup Required

None - endpoints use existing admin authentication (X-Admin-Password header) and RATE_LIMIT_PRESETS.

## Next Phase Readiness

**Phase 52 Complete:**
- MON-01: ✅ Pipeline coverage calculation (52-01)
- MON-02: ✅ Admin pipeline health endpoint (52-03)
- MON-03: Health endpoint with metrics (52-02 - running in parallel)
- MON-04: Queue metrics extension (52-02 - running in parallel)
- MON-05: ✅ Settlement failures endpoint (52-03)

**API Reference:**
```bash
# Pipeline health (requires admin auth)
GET /api/admin/pipeline-health
# Returns: { summary, gapsBySeverity, matches: { critical, warning, info } }

# Settlement failures (requires admin auth)
GET /api/admin/settlement-failures
# Returns: { totalFailures, fromQueue, fromDlq, failures[] }

POST /api/admin/settlement-failures
# Body: { matchId: string }
# Returns: { success: true, matchId, message }
```

**No blockers:** Both endpoints operational and follow established admin security patterns.

---
*Phase: 52-monitoring-observability*
*Completed: 2026-02-07*

## Self-Check: PASSED
