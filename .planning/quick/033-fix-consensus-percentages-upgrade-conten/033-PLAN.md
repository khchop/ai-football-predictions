---
phase: quick-033
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/together-client.ts
  - src/lib/content/config.ts
  - src/lib/content/prompts.ts
  - src/lib/content/generator.ts
  - src/lib/content/match-content.ts
  - src/lib/utils/retry-config.ts
autonomous: true

must_haves:
  truths:
    - "Match previews display accurate AI consensus percentages calculated from actual prediction data"
    - "Content generation uses Kimi K2 Thinking via Synthetic API instead of Llama 4 Maverick via Together"
    - "Thinking tags from Kimi K2 are stripped before JSON parsing and text usage"
    - "Betting content section uses pre-calculated prediction distribution instead of relying on LLM to honor it"
  artifacts:
    - path: "src/lib/content/together-client.ts"
      provides: "Synthetic API client with thinking tag stripping"
      contains: "api.synthetic.new"
    - path: "src/lib/content/config.ts"
      provides: "Updated model name and pricing"
      contains: "Kimi-K2-Thinking"
    - path: "src/lib/content/prompts.ts"
      provides: "Pre-calculated consensus percentages in prompt"
      contains: "predictionConsensus"
    - path: "src/lib/content/generator.ts"
      provides: "H/D/A calculation from aiPredictions before prompt building"
      contains: "homeWinCount"
  key_links:
    - from: "src/lib/content/generator.ts"
      to: "src/lib/content/prompts.ts"
      via: "predictionConsensus field in MatchPreviewData"
      pattern: "predictionConsensus"
    - from: "src/lib/content/together-client.ts"
      to: "api.synthetic.new"
      via: "SYNTHETIC_API_KEY env var"
      pattern: "SYNTHETIC_API_KEY"
---

<objective>
Fix fabricated consensus percentages in match previews and upgrade the content generation model from Llama 4 Maverick (Together) to Kimi K2 Thinking (Synthetic API).

Purpose: Match previews currently display invented percentage breakdowns (e.g., "45% draw, 35% home win") because the LLM fabricates them instead of calculating from the actual AI prediction data. Simultaneously, upgrading to Kimi K2 Thinking for higher quality content generation.

Output: Accurate consensus percentages in all generated match previews, content generated via Synthetic API with thinking tag handling.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/content/together-client.ts
@src/lib/content/config.ts
@src/lib/content/prompts.ts
@src/lib/content/generator.ts
@src/lib/content/match-content.ts
@src/lib/content/queries.ts
@src/lib/llm/response-handlers.ts
@src/lib/utils/retry-config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix consensus percentages in match preview and betting prompts</name>
  <files>
    src/lib/content/prompts.ts
    src/lib/content/generator.ts
    src/lib/content/match-content.ts
    src/lib/content/queries.ts
  </files>
  <action>
**Problem:** The `buildMatchPreviewPrompt` in `prompts.ts` tells the LLM to state "the overall AI model consensus (e.g., '45% draw, 35% home win, 20% away win')" but the LLM fabricates these numbers instead of calculating from the actual `aiPredictions` data. The predictions only contain model name + bet selection text, not H/D/A tendencies.

**Fix Part A - Add score predictions to preview data:**

1. In `src/lib/content/queries.ts`, create a new function `getMatchPredictionsForPreview(matchId: string)` that queries the `predictions` table (not `bets` table) to get score predictions with their predicted result (H/D/A):
```typescript
export async function getMatchPredictionsForPreview(matchId: string) {
  const db = getDb();
  const result = await db
    .select({
      modelName: models.displayName,
      predictedHome: predictions.predictedHome,
      predictedAway: predictions.predictedAway,
      predictedResult: predictions.predictedResult,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);
  return result;
}
```

2. In `src/lib/content/prompts.ts`, add a `predictionConsensus` field to the `MatchPreviewData` interface:
```typescript
predictionConsensus?: {
  totalModels: number;
  homeWinCount: number;
  homeWinPct: number;
  drawCount: number;
  drawPct: number;
  awayWinCount: number;
  awayWinPct: number;
  topScorelines: string; // e.g., "2-1 (8 models), 1-1 (6 models), 1-0 (5 models)"
};
```

