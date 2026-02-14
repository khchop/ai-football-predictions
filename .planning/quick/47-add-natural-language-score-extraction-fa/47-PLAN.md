---
phase: quick-047
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/prompt.ts
  - src/lib/queue/workers/predictions.worker.ts
autonomous: true
must_haves:
  truths:
    - "Natural language prose predictions (e.g. 'my prediction is 0-2') are successfully parsed into scores"
    - "Enhanced parser is tried as fallback when basic parser fails in the prediction worker"
    - "Existing JSON parsing strategies continue to work unchanged"
  artifacts:
    - path: "src/lib/llm/prompt.ts"
      provides: "Strategy 5: Natural language score extraction in parseBatchPredictionEnhanced"
      contains: "Natural language"
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "Enhanced parser fallback wiring"
      contains: "parseBatchPredictionEnhanced"
  key_links:
    - from: "src/lib/queue/workers/predictions.worker.ts"
      to: "parseBatchPredictionEnhanced"
      via: "fallback call when parseBatchPredictionResponse fails"
      pattern: "parseBatchPredictionEnhanced"
---

<objective>
Add natural language score extraction as a fifth strategy to `parseBatchPredictionEnhanced` and wire the enhanced parser as a fallback in the prediction worker when the basic JSON parser fails.

Purpose: Thinking models like Qwen3 235B sometimes respond with natural language analysis instead of JSON. Currently these responses are treated as parse failures and the prediction is lost. This captures those predictions.

Output: Modified `prompt.ts` with Strategy 5 and modified `predictions.worker.ts` with enhanced parser fallback.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/prompt.ts
@src/lib/queue/workers/predictions.worker.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Strategy 5 - Natural Language Score Extraction</name>
  <files>src/lib/llm/prompt.ts</files>
  <action>
Add a new function `extractNaturalLanguageScores` in `src/lib/llm/prompt.ts` BEFORE the `parseBatchPredictionEnhanced` function (after `extractFlexibleScores` at line ~574). This function extracts scores from prose/natural language responses.

Function signature:
```typescript
function extractNaturalLanguageScores(
  response: string,
  matchIds: string[]
): Array<{ matchId: string; homeScore: number; awayScore: number }> | null
```

Implementation:
1. First, clean the response: strip `<think>...</think>`, `<thinking>...</thinking>`, `<reasoning>...</reasoning>` tags (same as basic parser does).
2. Only works for single-match predictions (`matchIds.length === 1`). Return `null` for multi-match since we cannot reliably assign scores to matches from prose. The matchId to use is `matchIds[0]`.
3. Try these regex patterns in order (on the cleaned text), stopping at first match that yields valid scores:

   a. **Explicit prediction pattern**: `(?:predict(?:ion)?|final\s*score|my\s*(?:prediction|score)|result)\s*(?:is|:)?\s*(\d+)\s*[-\u2013:]\s*(\d+)` (case-insensitive)
      - Matches: "prediction is 0-2", "my prediction: 1-1", "final score 2-1", "result: 3-0"

   b. **Score-at-end pattern**: Search LAST line of text for `(\d+)\s*[-\u2013:]\s*(\d+)`. Split cleaned text by `\n`, find last non-empty line, apply regex.
      - Matches: thinking models put final prediction at end, e.g. "...Therefore 0-2"

   c. **Home/away labeled pattern**: `(?:home|heim)\s*[:=]?\s*(\d+)[\s\S]*?(?:away|aus|gast)\s*[:=]?\s*(\d+)` (case-insensitive)
      - Matches: "Home: 2, Away: 1", "Home 2 - Away 1"

   d. **Last X-Y occurrence in text**: Find ALL matches of `(\d+)\s*[-\u2013]\s*(\d+)` in the text, use the LAST one. This is the most aggressive/fallback pattern.
      - Rationale: Thinking models discuss historical results early but put prediction last.
      - Additional guard: skip if there are more than 10 occurrences of this pattern in the text (likely a stats-heavy response where we cannot reliably identify the prediction).

4. For whichever pattern matches, parse both capture groups as integers, validate with `isValidScore()` (the existing function in the same file - checks 0-20, integer).
5. If valid, return `[{ matchId: matchIds[0], homeScore, awayScore }]`.
6. If no pattern matches or scores are invalid, return `null`.

