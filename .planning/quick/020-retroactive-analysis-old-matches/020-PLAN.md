---
phase: quick
plan: 020
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/queue/workers/predictions.worker.ts
  - src/lib/queue/workers/backfill.worker.ts
  - scripts/backfill-retroactive-predictions.ts
autonomous: true

must_haves:
  truths:
    - "Matches with partial predictions (1-41) get remaining models filled in by backfill"
    - "Automated hourly backfill catches matches up to 30 days old instead of 7"
    - "One-time deep backfill script works for arbitrary lookback and completes partial predictions"
  artifacts:
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "Smart skipIfDone that allows partial prediction completion"
      contains: "existingPredictions.length >= 42"
    - path: "src/lib/queue/workers/backfill.worker.ts"
      provides: "30-day retroactive backfill window"
      contains: "getMatchesMissingRetroactivePredictions(30)"
    - path: "scripts/backfill-retroactive-predictions.ts"
      provides: "Deep backfill script without skipIfDone blocking partial fills"
  key_links:
    - from: "predictions.worker.ts skipIfDone block"
      to: "provider iteration loop"
      via: "existingModelIds Set filtering"
      pattern: "existingModelIds\\.has\\(provider\\.id\\)"
---

<objective>
Fix retroactive backfill to handle partial predictions and extend the lookback window.

Three targeted changes:
1. Fix `skipIfDone` in predictions worker to skip only when >= 42 predictions exist, and when < 42, filter out models that already predicted so only remaining models generate predictions.
2. Change automated backfill window from 7 days to 30 days.
3. Remove `skipIfDone: true` from the backfill script so it relies on the fixed predictions worker logic.

Purpose: Matches with partial predictions (e.g., 5/42 from a worker crash) are currently permanently stuck. Old matches beyond 7 days are never backfilled. These fixes close both gaps.
Output: Modified worker files ready for deployment.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/queue/workers/predictions.worker.ts
@src/lib/queue/workers/backfill.worker.ts
@scripts/backfill-retroactive-predictions.ts
@src/lib/queue/types.ts
@src/lib/db/schema.ts (predictions table - has modelId field, unique constraint on matchId+modelId)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix skipIfDone to allow partial prediction completion</name>
  <files>src/lib/queue/workers/predictions.worker.ts</files>
  <action>
Modify the `skipIfDone` block (lines 86-93) to implement smart partial completion:

**Replace the current logic:**
```typescript
if (skipIfDone) {
  const existingPredictions = await getPredictionsForMatch(matchId);
  if (existingPredictions.length > 0) {
    log.info(`Predictions already exist for match ${matchId}, skipping`);
    return { skipped: true, reason: 'predictions_already_exist', predictionCount: existingPredictions.length };
  }
}
```

**With this logic:**
```typescript
// Check if predictions are complete (>= 42 = all models done)
let existingModelIds: Set<string> | null = null;
if (skipIfDone) {
  const existingPredictions = await getPredictionsForMatch(matchId);
  if (existingPredictions.length >= 42) {
    log.info({ matchId, count: existingPredictions.length }, `All predictions complete for match ${matchId}, skipping`);
    return { skipped: true, reason: 'predictions_complete', predictionCount: existingPredictions.length };
  }
  if (existingPredictions.length > 0) {
    // Partial predictions exist - track which models already predicted
    existingModelIds = new Set(existingPredictions.map(p => p.modelId));
    log.info({ matchId, existing: existingPredictions.length, modelsCompleted: existingModelIds.size }, `Partial predictions found, will complete remaining models`);
  }
}
```

Then modify the provider iteration loop (around line 166). AFTER the line `const providers = await getActiveProviders();` and its log line, add filtering:
```typescript
// Filter out models that already have predictions for this match (partial backfill)
const filteredProviders = existingModelIds
  ? providers.filter(p => !existingModelIds!.has(p.id))
  : providers;

if (existingModelIds && filteredProviders.length === 0) {
  log.info({ matchId, existingModels: existingModelIds.size, totalModels: providers.length }, `All active models already have predictions, skipping`);
  return { skipped: true, reason: 'all_active_models_predicted', predictionCount: existingModelIds.size };
}

if (existingModelIds) {
  log.info({ matchId, remaining: filteredProviders.length, skippedModels: existingModelIds.size }, `Generating predictions for ${filteredProviders.length} remaining models`);
}
```

Then change the `for (const provider of providers)` loop to iterate over `filteredProviders` instead:
```typescript
for (const provider of filteredProviders) {
```