3. In `buildMatchPreviewPrompt`, replace the prediction section instruction at line 80. Instead of the vague "State the overall AI model consensus (e.g., '45% draw, 35% home win, 20% away win')", use the pre-calculated data:
```
"prediction": "AI-powered prediction based on model consensus (150-200 words). ${data.predictionConsensus ?
  `EXACT CONSENSUS DATA (use these exact numbers): ${data.predictionConsensus.homeWinCount} of ${data.predictionConsensus.totalModels} models (${data.predictionConsensus.homeWinPct}%) predict ${homeTeam} win, ${data.predictionConsensus.drawCount} (${data.predictionConsensus.drawPct}%) predict a draw, ${data.predictionConsensus.awayWinCount} (${data.predictionConsensus.awayWinPct}%) predict ${awayTeam} win. Most predicted scorelines: ${data.predictionConsensus.topScorelines}.` :
  'State the overall model consensus.'} Highlight which outcome most models agree on. Reference how the AI consensus compares to the bookmaker odds. Mention confidence level based on model agreement."
```

Also update the AI Model Predictions data section (lines 70-73) to include predicted scores:
```
${data.aiPredictions && data.aiPredictions.length > 0 ? `
AI Model Predictions:
${data.aiPredictions.map(p => `- ${p.model}: ${p.prediction}`).join('\n')}
` : ''}
```
Keep this as-is (it shows betting data), but also add the score predictions section if `predictionConsensus` is present.

**Fix Part B - Calculate consensus in generator.ts:**

4. In `src/lib/content/generator.ts`, update `generateMatchPreview` to:
   - Import `getMatchPredictionsForPreview` from `../content/queries` (careful: generator.ts is in content/ itself, so `./queries`)
   - Before calling `buildMatchPreviewPrompt`, call `getMatchPredictionsForPreview(matchData.matchId)` to get score predictions
   - Calculate H/D/A counts and percentages:
   ```typescript
   const scorePredictions = await getMatchPredictionsForPreview(matchData.matchId);
   let predictionConsensus = undefined;
   if (scorePredictions.length > 0) {
     const homeWinCount = scorePredictions.filter(p => p.predictedResult === 'H').length;
     const drawCount = scorePredictions.filter(p => p.predictedResult === 'D').length;
     const awayWinCount = scorePredictions.filter(p => p.predictedResult === 'A').length;
     const total = scorePredictions.length;

     // Calculate top scorelines
     const scoreFreq: Record<string, number> = {};
     for (const p of scorePredictions) {
       const key = `${p.predictedHome}-${p.predictedAway}`;
       scoreFreq[key] = (scoreFreq[key] || 0) + 1;
     }
     const topScorelines = Object.entries(scoreFreq)
       .sort(([, a], [, b]) => b - a)
       .slice(0, 3)
       .map(([score, count]) => `${score} (${count} models)`)
       .join(', ');

     predictionConsensus = {
       totalModels: total,
       homeWinCount,
       homeWinPct: Math.round((homeWinCount / total) * 100),
       drawCount,
       drawPct: Math.round((drawCount / total) * 100),
       awayWinCount,
       awayWinPct: Math.round((awayWinCount / total) * 100),
       topScorelines,
     };
   }
   ```
   - Pass `predictionConsensus` to the `buildMatchPreviewPrompt` call

**Fix Part C - Strengthen betting content prompt in match-content.ts:**

5. In `src/lib/content/match-content.ts` `generateBettingContent` (around line 337), the prediction distribution IS already calculated correctly (lines 302-305) and passed in the prompt (lines 320-328). But the prompt needs stronger wording to force the LLM to use the exact numbers. Update the prompt instruction at line 345 from:
```
- Consensus prediction (most popular score/outcome)
- Distribution breakdown (how many models favor each side)
```
to:
```
- Consensus prediction: use the EXACT numbers from Prediction Distribution above (do NOT invent different numbers)
- Distribution breakdown: quote the exact model counts from above (e.g., "${homeFavor} models favor Home Win")
```
Where `homeFavor`, `drawFavor`, `awayFavor` are the already-calculated variables from lines 303-305. Interpolate them directly into the instruction string so the LLM cannot ignore them.
  </action>
  <verify>
    Run `npx tsc --noEmit` to verify TypeScript compiles without errors. Grep for "45% draw" or "e.g.," in prompts.ts to confirm the vague example has been removed. Grep for "predictionConsensus" in generator.ts and prompts.ts to confirm the new field is used.
  </verify>
  <done>
    Match preview prompts contain pre-calculated H/D/A percentages from actual prediction data. Betting content prompt uses exact interpolated numbers. No more vague examples that the LLM could copy as actual data.
  </done>
