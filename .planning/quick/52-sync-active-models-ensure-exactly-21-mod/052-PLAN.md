---
phase: quick-052
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
  - src/lib/db/sync-models.ts
  - src/app/llms-full.txt/route.ts
  - src/app/llms.txt/route.ts
autonomous: true
must_haves:
  truths:
    - "Exactly 21 OpenRouter providers are exported in OPENROUTER_PROVIDERS array"
    - "5 removed models (qwen3-235b-thinking, llama-4-maverick, cogito-671b, devstral-small, nemotron-nano-9b-v2) have no provider definitions and no routes"
    - "5 new models (gpt-oss-120b, glm-4.7, llama-3.3-70b, devstral-2, nemotron-3-nano-30b-a3b) have provider definitions with correct pricing/config and routes"
    - "sync-models sets archived:false on upsert so previously-archived models become active again"
    - "llms-full.txt and llms.txt reflect 21 OpenRouter models, not 29 Together AI models"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "21 OpenRouter provider definitions"
      contains: "OPENROUTER_PROVIDERS"
    - path: "src/lib/llm/index.ts"
      provides: "21 model provider routes"
      contains: "MODEL_PROVIDER_ROUTES"
    - path: "src/lib/db/sync-models.ts"
      provides: "archived:false in upsert set() call"
      contains: "archived: false"
  key_links:
    - from: "src/lib/llm/providers/openrouter.ts"
      to: "src/lib/llm/index.ts"
      via: "OPENROUTER_PROVIDERS export consumed by ALL_PROVIDERS and MODEL_PROVIDER_ROUTES"
      pattern: "OPENROUTER_PROVIDERS"
---

<objective>
Swap 5 underperforming/unavailable models for 5 new models in the OpenRouter provider array, keeping the total at exactly 21 active models. Update routing, sync logic, and public-facing model lists.

Purpose: Maintain a curated set of 21 active models with up-to-date provider availability and pricing.
Output: Updated provider definitions, routes, sync logic, and llms.txt content.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/providers/openrouter.ts
@src/lib/llm/index.ts
@src/lib/db/sync-models.ts
@src/app/llms-full.txt/route.ts
@src/app/llms.txt/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap 5 providers in openrouter.ts and update routes in index.ts</name>
  <files>src/lib/llm/providers/openrouter.ts, src/lib/llm/index.ts</files>
  <action>
In `src/lib/llm/providers/openrouter.ts`:

**REMOVE these 5 provider definitions entirely (delete the export const blocks):**
1. `Qwen3_235BThinking_OR` (lines 160-177) - qwen3-235b-thinking-or
2. `Llama4Maverick_OR` (lines 88-98) - llama-4-maverick-or
3. `Cogito671B_OR` (lines 100-110) - cogito-671b-or
4. `DevstralSmall_OR` (lines 246-255) - devstral-small-or
5. `NemotronNano9Bv2_OR` (lines 179-189) - nemotron-nano-9b-v2-or

**ADD these 5 new provider definitions (add them in the "KEPT OPENROUTER PROVIDERS" section or inline with their family groupings):**

1. GPT-OSS 120B:
```typescript
export const GPTOSS120B_OR = new OpenRouterProvider(
  'gpt-oss-120b-or',
  'openrouter',
  'openai/gpt-oss-120b',
  'GPT-OSS 120B (OpenRouter)',
  'budget',
  { promptPer1M: 0.039, completionPer1M: 0.19 },
  false,
  {}
);
```

2. GLM-4.7 (same config pattern as GLM-5 since both are Z-AI reasoning models):
```typescript
export const GLM47_OR = new OpenRouterProvider(
  'glm-4.7-or',
  'openrouter',
  'z-ai/glm-4.7',
  'GLM-4.7 (OpenRouter)',
  'premium',
  { promptPer1M: 0.40, completionPer1M: 1.50 },
  true,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 120000,
    supportsJsonMode: false,
    maxTokensSingle: 1000,
    maxTokensBatch: 1500,
  }
);
```