Then add this as Strategy 5 in `parseBatchPredictionEnhanced`. In the `strategies` array (line ~594), add after the existing 4 entries:
```typescript
{ name: 'Natural language', fn: () => extractNaturalLanguageScores(response, matchIds) },
```
  </action>
  <verify>
Run `npx tsc --noEmit` to verify no type errors. Grep the file for "Natural language" and "extractNaturalLanguageScores" to confirm both the function and the strategy entry exist.
  </verify>
  <done>
`parseBatchPredictionEnhanced` has 5 strategies. The fifth strategy extracts scores from natural language prose for single-match predictions using 4 regex patterns in priority order, with score validation via `isValidScore`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire enhanced parser as fallback in prediction worker</name>
  <files>src/lib/queue/workers/predictions.worker.ts</files>
  <action>
Modify `src/lib/queue/workers/predictions.worker.ts` to use `parseBatchPredictionEnhanced` as a fallback when `parseBatchPredictionResponse` fails.

Step 1: Update the import on line 25. Change:
```typescript
import { parseBatchPredictionResponse, BATCH_SYSTEM_PROMPT } from '@/lib/llm/prompt';
```
to:
```typescript
import { parseBatchPredictionResponse, parseBatchPredictionEnhanced, BATCH_SYSTEM_PROMPT } from '@/lib/llm/prompt';
```

Step 2: Replace the failure block at lines 229-243 (the `if (!parsed.success || parsed.predictions.length === 0)` block). Instead of immediately logging failure and continuing, try the enhanced parser first:

```typescript
if (!parsed.success || parsed.predictions.length === 0) {
  // Try enhanced multi-strategy parser as fallback
  const enhanced = parseBatchPredictionEnhanced(rawResponse, [matchId]);

  if (enhanced.success && enhanced.predictions && enhanced.predictions.length > 0) {
    // Enhanced parser succeeded - use its result
    // Overwrite parsed with compatible structure
    log.info({
      matchId,
      modelId: provider.id,
      strategy: 'enhanced-fallback',
    }, 'Enhanced parser recovered prediction after basic parser failed');

    // Replace parsed so the code below picks it up
    parsed = {
      success: true,
      predictions: enhanced.predictions.map(p => ({
        matchId: p.matchId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
      })),
    };
  } else {
    // Both parsers failed - record failure
    const responsePreview = rawResponse.slice(0, 300).replace(/\s+/g, ' ');
    const errorType = ErrorType.PARSE_ERROR;
    log.warn({
      matchId,
      modelId: provider.id,
      error: parsed.error,
      errorType,
      rawResponsePreview: responsePreview
    }, 'Failed to parse prediction (basic + enhanced parsers failed)');
    await recordModelFailure(provider.id, parsed.error || 'Parse failed', errorType);
    failCount++;
    continue;
  }
}
```

Important: The `parsed` variable is declared with `const` at line 227. It needs to be changed to `let` so we can reassign it when the enhanced parser succeeds:
```typescript
let parsed = parseBatchPredictionResponse(rawResponse, [matchId]);
```

The `BatchParsedResult` and `EnhancedParseResult` types are compatible for the fields we use downstream (`predictions[0].homeScore`, `predictions[0].awayScore`, `predictions[0].matchId`), so no further type changes needed.
  </action>
  <verify>
Run `npx tsc --noEmit` to verify no type errors. Grep `predictions.worker.ts` for `parseBatchPredictionEnhanced` to confirm it is imported and called. Verify the `let parsed` change is in place.
  </verify>
  <done>
When `parseBatchPredictionResponse` fails in the prediction worker, `parseBatchPredictionEnhanced` is tried as a fallback. Only if both parsers fail does `recordModelFailure` get called. The enhanced parser fallback is logged with strategy "enhanced-fallback" for monitoring.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` completes successfully (or `npx next build --webpack` as fallback)
3. Grep confirms `extractNaturalLanguageScores` function exists in prompt.ts
4. Grep confirms `parseBatchPredictionEnhanced` is imported and called in predictions.worker.ts
5. The 5 strategies in `parseBatchPredictionEnhanced` are: Direct JSON, Markdown code block, Score pattern regex, Flexible pattern, Natural language
</verification>

<success_criteria>
- Natural language responses like "my prediction is 0-2" are parsed into valid predictions
- Enhanced parser is only tried when the basic parser fails (no unnecessary overhead)
- Existing JSON parsing behavior is completely unchanged
- Type checking passes
- Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/47-add-natural-language-score-extraction-fa/47-SUMMARY.md`
</output>