</task>

<task type="auto">
  <name>Task 2: Upgrade content generation from Together/Llama4 to Synthetic/Kimi K2 Thinking</name>
  <files>
    src/lib/content/together-client.ts
    src/lib/content/config.ts
    src/lib/utils/retry-config.ts
  </files>
  <action>
**Upgrade the content generation client to use Kimi K2 Thinking via Synthetic API.**

The Synthetic API is OpenAI-compatible (same request/response format as Together), so the client structure stays identical. Kimi K2 Thinking outputs `<think>...</think>` tags that must be stripped.

1. **Update `src/lib/content/together-client.ts`:**

   a. Rename the file's doc comment from "Together AI" to "Synthetic API (Kimi K2 Thinking)" — update the JSDoc at top.

   b. Change the configuration constants:
   ```typescript
   const MODEL = 'hf:moonshotai/Kimi-K2-Thinking';
   const API_URL = 'https://api.synthetic.new/openai/v1/chat/completions';
   const PRICING = {
     inputCostPerMillion: 2.00,  // USD per 1M tokens
     outputCostPerMillion: 6.00, // USD per 1M tokens
   };
   ```

   c. In BOTH `generateWithTogetherAI` and `generateTextWithTogetherAI`, change the API key from `TOGETHER_API_KEY` to `SYNTHETIC_API_KEY`:
   ```typescript
   const apiKey = process.env.SYNTHETIC_API_KEY;
   if (!apiKey) {
     throw new Error('SYNTHETIC_API_KEY environment variable is not set');
   }
   ```
   Note: `SYNTHETIC_API_KEY` is already configured in production (used by the prediction Synthetic provider).

   d. Add a `stripThinkingTags` function at the top of the file (reuse the same regex logic from `src/lib/llm/response-handlers.ts` but inline it here to avoid cross-module dependency):
   ```typescript
   function stripThinkingTags(text: string): string {
     return text
       .replace(/<think>[\s\S]*?<\/think>/gi, '')
       .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
       .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
       .trim();
   }
   ```

   e. In `generateWithTogetherAI`, after extracting `content` from the response (line 172), strip thinking tags BEFORE any JSON parsing:
   ```typescript
   const rawContent = data.choices[0].message.content;
   const content = stripThinkingTags(rawContent);
   ```

   f. In `generateTextWithTogetherAI`, after extracting `content` from the response (line 305), strip thinking tags before returning:
   ```typescript
   const rawContent = data.choices[0].message.content;
   const content = stripThinkingTags(rawContent);
   ```

   g. Update logger references from `loggers.togetherClient` to still use `loggers.togetherClient` (no need to add a new logger module — the name is just for logging, the service name below handles circuit breaker).

   h. Increase the timeout. Kimi K2 Thinking is a reasoning model — it can take longer. The existing `TOGETHER_CONTENT_TIMEOUT_MS` is 60s which should be sufficient, but we'll increase it in retry-config.

2. **Update `src/lib/content/config.ts`:**

   Update the `CONTENT_CONFIG` object:
   ```typescript
   provider: 'synthetic',
   model: 'hf:moonshotai/Kimi-K2-Thinking',
   apiUrl: 'https://api.synthetic.new/openai/v1/chat/completions',
   pricing: {
     inputCostPerMillion: 2.00,
     outputCostPerMillion: 6.00,
   },
   ```
   Update the comment at top to reflect new pricing and estimated cost (~$5/month instead of ~$0.71/month at ~316 articles/month with longer reasoning outputs).