3. Llama 3.3 70B Instruct:
```typescript
export const Llama33_70B_OR = new OpenRouterProvider(
  'llama-3.3-70b-or',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B Instruct (OpenRouter)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.32 },
  false,
  {}
);
```

4. Devstral 2 (replaces devstral-small):
```typescript
export const Devstral2_OR = new OpenRouterProvider(
  'devstral-2-or',
  'openrouter',
  'mistralai/devstral-2512',
  'Devstral 2 (OpenRouter)',
  'budget',
  { promptPer1M: 0.05, completionPer1M: 0.22 },
  false,
  {}
);
```

5. NVIDIA Nemotron 3 Nano 30B A3B (replaces nemotron-nano-9b-v2):
```typescript
export const Nemotron3Nano30B_OR = new OpenRouterProvider(
  'nemotron-3-nano-30b-a3b-or',
  'openrouter',
  'nvidia/nemotron-3-nano-30b-a3b',
  'Nemotron 3 Nano 30B A3B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.20 },
  false,
  {}
);
```

**UPDATE the OPENROUTER_PROVIDERS array:**
- Remove: `Qwen3_235BThinking_OR`, `Llama4Maverick_OR`, `Cogito671B_OR`, `DevstralSmall_OR`, `NemotronNano9Bv2_OR`
- Add: `GPTOSS120B_OR`, `GLM47_OR`, `Llama33_70B_OR`, `Devstral2_OR`, `Nemotron3Nano30B_OR`
- Update section comments to reflect new groupings:
  - Qwen: 2 models (remove "235B Thinking", keep 235B + 30B A3B)
  - Meta Llama: 2 models (remove Maverick, add Llama 3.3 70B, keep Scout)
  - OpenAI OSS: 2 models (keep 20B, add 120B)
  - Deep Cogito: remove section entirely (0 models)
  - Mistral: 2 models (replace Devstral Small with Devstral 2, keep Mistral Small 3.2)
  - NVIDIA: 1 model (replace Nemotron Nano 9B v2 with Nemotron 3 Nano 30B A3B)
  - Z-AI GLM: 2 models (keep GLM-5, add GLM-4.7)
- Update header comment count: still "21 models"
- Update the "KEPT OPENROUTER PROVIDERS" section header count from "7 models" to match actual (will be 5 after removing 3 from that section; alternatively reorganize all into a single section)

In `src/lib/llm/index.ts`:

**Remove these 5 routes from MODEL_PROVIDER_ROUTES:**
- `'qwen3-235b-thinking': ['qwen3-235b-thinking-or']`
- `'llama-4-maverick': ['llama-4-maverick-or']`
- `'cogito-671b': ['cogito-671b-or']`
- `'devstral-small': ['devstral-small-or']`
- `'nemotron-nano-9b-v2': ['nemotron-nano-9b-v2-or']`

**Add these 5 routes:**
- `'gpt-oss-120b': ['gpt-oss-120b-or']`
- `'glm-4.7': ['glm-4.7-or']`
- `'llama-3.3-70b': ['llama-3.3-70b-or']`
- `'devstral-2': ['devstral-2-or']`
- `'nemotron-3-nano-30b-a3b': ['nemotron-3-nano-30b-a3b-or']`

Update section comments in MODEL_PROVIDER_ROUTES to match new groupings:
- Qwen: 2 (remove thinking)
- Meta Llama: 2 (Scout + Llama 3.3 70B, remove Maverick)
- OpenAI OSS: 2 (20B + 120B)
- Deep Cogito: remove section
- Mistral: 2 (Devstral 2 + Mistral Small 3.2)
- NVIDIA: 1 (Nemotron 3 Nano 30B A3B)
- Z-AI GLM: 2 (GLM-5 + GLM-4.7)

Keep the count comment "21 active models = 21 total".
  </action>
  <verify>
