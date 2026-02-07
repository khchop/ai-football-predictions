---
phase: quick-019
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
    - "Retroactive analysis jobs fail permanently (no retry) when API returns no data"
    - "Retroactive prediction jobs fail permanently when no analysis exists in DB"
    - "Normal (pre-match) analysis and prediction jobs retain existing retry behavior"
  artifacts:
    - path: "src/lib/queue/workers/analysis.worker.ts"
      provides: "Non-retryable error for retroactive no-data case"
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "Non-retryable classification for missing analysis in retroactive jobs"
  key_links:
    - from: "analysis.worker.ts"
      to: "BullMQ UnrecoverableError"
      via: "import and throw when allowRetroactive && no data"
      pattern: "UnrecoverableError"
    - from: "predictions.worker.ts"
      to: "classifyError + allowRetroactive"
      via: "check allowRetroactive before marking as retryable"
      pattern: "allowRetroactive.*unrecoverable|No analysis data found"
---

<objective>
Stop retroactive backfill jobs from infinitely retrying when API-Football has no data for past matches (cup matches like Copa del Rey, DFB-Pokal, KNVB Cup).

Purpose: Eliminate wasted API calls and queue noise from jobs that will never succeed because the data simply does not exist for these matches.

Output: Modified analysis and prediction workers that distinguish between "no data available (permanent)" and "data not yet available (transient)" based on the `allowRetroactive` flag.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/queue/workers/analysis.worker.ts
@src/lib/queue/workers/predictions.worker.ts
@src/lib/queue/types.ts
@src/lib/queue/workers/backfill.worker.ts
@src/lib/football/match-analysis.ts (lines 340-357 - fetchAndStoreAnalysis return null path)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make analysis worker treat no-data as permanent failure for retroactive jobs</name>
  <files>src/lib/queue/workers/analysis.worker.ts</files>
  <action>
In the analysis worker, at lines 49-54, where `fetchAndStoreAnalysis()` returns null:

1. Import `UnrecoverableError` from `bullmq` (add to existing import on line 8):
   `import { Worker, Job, UnrecoverableError } from 'bullmq';`

2. Replace the unconditional throw at line 54 with a conditional:
   - If `allowRetroactive` is truthy: throw `new UnrecoverableError(...)` with a clear message like `No API data available for retroactive match ${matchId} (${homeTeam} vs ${awayTeam}) - permanent failure, data will not appear for past matches`.
     Log at INFO level (not warn) since this is expected for cup matches.
   - If `allowRetroactive` is falsy (normal pre-match flow): keep the existing `throw new Error(...)` which triggers BullMQ retry.

BullMQ's `UnrecoverableError` causes the job to move directly to "failed" state without retrying, regardless of the job's `attempts` setting. This is the idiomatic BullMQ way to signal "don't retry."

3. In the catch block (line 66-91), also check: if the error is already an `UnrecoverableError`, downgrade Sentry capture from `error` to `info` level (or skip Sentry entirely) since this is expected behavior, not a real error. Check with `error instanceof UnrecoverableError`. If it is, log at info level and re-throw without Sentry capture.
  </action>
  <verify>
    `npx tsc --noEmit --pretty` passes with no type errors in analysis.worker.ts.
    Grep for `UnrecoverableError` in analysis.worker.ts confirms import and usage.
    Grep confirms the original `throw new Error` still exists for the non-retroactive path.
  </verify>
  <done>
    Retroactive analysis jobs that get null from API throw UnrecoverableError (no retry).
    Normal analysis jobs that get null still throw regular Error (BullMQ retries up to 5 times).
    Sentry is not spammed with expected "no data" errors from retroactive jobs.
  </done>
</task>

<task type="auto">
  <name>Task 2: Make prediction worker treat missing-analysis as permanent failure for retroactive jobs</name>
  <files>src/lib/queue/workers/predictions.worker.ts</files>
  <action>
In the predictions worker, at lines 114-121, where no analysis is found in the DB:

