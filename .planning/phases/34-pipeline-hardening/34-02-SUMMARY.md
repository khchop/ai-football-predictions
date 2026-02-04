---
phase: 34-pipeline-hardening
plan: 02
subsystem: infra
tags: [bullmq, sentry, monitoring, alerting, worker-health]

# Dependency graph
requires:
  - phase: 34-01
    provides: Queue circuit breaker for rate limit handling
provides:
  - Worker health monitoring via getWorkers() and stalled detection
  - Content completeness monitoring for finished matches
  - Scheduled monitoring jobs (5min health check, hourly completeness)
affects: [35-backfill-content, 36-monitoring-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [scheduled-monitoring-jobs, sentry-alerting-on-anomalies]

key-files:
  created:
    - src/lib/queue/monitoring/worker-health.ts
    - src/lib/queue/monitoring/content-completeness.ts
    - src/lib/queue/monitoring/index.ts
  modified:
    - src/lib/queue/setup.ts
    - src/lib/queue/workers/content.worker.ts
    - src/lib/queue/types.ts

key-decisions:
  - "5-minute stalled threshold for worker health (2x lockDuration margin)"
  - "Sentry warning level for missing content (not error - self-healing via backfill)"
  - "Cron pattern */5 * * * * for health check (frequent enough to catch issues early)"

patterns-established:
  - "Monitoring jobs run as content queue tasks: low overhead, uses existing worker"
  - "Health check allows 0 workers if no stalled jobs: avoids false positives during idle"

# Metrics
duration: 3min
completed: 2026-02-04
---

# Phase 34 Plan 02: Worker Heartbeat Monitoring Summary

**Worker health monitoring via BullMQ getWorkers() API with Sentry alerting for dead workers and content gaps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T16:18:05Z
- **Completed:** 2026-02-04T16:21:21Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Worker health check detects missing workers and stalled jobs (>5 min active)
- Content completeness check finds finished matches missing post-match content
- Scheduled monitoring runs automatically (health every 5min, completeness hourly)
- Sentry alerts provide actionable details (queue name, stalled job IDs, match samples)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create worker health monitoring module** - `20f942c` (feat)
2. **Task 2: Create content completeness monitoring module** - `516368c` (feat)
3. **Task 3: Create monitoring index and integrate with scheduler** - `8bf2537` (feat)

## Files Created/Modified
- `src/lib/queue/monitoring/worker-health.ts` - Worker health check via getWorkers() and stalled detection
- `src/lib/queue/monitoring/content-completeness.ts` - Finished match content gap detection
- `src/lib/queue/monitoring/index.ts` - Barrel exports for monitoring module
- `src/lib/queue/setup.ts` - Added repeatable monitoring jobs
- `src/lib/queue/workers/content.worker.ts` - Handlers for monitoring job types
- `src/lib/queue/types.ts` - Added monitoring types to GenerateContentPayload

## Decisions Made
- Used 5-minute threshold for stalled job detection (2x safety margin over 2-min lock duration)
- Health check is "healthy" if workers exist OR no stalled jobs (idle queue is OK)
- Content completeness uses warning level in Sentry (not error) since backfill auto-heals
- Scheduled monitoring as content queue jobs (reuses existing worker infrastructure)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Monitoring infrastructure ready for Phase 35 (backfill content)
- Alerts will fire if workers die or content gaps appear
- Can add more queue health checks by extending checkWorkerHealth to other queues

---
*Phase: 34-pipeline-hardening*
*Completed: 2026-02-04*