Also update the final log at the end of the try block (around line 296) to include context about partial fills:
```typescript
log.info({
  totalModels: providers.length,
  filtered: filteredProviders.length,
  successful: successCount,
  failed: failCount,
  previouslyComplete: existingModelIds?.size ?? 0,
}, 'Prediction job completed');
```

And update the return value to include the full picture:
```typescript
return {
  success: true,
  successCount,
  failCount,
  totalModels: providers.length,
  newPredictions: predictionsToInsert.length,
  previouslyComplete: existingModelIds?.size ?? 0,
};
```

IMPORTANT: The `existingModelIds` variable must be declared with `let` at the top level of the try block (before the skipIfDone check) so it's accessible later in the provider loop. Initialize it as `null` and the type should be `Set<string> | null`.
  </action>
  <verify>
Run `npx next build --webpack 2>&1 | tail -20` to verify TypeScript compilation succeeds (no type errors from the new Set logic or variable scoping).
  </verify>
  <done>
The `skipIfDone` check now: (1) skips only when >= 42 predictions exist, (2) when 1-41 predictions exist, builds a Set of existing modelIds and filters the provider list so only remaining models generate predictions. No duplicate predictions possible due to the unique constraint on (matchId, modelId).
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend backfill window and fix backfill script</name>
  <files>
    src/lib/queue/workers/backfill.worker.ts
    scripts/backfill-retroactive-predictions.ts
  </files>
  <action>
**Change 1: Extend automated backfill window (backfill.worker.ts)**

On line 359, change:
```typescript
const retroGaps = await getMatchesMissingRetroactivePredictions(7);
```
to:
```typescript
const retroGaps = await getMatchesMissingRetroactivePredictions(30);
```

Also update the log message on line 371 to reflect the new window:
```typescript
}, `Retroactive backfill: found ${retroGaps.length} match(es) with < 42 predictions in last 30 days`);
```

**Change 2: Fix backfill script to not block partial fills (scripts/backfill-retroactive-predictions.ts)**

In the `generateRetroactivePredictions` function (line 154), change `skipIfDone: true` to `skipIfDone: true` -- actually keep it as `skipIfDone: true`. With the Task 1 fix, `skipIfDone: true` now correctly handles partial predictions (skips at >= 42, completes at < 42). So the script benefits from the fix without any changes needed.

Wait -- on re-read, `skipIfDone: true` is actually correct now because with the Task 1 fix it does the right thing. The predictions worker will:
- Skip if >= 42 predictions (fully done)
- Complete remaining models if 1-41 predictions (partial)
- Generate all models if 0 predictions (new)

So **no change needed** to the backfill script. The `skipIfDone: true` flag is now the correct behavior.

Only make the backfill.worker.ts change (7 -> 30 days + log message update).
  </action>
  <verify>
1. Grep for the old value: `grep -n "getMatchesMissingRetroactivePredictions(7)" src/lib/queue/workers/backfill.worker.ts` should return no results.
2. Grep for the new value: `grep -n "getMatchesMissingRetroactivePredictions(30)" src/lib/queue/workers/backfill.worker.ts` should return the updated line.
3. Run `npx next build --webpack 2>&1 | tail -20` to confirm clean build.
  </verify>
  <done>
Automated hourly backfill now looks back 30 days instead of 7, preventing matches from falling through the window. The backfill script's `skipIfDone: true` correctly leverages the fixed predictions worker to complete partial predictions.
  </done>
</task>

</tasks>

<verification>
1. Build check: `npx next build --webpack` completes without errors
2. Grep verification: No references to `getMatchesMissingRetroactivePredictions(7)` remain in backfill.worker.ts
3. Grep verification: `existingPredictions.length >= 42` exists in predictions.worker.ts
4. Grep verification: `existingModelIds` filtering logic exists in predictions.worker.ts
5. The backfill script still uses `skipIfDone: true` which now correctly handles partial fills
</verification>

<success_criteria>
- Predictions worker skips only when >= 42 predictions exist (not when any exist)
- Predictions worker generates predictions only for models that haven't predicted yet when 1-41 exist
- Automated backfill window is 30 days instead of 7
- TypeScript build passes cleanly
- After deploying: running `npx tsx scripts/backfill-retroactive-predictions.ts --days 90` will backfill all historical matches including completing partial predictions
</success_criteria>

<output>
After completion, create `.planning/quick/020-retroactive-analysis-old-matches/020-SUMMARY.md`
</output>
