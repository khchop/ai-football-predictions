---
phase: 58-observability-monitoring
plan: 01
subsystem: database
tags: [drizzle, postgresql, observability, metrics, time-series, regression-detection]

# Dependency graph
requires:
  - phase: 52-monitoring-observability
    provides: "Pipeline-level monitoring patterns, admin API patterns"
  - phase: 57-category-fixes
    provides: "Diagnostic validation baseline, model health data"
provides:
  - "llm_model_stats table for daily per-model health metrics"
  - "aggregateDailyStats function for daily stats aggregation"
  - "getModelHealthTrends function for 7/30/90-day trend queries"
  - "getAllModelHealthSummary function for dashboard overview"
  - "detectRegressions function for regression detection"
affects: [58-02-api-endpoint, 58-03-dashboard-visualization]

# Tech tracking
tech-stack:
  added: []
  patterns: ["daily time-series aggregation with upsert", "multi-window trend analysis (7/30/90 days)", "regression detection with dual threshold (drop >10% AND rate <90%)"]

key-files:
  created:
    - "src/lib/db/queries/model-stats.ts"
    - "drizzle/0014_add_llm_model_stats.sql"
  modified:
    - "src/lib/db/schema.ts"

key-decisions:
  - "Success = prediction record exists for model+match on date; failure = active model missing prediction where pipeline ran"
  - "Error categories are best-effort from models.failureReason (latest error only, not per-prediction)"
  - "Regression detection uses total-based rates (not averaged daily rates) for statistical accuracy"
  - "getAllModelHealthSummary fetches 30 days in single query then filters in-memory for 7d/30d windows"

patterns-established:
  - "Time-series daily aggregation: date(text YYYY-MM-DD) + modelId unique constraint with upsert"
  - "Multi-window trend queries: fetch widest window once, filter in-memory for narrower windows"
  - "Health status thresholds: >=90% healthy, >=80% warning, <80% critical"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 58 Plan 01: Model Stats Data Layer Summary

**llm_model_stats table with daily per-model aggregation, 7/30/90-day trend queries, and regression detection using Drizzle upsert pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T12:25:07Z
- **Completed:** 2026-02-08T12:28:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- llm_model_stats table defined with date+modelId unique constraint, 5 error category columns, and 3 indexes
- Migration SQL ready for deployment (drizzle/0014_add_llm_model_stats.sql)
- Query module with 4 exported functions: aggregation, single-model trends, all-model summary, regression detection
- Regression detection compares 7-day windows with dual threshold (>10% drop AND <90% current rate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add llm_model_stats table to schema and generate migration** - `4477570` (feat)
2. **Task 2: Create model-stats query module with aggregation, trends, and regression detection** - `89f525b` (feat)

## Files Created/Modified
- `src/lib/db/schema.ts` - Added llmModelStats table definition and LLMModelStat/NewLLMModelStat type exports
- `drizzle/0014_add_llm_model_stats.sql` - CREATE TABLE with unique constraint and 3 indexes
- `src/lib/db/queries/model-stats.ts` - 4 query functions: aggregateDailyStats, getModelHealthTrends, getAllModelHealthSummary, detectRegressions

## Decisions Made
- **Success/failure definition:** Success = prediction record exists for model+date; failure = active model missing a prediction where the pipeline ran for other models. This measures API reliability, not prediction accuracy.
- **Error categorization approach:** Uses `models.failureReason` field (stores latest error only) rather than per-prediction error tracking. This is a best-effort categorization since the error field is overwritten on each failure. Forward-looking improvement would be a per-prediction error log table.
- **Rate calculation method:** Regression detection uses totals-based rates (totalSuccess/totalAttempts) rather than averaging daily success rates. This prevents small-sample days from skewing results.
- **In-memory filtering:** getAllModelHealthSummary fetches all stats for the 30-day window in a single query, then filters in-memory for the 7-day subset. More efficient than two separate queries for 42 models.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration must be applied to the production database before use (`drizzle/0014_add_llm_model_stats.sql`).

## Next Phase Readiness
- Data layer complete: schema, migration, and query functions ready
- Plan 58-02 can build admin API endpoints on top of these query functions
- Plan 58-03 can build Recharts dashboard using getModelHealthTrends and getAllModelHealthSummary
- Migration needs to be run on production database before API/dashboard plans can function

## Self-Check: PASSED

- All 3 files exist (schema.ts, migration SQL, model-stats.ts)
- Both commits verified (4477570, 89f525b)
- 3 schema exports confirmed (llmModelStats, LLMModelStat, NewLLMModelStat)
- 4 query functions exported (aggregateDailyStats, getModelHealthTrends, getAllModelHealthSummary, detectRegressions)
- No type errors introduced (pre-existing test fixture errors only)

---
*Phase: 58-observability-monitoring*
*Completed: 2026-02-08*