3. **Update `src/lib/utils/retry-config.ts`:**

   Rename the `TOGETHER_CONTENT_*` section header comment to "SYNTHETIC API - CONTENT (Kimi K2 Thinking)". Keep the same config names (`TOGETHER_CONTENT_RETRY`, `TOGETHER_CONTENT_TIMEOUT_MS`) to avoid updating all importers — just update the comments. Increase timeout from 60s to 90s since reasoning models take longer:
   ```typescript
   export const TOGETHER_CONTENT_TIMEOUT_MS = 90000; // 90s timeout for reasoning model content generation
   ```

   Also update `SERVICE_NAMES.TOGETHER_CONTENT` comment to note it now points to Synthetic. Do NOT rename the constant (would require updating too many imports for no functional benefit).
  </action>
  <verify>
    Run `npx tsc --noEmit` to verify TypeScript compiles. Grep for "SYNTHETIC_API_KEY" in together-client.ts to confirm it uses the right env var. Grep for "Kimi-K2-Thinking" in config.ts. Grep for "stripThinkingTags" in together-client.ts to confirm thinking tag stripping is in place. Grep for "api.synthetic.new" in together-client.ts.
  </verify>
  <done>
    Content generation uses Kimi K2 Thinking via Synthetic API. Thinking tags are stripped before JSON parsing and text output. Config reflects new model, pricing, and provider. Timeout increased for reasoning model. SYNTHETIC_API_KEY is used (already available in production).
  </done>
</task>

<task type="auto">
  <name>Task 3: Build verification and backfill test</name>
  <files>
    src/lib/content/together-client.ts
    src/lib/content/prompts.ts
    src/lib/content/generator.ts
  </files>
  <action>
**Verify the complete pipeline compiles and the consensus calculation logic is correct.**

1. Run `npx tsc --noEmit` to verify the full project compiles without type errors.

2. Run `npm run build` (or `npx next build --webpack` if turbopack fails locally) to verify production build succeeds.

3. Verify no references to old Together API remain in content files:
   - Grep `together.xyz` in `src/lib/content/` — should find NO results (only in together-client.ts which now points to synthetic)
   - Grep `TOGETHER_API_KEY` in `src/lib/content/` — should find NO results
   - Grep `Llama-4-Maverick` in `src/lib/content/` — should find NO results

4. Verify thinking tag handling:
   - Confirm `stripThinkingTags` is called in both `generateWithTogetherAI` and `generateTextWithTogetherAI` before any content processing

5. Verify consensus data flow:
   - Confirm `getMatchPredictionsForPreview` is imported and called in `generator.ts`
   - Confirm `predictionConsensus` is passed to `buildMatchPreviewPrompt`
   - Confirm the prompt text contains "EXACT CONSENSUS DATA" instruction (not the old "e.g., '45% draw'" example)
  </action>
  <verify>
    `npx tsc --noEmit` exits with code 0. Build succeeds. No stale references to Together API in content module. All grep checks pass.
  </verify>
  <done>
    Full pipeline verified: TypeScript compiles, no stale API references, thinking tags handled, consensus percentages flow from DB through generator to prompt.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes (`npx tsc --noEmit`)
2. Production build succeeds
3. No references to `together.xyz` or `TOGETHER_API_KEY` or `Llama-4-Maverick` in content files
4. `stripThinkingTags` is applied before JSON parsing in both generation functions
5. `predictionConsensus` flows from `generator.ts` query -> calculation -> `prompts.ts` template
6. Betting content prompt in `match-content.ts` interpolates exact model counts
</verification>

<success_criteria>
- Match preview prompts contain pre-calculated consensus percentages from actual prediction data (not LLM-fabricated)
- Content generation uses `hf:moonshotai/Kimi-K2-Thinking` via `https://api.synthetic.new/openai/v1/chat/completions`
- `<think>` tags are stripped from all LLM responses before processing
- All existing content types (previews, roundups, reports, betting content, post-match) continue to work with the new model
- Config reflects new model name, provider, and pricing
</success_criteria>

<output>
After completion, create `.planning/quick/033-fix-consensus-percentages-upgrade-conten/033-SUMMARY.md`
</output>
