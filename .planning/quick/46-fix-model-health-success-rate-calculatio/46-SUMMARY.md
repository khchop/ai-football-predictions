---
phase: quick-046
plan: 01
subsystem: observability
tags: [model-health, stats-aggregation, data-quality]
completed: 2026-02-13
duration: 100s
dependencies:
  requires: [predictions-table, models-table, llmModelStats-table]
  provides: [accurate-per-model-health-metrics]
  affects: [observability-dashboard, model-health-trends]
tech-stack:
  added: []
  patterns: [per-model-attempt-counting, active-model-scoping]
key-files:
  created: []
  modified: [src/lib/db/queries/model-stats.ts]
decisions:
  - Zero error categories instead of fabricating attribution from single failureReason
  - Scope match pool to active models only to prevent inactive models from inflating denominators
  - Use countDistinct(matchId) to prevent double-counting multiple predictions per match
---

# Quick Task 046: Fix Model Health Success Rate Calculation

**One-liner:** Per-model prediction counting scoped to active models with zeroed error categories for accurate health metrics.

## Objective

Fixed `aggregateDailyStats()` to calculate success/failure counts from actual per-model prediction data instead of fabricating failures from a global match count. This prevents models from receiving inflated failure counts for matches they never attempted.

## Implementation

### Task 1: Rewrite aggregateDailyStats() to use per-model attempt counting

**Changes made:**

1. **Reordered query sequence:** Get active models first, then use their IDs to scope match counting
2. **Active-model match pool:** Query counts only distinct matches predicted by currently-active models using `countDistinct(predictions.matchId)` with `IN (activeModelIds)` filter (lines 184-196)
3. **Per-model distinct predictions:** Changed from `count()` to `countDistinct(predictions.matchId)` grouped by modelId (lines 206-218)
4. **Correct failureCount:** Now `max(0, totalActiveModelMatches - successCount)` instead of `max(0, totalMatchesPredicted - successCount)` (line 229)
5. **Zeroed error categories:** Removed `categorizeFailureReason()` call and multiplier logic, hardcoded all error columns to 0 (lines 246-250, 259-263)
6. **Updated early return:** Changed from checking `totalMatchesPredicted === 0` to `totalActiveModelMatches === 0` (line 200)

**Key difference from old implementation:**
- **Old:** `totalMatchesPredicted` = ALL predictions from any model (including archived/inactive)
- **New:** `totalActiveModelMatches` = only predictions from currently-active models
- This prevents archived models from inflating the denominator and incorrectly attributing failures

**Files modified:**
- `src/lib/db/queries/model-stats.ts` (lines 161-268)

**Verification:**
- TypeScript compilation passed (no errors in model-stats.ts)
- Build succeeded (webpack build to avoid turbopack SWC issue)
- Code review confirmed: failureCount = (active-model match pool) - (this model's predictions)
- Error categories all hardcoded to 0 in upsert
- No changes to other functions in the file

**Commit:** `a8fbd71`

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Zero error categories instead of attribution:** The existing approach of taking the model's single latest `failureReason` and multiplying it by `failureCount` was fabricating data. We can't accurately attribute historical errors to specific matches from a single current failureReason. Zero is more honest than fiction. The `categorizeFailureReason()` helper function was kept in the file as it's still used by `determinePrimaryCategory()` for display purposes and may be useful for future real-time error tracking.

2. **Active-model-only scoping:** Counting matches predicted by ANY model (including archived/inactive) was inflating the denominator. A model added mid-period shouldn't be penalized for matches that occurred before it existed. Similarly, archived models shouldn't continue to affect active models' metrics.

3. **CountDistinct for accuracy:** Changed from `count()` to `countDistinct(matchId)` to prevent double-counting if a model somehow predicted the same match multiple times (defensive programming, though the pipeline should prevent this).

## Verification Results

All verification criteria met:

- [x] TypeScript compilation passes without errors (no errors in model-stats.ts)
- [x] Build succeeds (webpack build passed)
- [x] Manual code review confirms correct logic: successCount = model's distinct matches, failureCount = (active-model matches) - successCount
- [x] Error categories zeroed in upsert
- [x] No changes to other functions
- [x] No changes to worker that calls this function

## Impact

**Before:**
- Models received inflated failure counts for matches they never attempted
- Archived models continued to inflate the match pool denominator
- Error categories fabricated data by multiplying single failureReason across all failures
- Success rates artificially low, especially for models added mid-period

**After:**
- Each model's successCount = number of distinct matches IT predicted on that date
- Each model's failureCount = matches where other active models predicted but this model didn't
- Error categories = 0 (honest representation that historical attribution is not possible)
- Models only compared against matches in the "pipeline ran" set (active model predictions)
- `totalAttempts = successCount + failureCount` for every row (invariant maintained)

**Observability dashboard will now show:**
- Accurate per-model success rates based on actual attempts
- Fair comparison between models (all scoped to same active-model match set)
- No false attribution of errors to specific categories

## Self-Check: PASSED

**Created files:**
- `.planning/quick/46-fix-model-health-success-rate-calculatio/46-SUMMARY.md` - FOUND

**Modified files:**
- `src/lib/db/queries/model-stats.ts` - FOUND

**Commits:**
- `a8fbd71` - FOUND: fix(quick-046): use per-model prediction counting for model health stats

All claimed files and commits verified to exist.

## Next Steps

1. Monitor model health metrics after next daily aggregation run
2. Verify success rates are more accurate and less inflated
3. Consider implementing real-time error category tracking in the prediction pipeline (Phase 58 future work)

---

*Completed 2026-02-13 in 100 seconds*
