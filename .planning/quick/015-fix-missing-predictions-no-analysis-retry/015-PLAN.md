---
phase: quick-015
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/queue/workers/analysis.worker.ts
  - src/lib/queue/workers/predictions.worker.ts
autonomous: true

must_haves:
  truths:
    - "When analysis API returns no data, BullMQ retries the analysis job up to 5 times with exponential backoff"
    - "When prediction worker finds no analysis data, BullMQ retries the prediction job up to 5 times"
    - "Legitimate skips (match not found, match not scheduled) still return successfully without retry"
  artifacts:
    - path: "src/lib/queue/workers/analysis.worker.ts"
      provides: "Analysis worker with retry on no-data"
      contains: "throw new Error"
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "Prediction worker with retry on missing analysis"
      contains: "throw new Error"
  key_links:
    - from: "analysis.worker.ts"
      to: "BullMQ retry mechanism"
      via: "throw instead of return on no_data"
      pattern: "throw new Error.*no.*(data|analysis)"
    - from: "predictions.worker.ts"
      to: "BullMQ retry mechanism"
      via: "throw instead of return on no_analysis"
      pattern: "throw new Error.*no.*(analysis|data)"
---

<objective>
Fix the pipeline bug where analysis and prediction workers silently complete (return) instead of retrying (throw) when data is unavailable, causing matches to start without predictions.

Purpose: The queue already has `attempts: 5` with exponential backoff (30s, 60s, 120s, 240s, 480s = ~15 min). By throwing instead of returning, BullMQ will automatically retry — giving API-Football time to make data available closer to kickoff, and giving analysis time to complete before predictions run.

Output: Two modified worker files that properly trigger BullMQ retries on data unavailability.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/queue/workers/analysis.worker.ts
@src/lib/queue/workers/predictions.worker.ts
@src/lib/queue/index.ts (lines 220-242 — queue config with attempts: 5, exponential backoff 30s)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix analysis worker to throw on no-data instead of returning</name>
  <files>src/lib/queue/workers/analysis.worker.ts</files>
  <action>
In `analysis.worker.ts`, replace lines 45-48 (the `if (!analysis)` block):

BEFORE:
```typescript
if (!analysis) {
  log.info(`No analysis data available for ${homeTeam} vs ${awayTeam}`);
  return { success: false, reason: 'no_data_available' };
}
```

AFTER:
```typescript
if (!analysis) {
  log.warn(
    { matchId, externalId, attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
    `No analysis data available for ${homeTeam} vs ${awayTeam} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 5})`
  );
  throw new Error(`No analysis data available for match ${matchId} (${homeTeam} vs ${awayTeam})`);
}
```

Key changes:
- `log.info` -> `log.warn` (this is a retriable problem, not normal flow)
- Include `attemptsMade` and `maxAttempts` in structured log for monitoring
- `return` -> `throw new Error(...)` so BullMQ triggers retry with existing exponential backoff (30s -> 60s -> 120s -> 240s -> 480s)
- The thrown error will be caught by the existing catch block at line 59, which logs to Sentry and re-throws for BullMQ retry

NOTE: Do NOT change lines 29-31 (match_not_found skip) or lines 37-38 (match_not_scheduled skip). Those are legitimate skip conditions where retry would not help.
  </action>
  <verify>
1. `npx tsc --noEmit --project tsconfig.json` passes (no type errors)
2. Read the file and confirm: the `if (!analysis)` block now throws instead of returning
3. Confirm the `match_not_found` and `match_not_scheduled` blocks still return (not throw)
  </verify>
  <done>When fetchAndStoreAnalysis returns null, analysis worker throws an error triggering BullMQ retry with exponential backoff, instead of silently completing the job.</done>
</task>

<task type="auto">
  <name>Task 2: Fix predictions worker to throw on missing analysis instead of returning</name>
  <files>src/lib/queue/workers/predictions.worker.ts</files>
  <action>
In `predictions.worker.ts`, replace lines 111-113 (the `if (!analysis)` block):

BEFORE:
```typescript
if (!analysis) {
  log.info(`No analysis for match ${matchId}`);
  return { skipped: true, reason: 'no_analysis' };
}
```

AFTER:
```typescript
if (!analysis) {
  log.warn(
    { matchId, attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
    `No analysis data found for match ${matchId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 5}) - analysis may still be processing`
  );
  throw new Error(`No analysis data found for match ${matchId} - analysis may still be processing`);
}
```

Key changes:
- `log.info` -> `log.warn` (this is a retriable problem)
- Include `attemptsMade` and `maxAttempts` in structured log for monitoring
- `return` -> `throw new Error(...)` so BullMQ retries with the worker's custom backoffStrategy (which already handles exponential backoff with jitter)
- The thrown error will be caught by the existing catch block at line 290, which classifies errors and decides retry behavior

The `classifyError` function at line 40 will classify this as `'unknown'` (not matching retryable or unrecoverable patterns), and `isRetryable` at line 66 returns true for `'unknown'`, so the catch block at line 316 will re-throw for BullMQ retry.

NOTE: Do NOT change lines 97-100 (match_not_found skip) or lines 104-106 (match_not_scheduled skip) or lines 87-93 (predictions_already_exist skip). Those are legitimate skip conditions.
  </action>
  <verify>
1. `npx tsc --noEmit --project tsconfig.json` passes (no type errors)
2. Read the file and confirm: the `if (!analysis)` block now throws instead of returning
3. Confirm the `match_not_found`, `match_not_scheduled`, and `predictions_already_exist` blocks still return (not throw)
4. Trace error flow: thrown error -> catch block line 290 -> classifyError returns 'unknown' -> isRetryable returns true -> re-throws for BullMQ retry
  </verify>
  <done>When analysis data is missing, prediction worker throws an error triggering BullMQ retry with exponential backoff, instead of silently skipping the match.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit --project tsconfig.json` passes
2. Production build: `npm run build` succeeds
3. Both workers now throw on data unavailability:
   - analysis.worker.ts: `throw new Error(...)` when `fetchAndStoreAnalysis` returns null
   - predictions.worker.ts: `throw new Error(...)` when `getMatchAnalysisByMatchId` returns null
4. Legitimate skip conditions unchanged (match_not_found, match_not_scheduled, predictions_already_exist all still return)
5. Existing queue config provides retry behavior: `attempts: 5`, exponential backoff `30s -> 60s -> 120s -> 240s -> 480s` (~15 min total coverage)
</verification>

<success_criteria>
- Analysis worker retries when API-Football returns no data (throw, not return)
- Prediction worker retries when analysis is not yet available (throw, not return)
- Legitimate skips (match not found, not scheduled, already predicted) still complete without retry
- Build passes, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/015-fix-missing-predictions-no-analysis-retry/015-SUMMARY.md`
</output>
