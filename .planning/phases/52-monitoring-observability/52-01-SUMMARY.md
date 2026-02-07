---
phase: 52-monitoring-observability
plan: 01
subsystem: monitoring
tags: [bullmq, drizzle, coverage-calculation, pipeline-health]

# Dependency graph
requires:
  - phase: 49-pipeline-scheduling-fixes
    provides: Pipeline scheduling improvements and backfill workers
  - phase: 51-retroactive-backfill
    provides: Backfill script and pipeline reliability foundation
provides:
  - Core pipeline coverage calculation module
  - Match gap detection and severity classification
  - Shared types for health monitoring
affects: [52-02-health-endpoint, 52-03-admin-dashboard, monitoring, observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coverage calculation via DB + Redis comparison pattern"
    - "Severity classification by time-to-kickoff buckets"
    - "Shared monitoring types for multiple consumers"

key-files:
  created:
    - src/lib/monitoring/types.ts
    - src/lib/monitoring/pipeline-coverage.ts
  modified: []

key-decisions:
  - "Return 100% coverage when no upcoming matches (avoids false alerts during quiet periods)"
  - "Sort gaps by urgency (closest kickoff first) for actionable prioritization"
  - "Error handling with logging and re-throw (lets callers decide response strategy)"
  - "Query only 'scheduled' status matches (live/finished don't need pre-match jobs)"

patterns-established:
  - "Pattern 1: getMatchCoverage() is reusable by both health endpoint and admin dashboard"
  - "Pattern 2: classifyGapsBySeverity() splits gaps into critical/warning/info buckets"
  - "Pattern 3: No circular dependencies - monitoring imports from db/queue, not vice versa"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 52 Plan 01: Pipeline Coverage Calculation Summary

**Reusable coverage calculation module comparing scheduled matches against BullMQ jobs with gap detection and severity classification**

## Performance

- **Duration:** 2 min 17 sec
- **Started:** 2026-02-07T01:58:13Z
- **Completed:** 2026-02-07T02:00:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created shared monitoring types for MatchGap, MatchCoverageResult, and PipelineHealthSummary
- Implemented getMatchCoverage() to calculate pipeline coverage percentage
- Added gap detection for matches missing analysis or predictions jobs
- Built classifyGapsBySeverity() helper for critical/warning/info severity buckets
- Established foundation for health endpoint (Plan 02) and admin dashboard (Plan 03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monitoring types** - `620cf8a` (feat)
2. **Task 2: Create pipeline coverage calculation** - `fb094aa` (feat)

## Files Created/Modified
- `src/lib/monitoring/types.ts` - TypeScript interfaces for monitoring (MatchGap, MatchCoverageResult, PipelineHealthSummary)
- `src/lib/monitoring/pipeline-coverage.ts` - Core coverage calculation logic with gap detection and severity classification

## Decisions Made

**1. Return 100% coverage when no upcoming matches**
- Rationale: Avoids false alerts during quiet periods (e.g., international breaks, off-season)
- Impact: Health endpoint won't raise alarms when there's simply no work to do

**2. Sort gaps by urgency (closest kickoff first)**
- Rationale: Operations team needs actionable prioritization - fix nearest deadlines first
- Impact: Gap array is always sorted ascending by hoursUntilKickoff

**3. Error handling with logging and re-throw**
- Rationale: Callers (health endpoint, admin dashboard) need control over their own error response strategy
- Impact: Module logs error details at error level but lets caller decide HTTP status/retry behavior

**4. Query only 'scheduled' status matches**
- Rationale: Live/finished matches don't need new pre-match jobs scheduled
- Impact: Coverage calculation only considers matches that actually need jobs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with existing patterns from src/lib/db/queries.ts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Health Endpoint):**
- getMatchCoverage() exported and ready to use
- classifyGapsBySeverity() available for severity breakdown
- Types defined for response interfaces

**Ready for Plan 03 (Admin Dashboard):**
- Same coverage calculation module reusable
- PipelineHealthSummary interface ready for UI consumption

**No blockers:** Coverage calculation is self-contained, no external dependencies beyond existing DB and queue infrastructure.

---
*Phase: 52-monitoring-observability*
*Completed: 2026-02-07*

## Self-Check: PASSED