1. Import `UnrecoverableError` from `bullmq` (add to existing import on line 9):
   `import { Worker, Job, UnrecoverableError } from 'bullmq';`

2. At line 115-121, where `!analysis`: check `allowRetroactive`:
   - If `allowRetroactive`: throw `new UnrecoverableError(...)` with message like `No analysis data exists for retroactive match ${matchId} - skipping predictions (API had no data for this match)`. Log at INFO level.
   - If NOT `allowRetroactive`: keep the existing `throw new Error(...)` which is classified as 'unknown' by `classifyError()` and retried (this is correct for normal flow where analysis may still be processing).

3. In the outer catch block (lines 297-334), add an early check: if `error instanceof UnrecoverableError`, log at info level and re-throw WITHOUT wrapping in "Retryable:" prefix and without Sentry error capture. The `isRetryable()` check at line 323 would return true for these (since classifyError returns 'unknown'), which would incorrectly wrap the UnrecoverableError in a regular Error, defeating the purpose. So the UnrecoverableError check MUST come before the isRetryable check.

Specifically, add this block right after the Sentry capture (or before it, to avoid spamming Sentry):
```
if (error instanceof UnrecoverableError) {
  log.info({ matchId, error: errorMsg }, 'Permanent failure - not retrying');
  throw error; // Re-throw as-is so BullMQ sees UnrecoverableError
}
```
Place this BEFORE the `if (isRetryable(error))` check at line 323.
  </action>
  <verify>
    `npx tsc --noEmit --pretty` passes with no type errors in predictions.worker.ts.
    Grep for `UnrecoverableError` in predictions.worker.ts confirms import and usage at both the throw site and the catch handler.
    Grep confirms the "Retryable:" path is still intact for actual retryable errors.
  </verify>
  <done>
    Retroactive prediction jobs where no analysis exists throw UnrecoverableError (no retry).
    Normal prediction jobs where analysis is still processing still retry with backoff.
    UnrecoverableError is not accidentally wrapped in a retryable Error in the catch block.
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify production build compiles</name>
  <files></files>
  <action>
Run `npm run build` (or `npx next build --webpack` as fallback if turbopack SWC binary is missing locally) to verify the changes compile for production. This is critical because:
- Turbopack is stricter about imports than dev mode
- The UnrecoverableError import from bullmq needs to resolve correctly
- Worker files are server-side only, so any import errors would only surface at build time

If build fails, fix the issue. Common pitfalls:
- UnrecoverableError may need to be imported as a named export: `import { UnrecoverableError } from 'bullmq'` (it is a named export, this should work)
- If `instanceof UnrecoverableError` causes issues, check BullMQ version supports it (it was added in bullmq v3.0+)
  </action>
  <verify>
    Production build completes without errors.
    No TypeScript errors related to the modified files.
  </verify>
  <done>
    Production build passes. Changes are ready to deploy.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` - TypeScript compilation succeeds
2. `npm run build` (or webpack fallback) - Production build succeeds
3. In analysis.worker.ts: `UnrecoverableError` is thrown when `allowRetroactive && !analysis`
4. In analysis.worker.ts: Regular `Error` is thrown when `!allowRetroactive && !analysis`
5. In predictions.worker.ts: `UnrecoverableError` is thrown when `allowRetroactive && !analysis`
6. In predictions.worker.ts: Regular `Error` is thrown when `!allowRetroactive && !analysis`
7. In predictions.worker.ts: `UnrecoverableError` in catch block is re-thrown as-is (not wrapped in "Retryable:")
</verification>

<success_criteria>
- Retroactive backfill analysis jobs that receive no API data fail permanently on first attempt (0 retries)
- Retroactive backfill prediction jobs that find no analysis data fail permanently on first attempt (0 retries)
- Normal pre-match pipeline retains full retry behavior for both workers (up to 5 attempts)
- Production build passes
- No Sentry noise from expected "no data" failures on retroactive cup match jobs
</success_criteria>

<output>
After completion, create `.planning/quick/019-fix-retroactive-backfill-no-data-infinite-retry/019-SUMMARY.md`
</output>