Run `npx tsc --noEmit` to confirm no TypeScript errors (all references resolve).
Count providers in array: `grep -c '_OR,' src/lib/llm/providers/openrouter.ts` should show 21 entries.
Count routes: `grep -c "': \['" src/lib/llm/index.ts` should show 21 entries.
Confirm removed exports are not referenced: `grep -rn 'Qwen3_235BThinking_OR\|Llama4Maverick_OR\|Cogito671B_OR\|DevstralSmall_OR\|NemotronNano9Bv2_OR' src/` should return nothing.
  </verify>
  <done>
Exactly 21 providers in OPENROUTER_PROVIDERS array. Exactly 21 routes in MODEL_PROVIDER_ROUTES. No dangling references to removed models. New models have correct pricing, tiers, and prompt configs. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix sync-models archived flag and update llms.txt content</name>
  <files>src/lib/db/sync-models.ts, src/app/llms-full.txt/route.ts, src/app/llms.txt/route.ts</files>
  <action>
In `src/lib/db/sync-models.ts`:

In the update branch (around line 68-77), add `archived: false` to the `.set()` call so that previously-archived models get un-archived when they appear in the active providers list. The current `.set()` call updates provider, modelName, displayName, isPremium, active but NOT archived. Change to:

```typescript
await db
  .update(models)
  .set({
    provider: provider.name,
    modelName: provider.model,
    displayName: provider.displayName,
    isPremium: provider.isPremium,
    active: true,
    archived: false,
  })
  .where(eq(models.id, provider.id));
```

This is critical: without this fix, models that were previously archived in the DB will stay archived even when re-added to the code providers array.

In `src/app/llms-full.txt/route.ts`:

Replace the entire hardcoded model list (lines 22-67 approximately) with the current 21 OpenRouter models. The content currently references "29 open-source language models" via Together AI which is completely outdated. Update to:

- Change "29 open-source language models" to "21 open-source language models"
- Change "All models are open-source and served via Together AI infrastructure" to "All models are open-source and served via OpenRouter infrastructure"
- Replace the entire model list with the current 21 models organized by family:

```
### DeepSeek (2 models)
- DeepSeek V3.2 (deepseek/deepseek-v3.2)
- DeepSeek R1-0528 (deepseek/deepseek-r1-0528) - Premium

### Moonshot/Kimi (1 model)
- Kimi K2.5 (moonshotai/kimi-k2.5)

### Qwen/Alibaba (2 models)
- Qwen3 235B (qwen/qwen3-235b)
- Qwen3 30B A3B (qwen/qwen3-30b-a3b)

### Meta Llama (2 models)
- Llama 4 Scout (meta-llama/llama-4-scout-17b-16e-instruct)
- Llama 3.3 70B Instruct (meta-llama/llama-3.3-70b-instruct)

### OpenAI OSS (2 models)
- GPT-OSS 20B (openai/gpt-oss-20b)
- GPT-OSS 120B (openai/gpt-oss-120b)

### Mistral (2 models)
- Devstral 2 (mistralai/devstral-2512)
- Mistral Small 3.2 24B (mistralai/mistral-small-3.2-24b-instruct)

### StepFun (1 model)
- Step 3.5 Flash (stepfun/step-3.5-flash)

### NVIDIA (1 model)
- Nemotron 3 Nano 30B A3B (nvidia/nemotron-3-nano-30b-a3b)

### Google (2 models)
- Gemma 3 27B (google/gemma-3-27b-it)
- Gemma 3 12B (google/gemma-3-12b-it)

### Z-AI GLM (2 models)
- GLM-5 (z-ai/glm-5) - Premium
- GLM-4.7 (z-ai/glm-4.7) - Premium

### MiniMax (2 models)
- MiniMax M2.1 (minimax/minimax-m2.1)
- MiniMax M2.5 (minimax/minimax-m2.5)

### Arcee AI (1 model)
- Trinity Large Preview (arcee-ai/trinity-large-preview:free)

### Microsoft (1 model)
- Phi-4 (microsoft/phi-4)
```

