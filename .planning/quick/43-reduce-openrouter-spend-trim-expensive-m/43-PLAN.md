---
phase: quick-043
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
  - src/lib/utils/retry-config.ts
  - src/lib/queue/workers/predictions.worker.ts
  - src/lib/seo/metadata.ts
  - src/lib/seo/schema/root.ts
  - src/lib/seo/schemas.ts
  - src/app/layout.tsx
  - src/app/page.tsx
autonomous: true
must_haves:
  truths:
    - "Only 21 models remain in OPENROUTER_PROVIDERS array (17 removed)"
    - "Kimi K2.5 and Qwen3 235B Thinking have maxTokensSingle:500 and maxTokensBatch:800"
    - "Prediction retries reduced from 5 to 2"
    - "recordPredictionCost() is called after successful batch insert in predictions worker"
    - "No references to removed model IDs in routes or arrays"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "21 model definitions (down from 38)"
    - path: "src/lib/llm/index.ts"
      provides: "21 routes in MODEL_PROVIDER_ROUTES, updated comments"
    - path: "src/lib/utils/retry-config.ts"
      provides: "maxRetries: 2 for OPENROUTER_PREDICTION_RETRY"
    - path: "src/lib/queue/workers/predictions.worker.ts"
      provides: "recordPredictionCost() call after batch insert"
  key_links:
    - from: "src/lib/queue/workers/predictions.worker.ts"
      to: "src/lib/llm/budget.ts"
      via: "import recordPredictionCost"
      pattern: "recordPredictionCost"
---

<objective>
Reduce OpenRouter spend by removing 17 duplicate/expensive/old models (38->21), capping output tokens on reasoning models, lowering prediction retries from 5->2, and wiring up the existing but dormant recordPredictionCost() budget tracker in the predictions worker.

