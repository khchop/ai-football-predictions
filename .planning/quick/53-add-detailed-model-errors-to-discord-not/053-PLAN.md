---
phase: quick-053
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/notifications/discord.ts
  - src/lib/db/queries.ts
  - src/lib/queue/workers/predictions.worker.ts
autonomous: true

must_haves:
  truths:
    - "Auto-disable Discord alert shows the error type (e.g., parse-error, client-error) alongside the error message"
    - "After each prediction run with failures, a Discord summary notification shows which models failed and why"
    - "Fire-and-forget pattern is maintained -- notification failures never crash the pipeline"
  artifacts:
    - path: "src/lib/notifications/discord.ts"
      provides: "Enhanced auto-disable alert with errorType field; new sendPredictionRunSummary function"
      exports: ["sendAutoDisableAlert", "sendRegressionAlert", "sendPredictionRunSummary"]
    - path: "src/lib/db/queries.ts"
      provides: "Passes errorType through to sendAutoDisableAlert"
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "Collects per-model error data and calls sendPredictionRunSummary after run completes"
  key_links:
    - from: "src/lib/queue/workers/predictions.worker.ts"
      to: "src/lib/notifications/discord.ts"
      via: "sendPredictionRunSummary call after prediction loop"
      pattern: "sendPredictionRunSummary"
    - from: "src/lib/db/queries.ts"
      to: "src/lib/notifications/discord.ts"
      via: "sendAutoDisableAlert with errorType parameter"
      pattern: "errorType"
---

<objective>
Add detailed model error information to Discord notifications so models can be troubleshot directly from Discord without needing to check logs.

Purpose: Currently auto-disable alerts show only a truncated error message with no error type classification, and there is no notification at all when prediction runs have failures below the auto-disable threshold. This makes troubleshooting require log access.

Output: Enhanced auto-disable alert with error type, plus a new prediction run summary notification showing per-model failures with error types.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/notifications/discord.ts
@src/lib/db/queries.ts (recordModelFailure function, lines 859-929)
@src/lib/queue/workers/predictions.worker.ts
@src/lib/utils/retry-config.ts (ErrorType enum)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance auto-disable alert with error type and add prediction run summary notification</name>
  <files>
    src/lib/notifications/discord.ts
    src/lib/db/queries.ts
  </files>
  <action>
**In `src/lib/notifications/discord.ts`:**

1. Add `errorType` (optional string) to the `AutoDisableParams` interface.

2. In `sendAutoDisableAlert`, update the embed fields:
   - Change the existing "Error" field to show both the error type and the message. Format:
     ```
     name: 'Error Type'
     value: errorType (e.g., "parse-error") or "unknown" if not provided
     inline: true
     ```
   - Keep the existing "Error" field but rename it to "Error Details" with the `failureReason.substring(0, 200)` value. Set inline: false.

3. Create a new exported interface `PredictionRunFailure`:
   ```typescript
   interface PredictionRunFailure {
     modelId: string;
     displayName: string;
     errorType: string;
     errorMessage: string;
   }
   ```

4. Create a new exported async function `sendPredictionRunSummary`:
   ```typescript
   export async function sendPredictionRunSummary(params: {
     matchLabel: string;       // e.g., "Arsenal vs Chelsea (Premier League)"
     totalModels: number;
     successful: number;
     failed: number;
     failures: PredictionRunFailure[];
   }): Promise<void>
   ```
   Implementation:
   - Return early if `failures.length === 0` (no notification needed for clean runs).
   - Color: Use orange (0xffa500) if failed < total/2, red (0xff0000) if failed >= total/2.
   - Title: `"Prediction Run: ${successful}/${totalModels} succeeded"`
   - Description: `matchLabel`
   - Group failures by errorType. For each error type, create ONE field:
     ```
     name: "parse-error (3 models)"
     value: "- Model Name A: error msg truncated to 80 chars\n- Model Name B: error msg...\n- Model Name C: ..."
     inline: false
     ```
   - Limit: Show at most 10 failures total across all groups (Discord field limits). If more, add "(+N more)" text.
   - Footer: `"Prediction Run Summary"`
   - Timestamp: current time.
   - Wrap in try/catch, log errors, never throw (fire-and-forget pattern).

**In `src/lib/db/queries.ts`:**