Also update in the same file:
- "Technical Architecture" section: Change "Together AI API (all 29 models + content generation)" to "OpenRouter API (all 21 models)"
- "Prediction Process" section step 5: Change "Llama 4 Maverick generates match analysis blog post" to a generic "AI model generates match analysis blog post" (since Maverick is removed)
- Update "Version: 1.0" to "Version: 2.0" and "Last Updated" to "2026-02-14"

In `src/app/llms.txt/route.ts`:

Update the "Technical Details" section (around line 72):
- Change `"AI Models": Together AI, OpenAI, Anthropic, Google, Meta` to `"AI Models": 21 open-source models via OpenRouter`

This file is mostly dynamic (reads model count from DB) so it needs minimal changes.
  </action>
  <verify>
Confirm `archived: false` is in the sync-models .set() call: `grep 'archived: false' src/lib/db/sync-models.ts`.
Confirm llms-full.txt references 21 models: `grep '21' src/app/llms-full.txt/route.ts`.
Confirm no Together AI references remain: `grep -i 'together ai' src/app/llms-full.txt/route.ts src/app/llms.txt/route.ts` should return nothing.
Run `npx tsc --noEmit` to confirm no TypeScript errors.
  </verify>
  <done>
sync-models.ts sets `archived: false` during upsert. llms-full.txt lists exactly 21 current OpenRouter models with correct model IDs and family groupings. llms.txt references OpenRouter not Together AI. No stale model references remain.
  </done>
</task>

<task type="auto">
  <name>Task 3: Build verification and test fixture note</name>
  <files>src/__tests__/fixtures/golden/all-models.json</files>
  <action>
The golden fixture `all-models.json` contains placeholder data from Together AI era (29 models referencing "together" provider). This fixture is historical test data with placeholder error messages. Do NOT update it -- it would need to be regenerated via `npx tsx scripts/generate-golden-fixtures.ts` against a live environment, which is not possible in this context.

Instead, run the full build to verify everything compiles:
1. Run `npx tsc --noEmit` to verify TypeScript compilation
2. Run `npm run build -- --webpack` to verify production build (use webpack fallback per project memory)
3. Run `npm test` to check for any broken tests

If tests reference the removed model IDs in assertions, update those specific assertions. The golden fixture itself should be left as-is since it's placeholder data.
  </action>
  <verify>
`npx tsc --noEmit` exits 0.
`npm run build -- --webpack` exits 0 (or `npm run build` if turbopack works).
`npm test` passes (or only pre-existing failures unrelated to this change).
  </verify>
  <done>
TypeScript compiles. Production build succeeds. Tests pass or have only pre-existing failures. No regressions from the model swap.
  </done>
</task>

</tasks>

<verification>
1. Count check: `OPENROUTER_PROVIDERS` array has exactly 21 entries
2. Count check: `MODEL_PROVIDER_ROUTES` has exactly 21 keys
3. No dangling refs: removed model variable names not referenced anywhere in src/
4. New models present: all 5 new provider IDs appear in both openrouter.ts and index.ts
5. Sync fix: `archived: false` appears in sync-models.ts .set() call
6. Content accuracy: llms-full.txt lists 21 models via OpenRouter, no Together AI references
7. Build passes: `npx tsc --noEmit` and production build succeed
</verification>

<success_criteria>
- Exactly 21 OpenRouter providers active (5 removed, 5 added, 16 unchanged)
- All new providers have correct model IDs, pricing, tiers, and prompt configs
- MODEL_PROVIDER_ROUTES has exactly 21 entries matching the 21 providers
- sync-models.ts un-archives models on upsert (archived: false in .set())
- llms-full.txt and llms.txt reflect current 21-model OpenRouter architecture
- TypeScript compiles and production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/52-sync-active-models-ensure-exactly-21-mod/052-SUMMARY.md`
</output>
