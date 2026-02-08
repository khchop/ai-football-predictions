---
phase: 58-observability-monitoring
plan: 03
subsystem: queue
tags: [bullmq, cron, pino, regression-detection, observability, cli-script, reporting]

# Dependency graph
requires:
  - phase: 58-01
    provides: "llm_model_stats table, aggregateDailyStats, detectRegressions query functions"
provides:
  - "BullMQ model-stats worker with daily cron aggregation at 00:05 UTC"
  - "Regression detection alerts via Pino structured logging (ERROR/WARN levels)"
  - "Startup backfill for missed cron windows from server restarts"
  - "Before/after comparison report generator CLI script"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["BullMQ cron worker with startup backfill pattern", "CLI report generator with auto-backfill", "Structured Pino regression alerts at ERROR level"]

key-files:
  created:
    - "src/lib/queue/workers/model-stats.worker.ts"
    - "scripts/generate-before-after-report.ts"
  modified:
    - "src/lib/queue/index.ts"
    - "src/lib/queue/workers/index.ts"
    - "src/lib/queue/setup.ts"
    - "src/lib/logger/modules.ts"

key-decisions:
  - "Worker handles both aggregate-daily-stats and check-regressions job types in single worker"
  - "Regression detection runs inline after aggregation (not separate scheduled job) for simplicity"
  - "Startup backfill is best-effort (non-fatal on error) to avoid blocking worker startup"
  - "Before/after report auto-backfills missing stats data to support first-run without prior cron execution"

patterns-established:
  - "Startup backfill: Worker on('ready') checks yesterday's stats, backfills if missing"
  - "Regression alert format: log.error({ type: 'model-regression', regressions: [...] }, message)"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 58 Plan 03: Model Stats Worker and Before/After Report Summary

**BullMQ daily cron worker aggregating per-model stats at 00:05 UTC with Pino regression alerts, plus CLI before/after comparison report generator with auto-backfill**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T12:32:51Z
- **Completed:** 2026-02-08T12:36:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Model stats worker runs daily at 00:05 UTC, aggregates per-model prediction counts, and detects regressions
- Regression alerts fire via Pino at ERROR level with structured data (model ID, rates, severity)
- Startup backfill on worker ready event prevents data gaps from server restarts
- Before/after comparison report generator creates markdown with summary stats, top improvements, per-model table, and remaining issues
- Report script auto-backfills missing llm_model_stats data for requested date ranges

## Task Commits

Each task was committed atomically:

1. **Task 1: Create model-stats BullMQ worker with daily cron and regression alerts** - `9c60245` (feat)
2. **Task 2: Create before/after comparison report generator script** - `5a50dd9` (feat)

## Files Created/Modified
- `src/lib/queue/workers/model-stats.worker.ts` - BullMQ worker with aggregate-daily-stats and check-regressions job handlers, startup backfill
- `src/lib/queue/index.ts` - Added MODEL_STATS queue name, timeout (3min), lock duration, lazy getter, proxy, and getQueue/getAllQueues entries
- `src/lib/queue/workers/index.ts` - Registered createModelStatsWorker in workerConfigs array
- `src/lib/queue/setup.ts` - Added model-stats daily cron at 00:05 UTC in setupRepeatableJobs, cleanup in removeRepeatableJobs
- `src/lib/logger/modules.ts` - Added modelStatsWorker logger
- `scripts/generate-before-after-report.ts` - CLI script generating before/after markdown comparison report with auto-backfill

## Decisions Made
- **Inline regression detection:** Regression check runs immediately after daily aggregation within the same job handler, rather than being a separate scheduled job. This simplifies the cron setup while still detecting regressions daily.
- **Non-fatal startup backfill:** The on('ready') backfill check catches errors silently to avoid blocking worker startup if the database is temporarily unavailable.
- **Report auto-backfill:** The CLI script checks each date in the requested ranges and backfills missing days individually, making it safe to run before any cron has executed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - worker runs automatically via existing BullMQ infrastructure. Report script is run manually via `npx tsx scripts/generate-before-after-report.ts`.

## Next Phase Readiness
- Phase 58 all three plans complete: data layer (01), admin API (02 - parallel), and automation/reporting (03)
- Daily model stats aggregation will begin producing data after next 00:05 UTC cron run
- Before/after report can be run immediately (will backfill historical data on first execution)
- Migration from 58-01 must be applied to production database before worker can write stats

## Self-Check: PASSED

- Worker file exists: src/lib/queue/workers/model-stats.worker.ts
- Script file exists: scripts/generate-before-after-report.ts
- Both commits verified: 9c60245, 5a50dd9
- MODEL_STATS in queue index with getter and proxy
- Worker registered in workerConfigs array
- Cron registered in setupRepeatableJobs at 00:05 UTC
- Cleanup registered in removeRepeatableJobs
- modelStatsWorker logger added to modules.ts

---
*Phase: 58-observability-monitoring*
*Completed: 2026-02-08*
