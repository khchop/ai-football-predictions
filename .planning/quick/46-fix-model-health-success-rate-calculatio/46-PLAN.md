---
phase: quick-046
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/queries/model-stats.ts
autonomous: true
must_haves:
  truths:
    - "Each model's successCount equals the number of distinct matches IT predicted on a given date"
    - "Each model's failureCount equals matches where at least one other active model predicted but this model did not"
    - "Error category columns are zeroed out since historical error attribution is not possible from a single latest failureReason"
    - "Models added mid-period are not penalized for matches they never attempted"
    - "totalAttempts = successCount + failureCount for every row"
  artifacts:
    - path: "src/lib/db/queries/model-stats.ts"
      provides: "Fixed aggregateDailyStats() with per-model attempt counting"
      contains: "countDistinct.*matchId.*WHERE.*modelId"
  key_links:
    - from: "src/lib/db/queries/model-stats.ts"
      to: "predictions table"
      via: "per-model distinct match count query"
      pattern: "predictions\\.modelId"
---

<objective>
Fix the `aggregateDailyStats()` function in model-stats.ts so that success/failure counts are calculated per-model from actual prediction data, instead of fabricating failures from a global match count.

Purpose: Currently models get inflated failure counts because `failureCount = globalMatchCount - modelSuccessCount`, which attributes failures for matches a model never attempted. This produces inaccurate health metrics on the observability dashboard.

Output: Corrected `aggregateDailyStats()` that counts per-model actual attempts and only attributes failures for matches where the prediction pipeline ran for a match but this specific model failed to produce a prediction.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/db/queries/model-stats.ts
@src/lib/db/schema.ts (llmModelStats table at line 116, predictions table at line 368)
@src/lib/queue/workers/model-stats.worker.ts (caller of aggregateDailyStats)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite aggregateDailyStats() to use per-model attempt counting</name>
  <files>src/lib/db/queries/model-stats.ts</files>
  <action>
Replace the `aggregateDailyStats()` function (lines 161-268) with corrected logic:

1. Keep the same function signature and timestamp range setup (dayStart/dayEnd).

2. **Get per-model prediction counts** (existing step, keep as-is): Query predictions table grouped by modelId, counting distinct matchId per model for this date range. This gives each model's successCount.

3. **Get the set of all distinct matchIds predicted by ANY currently-active model on this date.** This is the "pipeline ran" set. Query: select distinct matchId from predictions WHERE createdAt in range AND modelId IN (select id from models where active = true). Store as a Set or get the count.

4. **Get all active models** with their failureReason (existing step, keep as-is).

5. **For each active model**, calculate:
   - `successCount` = number of distinct matches THIS model predicted (from step 2, default 0)
   - `totalActiveModelMatches` = count of distinct matches predicted by ANY active model (from step 3)
   - `failureCount` = max(0, totalActiveModelMatches - successCount)
   - `totalAttempts` = successCount + failureCount (which equals totalActiveModelMatches when model is active)
   - `successRate` = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0

6. **Error categories: Set ALL to 0.** Remove the `categorizeFailureReason()` call for error attribution. The existing approach of taking the model's single latest `failureReason` and multiplying it by `failureCount` is fabricating data. Zero is more honest than fiction. Keep the `categorizeFailureReason` helper function in the file (it's still used conceptually and may be useful later).

7. Keep the upsert logic (insert with onConflictDoUpdate) exactly as-is, just with the corrected values.

**Key difference from current code:** Instead of counting ALL predictions (including from inactive/archived models) to get `totalMatchesPredicted`, only count matches predicted by CURRENTLY ACTIVE models. This prevents inactive models from inflating the denominator. The per-model query in step 2 should also use `countDistinct(predictions.matchId)` not `count()` to avoid double-counting multiple predictions per match per model (though in practice there should only be one).

**Important:** The early return for `totalMatchesPredicted === 0` should now check the active-model-only count instead.

**Do NOT change any other functions** in this file (getModelHealthTrends, getAllModelHealthSummary, detectRegressions, categorizeFailureReason, determinePrimaryCategory, aggregateWindow).
  </action>
  <verify>
1. `npx tsc --noEmit` passes (no type errors)
2. `npm run build` succeeds (or `npx next build --webpack` if turbopack SWC binary missing)
3. Manual code review: confirm that failureCount is computed as (active-model match pool) - (this model's predictions), NOT as (global match pool) - (this model's predictions)
4. Confirm error category values are all hardcoded to 0 in the upsert
  </verify>
  <done>
aggregateDailyStats() correctly computes per-model success/failure from actual prediction data scoped to active models only, with zeroed error categories. No type errors. Build passes.
  </done>
</task>

</tasks>

<verification>
- TypeScript compilation passes without errors
- Build succeeds
- The function logic matches: successCount = model's distinct match predictions, failureCount = (matches predicted by other active models) - successCount, error categories = 0
- No changes to other functions in the file
- No changes to the worker that calls this function
</verification>

<success_criteria>
- aggregateDailyStats() uses per-model prediction counting instead of global match count
- Models only get failures for matches where the pipeline ran (other active models predicted) but they didn't
- Error categories are zeroed (no fabricated attribution)
- Build passes, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/46-fix-model-health-success-rate-calculatio/46-SUMMARY.md`
</output>