5. In the `recordModelFailure` function, find the `sendAutoDisableAlert` call (~line 913). Add `errorType` to the params object being passed:
   ```typescript
   sendAutoDisableAlert({
     modelId,
     displayName: modelInfo[0]?.displayName || modelId,
     consecutiveFailures: updated.consecutiveFailures || 0,
     failureReason: reason.substring(0, 200),
     lastSuccessAt: modelInfo[0]?.lastSuccessAt || null,
     errorType: errorType || 'unknown',  // ADD THIS
   }).catch(() => {});
   ```
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm type-checking passes. Verify `sendPredictionRunSummary` is exported from discord.ts. Verify `AutoDisableParams` includes optional `errorType` field.
  </verify>
  <done>
    Auto-disable alerts include error type classification. New `sendPredictionRunSummary` function exists and is exported.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire prediction run summary into the predictions worker</name>
  <files>
    src/lib/queue/workers/predictions.worker.ts
  </files>
  <action>
1. Add import at the top of the file:
   ```typescript
   import { sendPredictionRunSummary } from '@/lib/notifications/discord';
   ```

2. After the `let failCount = 0;` declaration (~line 181), add a collection array to track per-model failures during the run:
   ```typescript
   const modelFailures: Array<{
     modelId: string;
     displayName: string;
     errorType: string;
     errorMessage: string;
   }> = [];
   ```

3. In EACH place where `failCount++` occurs (there are 4 locations: empty response ~line 223, parse failure ~line 263, schema validation failure ~line 286, and the catch block ~line 340), add a push to `modelFailures` BEFORE the `failCount++`:
   ```typescript
   modelFailures.push({
     modelId: provider.id,
     displayName: provider.displayName || provider.id,
     errorType: errorType || ErrorType.UNKNOWN,
     errorMessage: (errorMessage || 'unknown error').substring(0, 100),
   });
   ```
   Note: For the empty response case (line ~221), use `errorType` which is already `ErrorType.PARSE_ERROR` and `errorMessage` = `'empty_response'`.
   For the parse failure case (~line 261), use `errorType` which is `ErrorType.PARSE_ERROR` and the `parsed.error` value.
   For the schema validation case (~line 285), use `ErrorType.PARSE_ERROR` and `'schema_validation_failed'`.
   For the catch block (~line 318-340), use the already-declared `errorType` and `errorMessage` variables.

   Access to `provider.displayName`: Check if the provider object has a `displayName` property. The providers come from `getActiveProviders()` which returns provider instances. Check the provider/base class for a displayName field -- if it has `name` instead, use that. Fall back to `provider.id`.

4. After the prediction loop completes and AFTER the batch insert / quota / content generation block, but BEFORE the final `log.info(...)` completion log (~line 378), add:
   ```typescript
   // Send Discord summary if there were failures (fire-and-forget)
   if (modelFailures.length > 0) {
     const matchLabel = `${match.homeTeam} vs ${match.awayTeam} (${competition.name})`;
     sendPredictionRunSummary({
       matchLabel,
       totalModels: filteredProviders.length,
       successful: successCount,
       failed: failCount,
       failures: modelFailures,
     }).catch(() => {}); // Fire and forget
   }
   ```
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Run `npm run build` (or `npx next build --webpack` if turbopack fails locally) to confirm the build succeeds. Grep for `sendPredictionRunSummary` in the worker to confirm it is called.
  </verify>
  <done>
    Prediction worker collects per-model failure data during the run and sends a Discord summary notification when any model fails. Build passes with no type errors.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` (or `npx next build --webpack`) succeeds
3. `sendPredictionRunSummary` is exported from discord.ts and imported in predictions.worker.ts
4. `AutoDisableParams` interface has `errorType?: string` field
5. The `sendAutoDisableAlert` call in queries.ts passes `errorType`
6. The predictions worker collects failures in an array and calls `sendPredictionRunSummary` after the loop
7. No `throw` statements in the new notification code paths (fire-and-forget)
</verification>

<success_criteria>
- Auto-disable Discord alerts now show the error type (parse-error, client-error, etc.) as a separate field
- After prediction runs with failures, a summary Discord notification is sent showing grouped failures by error type with model names and truncated error messages
- Clean prediction runs (0 failures) produce no summary notification
- All notification code follows fire-and-forget pattern (never throws, never blocks pipeline)
- Build and type checks pass
</success_criteria>

<output>
After completion, create `.planning/quick/53-add-detailed-model-errors-to-discord-not/053-SUMMARY.md`
</output>