Purpose: Cut unnecessary API costs from redundant models and excessive retries, enable cost visibility via budget tracking.
Output: Leaner model roster, lower retry overhead, active cost tracking per prediction.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/providers/openrouter.ts
@src/lib/llm/index.ts
@src/lib/llm/budget.ts
@src/lib/utils/retry-config.ts
@src/lib/queue/workers/predictions.worker.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove 17 model definitions, cap token limits on reasoning models</name>
  <files>src/lib/llm/providers/openrouter.ts</files>
  <action>
  In `src/lib/llm/providers/openrouter.ts`:

  **DELETE the following 17 model constant definitions entirely** (the `export const ...` blocks):
  - `DeepSeekV32_OR` (deepseek-v3.2-or) — lines ~417-433
  - `DeepSeekV3_0324_OR` (deepseek-v3-0324-or) — lines ~539-548
  - `DeepSeekV31Terminus_OR` (deepseek-v3.1-terminus-or) — lines ~551-560
  - `DeepSeekR1_0528_OR` (deepseek-r1-0528) — lines ~607-620
  - `KimiK2_0905_OR` (kimi-k2-0905-or) — lines ~297-306
  - `KimiK2Instruct_OR` (kimi-k2-instruct-or) — lines ~309-318
  - `Qwen3Next80B_OR` (qwen3-next-80b-or) — lines ~205-214
  - `Qwen3Coder480B_OR` (qwen3-coder-480b-or) — lines ~503-512
  - `Qwen25_72B_OR` (qwen2.5-72b-or) — lines ~229-238
  - `Llama4Scout_OR` (llama-4-scout-or) — lines ~105-114
  - `Llama33_70B_OR` (llama-3.3-70b-or) — lines ~133-142
  - `Llama31_405B_OR` (llama-3.1-405b-or) — lines ~157-166
  - `Llama3_8B_OR` (llama-3-8b-or) — lines ~181-190
  - `Llama3_70B_OR` (llama-3-70b-or) — lines ~193-202
  - `GPTOSS20B_OR` (gpt-oss-20b-or) — lines ~337-350
  - `Mistral7Bv02_OR` (mistral-7b-v0.2-or) — lines ~365-374
  - `Mistral7Bv03_OR` (mistral-7b-v0.3-or) — lines ~377-386
  - `GLM46_OR` (glm-4.6-or) — lines ~465-481
  - `GLM47_OR` (glm-4.7-or) — lines ~484-500
  - `MiniMaxM2_OR` (minimax-m2-or) — lines ~436-447

  **MODIFY Kimi K2.5 (`KimiK25_OR`)** promptConfig:
  - Change `maxTokensSingle: 2000` to `maxTokensSingle: 500`
  - Change `maxTokensBatch: 3000` to `maxTokensBatch: 800`

  **MODIFY Qwen3 235B Thinking (`Qwen3_235BThinking_OR`)** promptConfig:
  - Change `maxTokensSingle: 2000` to `maxTokensSingle: 500`
  - Change `maxTokensBatch: 3000` to `maxTokensBatch: 800`

  **UPDATE the `OPENROUTER_PROVIDERS` array** to only include these 21 models (remove all 17 deleted refs):
  ```
  // DeepSeek (2 models)
  DeepSeekR1_OR,
  DeepSeekV31_OR,

  // Moonshot Kimi (1 model)
  KimiK25_OR,

  // Qwen (3 models)
  Qwen3_235B_OR,
  Qwen3_235BThinking_OR,
  Qwen25_7B_OR,

  // Meta Llama (3 models)
  Llama4Maverick_OR,
  Llama31_8B_OR,
  Llama32_3B_OR,

  // OpenAI OSS (1 model)
  GPTOSS120B_OR,

  // Deep Cogito (1 model)
  Cogito671B_OR,

  // Mistral (2 models)
  Ministral3_14B_OR,
  MistralSmall3_24B_OR,

  // NVIDIA (1 model)
  NemotronNano9Bv2_OR,

  // Google (1 model)
  Gemma3nE4B_OR,

  // Z-AI GLM (1 model)
  GLM47Flash_OR,

  // MiniMax (1 model)
  MiniMaxM21_OR,

  // Essential AI (1 model)
  RNJ1Instruct_OR,
  ```

  **UPDATE the section header comment** from "ALL OPENROUTER PROVIDERS (38 models)" to "ALL OPENROUTER PROVIDERS (21 models)".

  Also update family count comments in the array (e.g., "DeepSeek (8 models)" -> "DeepSeek (2 models)").

  Clean up any section header comments that become empty (e.g., if a whole batch section is now gone, remove or simplify the section divider).
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -30` to check for missing references. Grep for any of the removed constant names to ensure no dangling references in this file.</verify>
  <done>17 model definitions deleted, 2 models have capped tokens, OPENROUTER_PROVIDERS array has exactly 21 entries, no TypeScript compilation errors from this file.</done>
</task>

<task type="auto">
  <name>Task 2: Update routes, retry config, and hardcoded model counts</name>
  <files>
    src/lib/llm/index.ts
    src/lib/utils/retry-config.ts
    src/lib/seo/metadata.ts
    src/lib/seo/schema/root.ts
    src/lib/seo/schemas.ts
    src/app/layout.tsx
    src/app/page.tsx
  </files>
  <action>
  **In `src/lib/llm/index.ts`:**

  Remove these 17 entries from `MODEL_PROVIDER_ROUTES`:
  - `'deepseek-v3.2': ['deepseek-v3.2-or']`
  - `'deepseek-v3-0324': ['deepseek-v3-0324-or']`
  - `'deepseek-v3.1-terminus': ['deepseek-v3.1-terminus-or']`
  - `'kimi-k2-0905': ['kimi-k2-0905-or']`
  - `'kimi-k2-instruct': ['kimi-k2-instruct-or']`
  - `'gpt-oss-20b': ['gpt-oss-20b-or']`
  - `'mistral-7b-v0.2': ['mistral-7b-v0.2-or']`
  - `'mistral-7b-v0.3': ['mistral-7b-v0.3-or']`
  - `'llama-4-scout': ['llama-4-scout-or']`
  - `'llama-3.3-70b-turbo': ['llama-3.3-70b-or']`
  - `'llama-3.1-405b-turbo': ['llama-3.1-405b-or']`
  - `'llama-3-8b-lite': ['llama-3-8b-or']`
  - `'llama-3-70b-reference': ['llama-3-70b-or']`
  - `'qwen3-next-80b': ['qwen3-next-80b-or']`
  - `'qwen3-coder-480b': ['qwen3-coder-480b-or']`
  - `'qwen2.5-72b': ['qwen2.5-72b-or']`
  - `'minimax-m2': ['minimax-m2-or']`
  - `'glm-4.6': ['glm-4.6-or']`
  - `'glm-4.7': ['glm-4.7-or']`

  Note: GLM 4.7 Flash uses ID `glm-4.7-flash` (no `-or` suffix) and has NO route entry currently. Leave it as-is (it still works via getActiveProviders). Same for DeepSeek R1 0528 which is being removed anyway.

  Update the comment on line 10 from `// OpenRouter: 38 active models = 38 total` to `// OpenRouter: 21 active models = 21 total`.

  **In `src/lib/utils/retry-config.ts`:**

  Change `OPENROUTER_PREDICTION_RETRY.maxRetries` from `5` to `2`.
  Update the comment from "Increased from 3 to 5 for better reliability" to just "2 retries to reduce spend on expensive models".

  **In `src/lib/seo/metadata.ts`:**

  Change the 3 fallback values from `42` to `21` in lines referencing `activeModels ?? 42`.

  **In `src/lib/seo/schema/root.ts`:**

  Change "comparing 42 AI models" to use dynamic count or just say "comparing 21+ AI models".

  **In `src/lib/seo/schemas.ts`:**

  Change "comparing 42 AI models" to "comparing 21+ AI models".

  **In `src/app/layout.tsx`:**

  Change all "42 AI models" / "42 Models" references to "21+ AI models" / "21+ Models".

  **In `src/app/page.tsx`:**

  Change "42 AI models" references to "21+ AI models".

  **In `src/lib/queue/workers/predictions.worker.ts`:**

  Change the threshold comment on line 87 from `>= 42` to `>= 21`:
  `// Check if predictions are complete (>= 21 = all models done)`
  Change the actual comparison on line 91 from `>= 42` to `>= 21`.
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -30` to check no type errors. Grep for removed route keys to ensure they are gone. Grep for "42 AI" or "42 model" (case-insensitive) across src/ to catch remaining hardcoded counts.</verify>
  <done>MODEL_PROVIDER_ROUTES has 19 entries (21 models minus 2 that had no routes), retry maxRetries is 2, all "42" hardcoded model counts updated to "21+", predictions worker threshold updated to 21.</done>
</task>

<task type="auto">
  <name>Task 3: Wire up recordPredictionCost() in predictions worker</name>
  <files>src/lib/queue/workers/predictions.worker.ts</files>
  <action>
  **In `src/lib/queue/workers/predictions.worker.ts`:**

  1. Add import at top:
  ```typescript
  import { recordPredictionCost } from '@/lib/llm/budget';
  import { OpenRouterProvider } from '@/lib/llm/providers/openrouter';
  ```

  2. After the successful batch insert block (after `await createPredictionsBatch(predictionsToInsert)` and the quotas calculation, around line 335 where model health is recorded), add cost tracking:

  ```typescript
  // Record cost for budget tracking
  for (const modelId of successfulModelIds) {
    await recordModelSuccess(modelId);
    // Track cost per model
    const modelProvider = filteredProviders.find(p => p.id === modelId);
    if (modelProvider && modelProvider instanceof OpenRouterProvider) {
      const estimatedCost = modelProvider.estimateCost(500, 50);
      await recordPredictionCost(modelId, estimatedCost);
    }
  }
  ```

  This replaces the existing `for (const modelId of successfulModelIds)` loop that only calls `recordModelSuccess`. The new version also calls `recordPredictionCost` with estimated cost (500 input tokens, 50 output tokens per the estimateCost defaults in OpenRouterProvider).

  Note: We use the default token estimates (500 input, 50 output) since actual token counts are not available from the current API response handling. This gives a reasonable approximation for budget tracking.
  </action>
  <verify>Run `npx tsc --noEmit 2>&1 | head -20` to verify imports resolve. Grep for `recordPredictionCost` in predictions.worker.ts to confirm it appears in both import and usage.</verify>
  <done>recordPredictionCost() is imported from budget.ts and called for each successful prediction after batch insert, using estimated token costs from the provider's pricing data.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `grep -c "new OpenRouterProvider" src/lib/llm/providers/openrouter.ts` returns 21
3. `grep "maxRetries: 2" src/lib/utils/retry-config.ts` matches for OPENROUTER_PREDICTION_RETRY
4. `grep "recordPredictionCost" src/lib/queue/workers/predictions.worker.ts` shows import + usage
5. `grep -ri "42 AI\|42 model" src/app/ src/lib/seo/` returns no matches
6. Count entries in MODEL_PROVIDER_ROUTES matches 19 (21 models minus glm-4.7-flash and deepseek-r1-0528 which never had routes)
</verification>

<success_criteria>
- 21 models in OPENROUTER_PROVIDERS (down from 38)
- 17 model definitions completely removed from openrouter.ts
- Kimi K2.5 and Qwen3 235B Thinking capped at 500/800 tokens
- Prediction retries reduced to 2
- recordPredictionCost() called in predictions worker after each successful prediction
- All hardcoded "42" model counts updated
- TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/43-reduce-openrouter-spend-trim-expensive-m/43-SUMMARY.md`
</output>
