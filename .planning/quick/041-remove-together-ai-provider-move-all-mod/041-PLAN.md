---
phase: quick-041
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1: Provider migration
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/providers/base.ts
  - src/lib/llm/index.ts
  - src/lib/llm/budget.ts
  - src/lib/content/config.ts
  - src/lib/content/together-client.ts
  - src/lib/content/match-content.ts
  - src/lib/content/generator.ts
  - src/lib/utils/env-validation.ts
  - src/lib/utils/retry-config.ts
  # Task 2: Delete Together provider + update all consumers
  - src/lib/llm/providers/together.ts  # DELETE
  - src/components/admin/model-health-table.tsx
  - src/components/admin/model-health-cards.tsx
  - src/app/api/admin/data/route.ts
  - src/app/api/admin/fallback-stats/route.ts
  - src/__tests__/setup.ts
  - src/__tests__/fixtures/golden/index.ts
  - src/__tests__/integration/models/all-models.test.ts
  - src/__tests__/integration/models/regression.test.ts
  - scripts/validate-model-ids.ts
  - scripts/validate-all-models.ts
  - scripts/sync-models.ts
  - scripts/diagnose-models.ts
  - scripts/generate-golden-fixtures.ts
  - scripts/diagnostic/run-diagnostics.ts
  - src/lib/logger/modules.ts
  - package.json
autonomous: true

must_haves:
  truths:
    - "All LLM predictions route through OpenRouter only (no Together API calls)"
    - "Content generation uses OpenRouter API instead of Together API"
    - "Each model appears once in the system (no duplicates from multiple providers)"
    - "Application builds and type-checks with zero errors"
    - "No TOGETHER_API_KEY references remain in application source (src/)"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "All model definitions (former Together + existing OpenRouter), ModelPricing and ModelTier types"
      contains: "ModelPricing|ModelTier|OPENROUTER_PROVIDERS"
    - path: "src/lib/llm/index.ts"
      provides: "ALL_PROVIDERS using only OPENROUTER_PROVIDERS, updated MODEL_PROVIDER_ROUTES with single-entry OpenRouter routes"
      contains: "ALL_PROVIDERS|MODEL_PROVIDER_ROUTES"
    - path: "src/lib/content/together-client.ts"
      provides: "Content generation using OpenRouter API (renamed functions optional, API endpoint changed)"
      contains: "openrouter.ai"
  key_links:
    - from: "src/lib/llm/index.ts"
      to: "src/lib/llm/providers/openrouter.ts"
      via: "import OPENROUTER_PROVIDERS"
      pattern: "import.*OPENROUTER_PROVIDERS.*openrouter"
    - from: "src/lib/llm/providers/openrouter.ts"
      to: "src/lib/llm/providers/base.ts"
      via: "extends OpenAICompatibleProvider"
      pattern: "class OpenRouterProvider extends OpenAICompatibleProvider"
---

<objective>
Remove Together AI as a provider, migrate all 23 Together models to OpenRouter, and deduplicate model entries so each model appears exactly once. After this, OpenRouter is the sole LLM provider.

Purpose: Simplify from 2-provider architecture to single-provider (OpenRouter), reducing operational complexity, eliminating Together API dependency, and removing duplicate model definitions.

Output: Single-provider architecture where all ~42 unique models route through OpenRouter only, together.ts deleted, no TOGETHER_API_KEY references in source.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/040-remove-synthetic-providers-use-openroute/040-SUMMARY.md
@src/lib/llm/providers/together.ts
@src/lib/llm/providers/openrouter.ts
@src/lib/llm/providers/base.ts
@src/lib/llm/index.ts
@src/lib/llm/budget.ts
@src/lib/content/together-client.ts
@src/lib/content/config.ts
@src/lib/utils/env-validation.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate all Together models to OpenRouter and update core LLM module</name>
  <files>
    src/lib/llm/providers/openrouter.ts
    src/lib/llm/providers/base.ts
    src/lib/llm/index.ts
    src/lib/llm/budget.ts
    src/lib/content/config.ts
    src/lib/content/together-client.ts
    src/lib/content/match-content.ts
    src/lib/content/generator.ts
    src/lib/utils/env-validation.ts
    src/lib/utils/retry-config.ts
    src/lib/logger/modules.ts
  </files>
  <action>
**Step 1: Move shared types to openrouter.ts**

In `src/lib/llm/providers/openrouter.ts`:
- Move `ModelPricing` interface and `ModelTier` type from together.ts into openrouter.ts (currently openrouter.ts imports these from together.ts). Place them BEFORE the OpenRouterProvider class definition.
- Remove the `import { ModelPricing, ModelTier } from './together';` line.

**Step 2: Add missing OpenRouter model definitions**

For each of the 23 active Together models, ensure an OpenRouter equivalent exists. Most already exist as fallbacks. The ones that need promptConfig synced from their Together counterparts (if not already done):

Models already in openrouter.ts with correct configs: DeepSeekR1_OR, DeepSeekV31_OR, KimiK2_0905_OR, KimiK2Instruct_OR, KimiK25_OR, Qwen3_235B_OR (instruct equivalent), Qwen3Next80B_OR, Qwen25_7B_OR, Qwen25_72B_OR, Llama4Maverick_OR, Llama4Scout_OR, Llama33_70B_OR, Llama31_8B_OR, Llama31_405B_OR, Llama32_3B_OR, Llama3_8B_OR, Llama3_70B_OR, GPTOSS20B_OR, Cogito671B_OR, Ministral3_14B_OR, MistralSmall3_24B_OR, Mistral7Bv02_OR, Mistral7Bv03_OR, NemotronNano9Bv2_OR, Gemma3nE4B_OR, RNJ1Instruct_OR.

Missing from OpenRouter (no equivalent available): **Marin 8B** (marin-community/marin-8b-instruct) -- this model will be dropped entirely as it's not available on OpenRouter.

Sync promptConfigs from Together definitions to their OpenRouter counterparts where needed:
- `DeepSeekV31_OR`: Add `maxTokensSingle: 500, maxTokensBatch: 1000` (from Together's DeepSeekV31Provider)
- `DeepSeekR1_OR`: Already has THINKING_STRIPPED + STRIP_THINKING_TAGS + timeoutMs: 120000 -- GOOD
- `KimiK25_OR`: Add `supportsJsonMode: false, maxTokensSingle: 2000, maxTokensBatch: 3000` (from Together's KimiK25Provider)
- `Qwen3_235B_OR` (maps to qwen3-235b-instruct): Add `maxTokensSingle: 500, maxTokensBatch: 1000` (from Together's Qwen3_235BInstructProvider). Note: Qwen3_235B_OR has id 'qwen3-235b-or' and maps to Together's 'qwen3-235b-instruct' -- keep the OR id.
- `GPTOSS20B_OR`: Add `supportsJsonMode: false, maxTokensSingle: 300, maxTokensBatch: 1000` (from Together's GPTOSS20BProvider)

All other OpenRouter models either already have correct configs or use defaults (which match their Together counterparts).

**Step 3: Update OPENROUTER_PROVIDERS array**

Reorganize the OPENROUTER_PROVIDERS array. All models are now primary. Remove the "Together AI fallbacks" and "Synthetic fallbacks" section labels. Group by model family (DeepSeek, Moonshot, Qwen, Meta Llama, etc.) with clear comments. Update the count comment to reflect the new total.

**Step 4: Update `src/lib/llm/index.ts`**

- Remove `import { TOGETHER_PROVIDERS } from './providers/together';`
- Change `ALL_PROVIDERS` to use `OPENROUTER_PROVIDERS`:
  ```
  export const ALL_PROVIDERS: LLMProvider[] = [...OPENROUTER_PROVIDERS];
  ```
- Update comment from "Together AI core providers" to "OpenRouter providers (sole provider)"
- Update MODEL_PROVIDER_ROUTES: ALL routes become single-entry arrays with just the OpenRouter ID. For the 22 routes that currently have `['together-id', 'or-id']`, change to `['or-id']`. The 14 routes already OpenRouter-only stay as-is. Remove the Marin 8B route entirely (model dropped).
- In `getActiveProviders()`: Remove the `if (process.env.TOGETHER_API_KEY)` block entirely. Change logic to only check `OPENROUTER_API_KEY`:
  ```
  if (process.env.OPENROUTER_API_KEY) {
    // Filter out fallback-only providers...
    activeProviders.push(
      ...OPENROUTER_PROVIDERS.filter(p => !disabledIds.has(p.id) && !fallbackProviderIds.has(p.id))
    );
  }
  ```
- In `getProviderById()`: Remove the ALL_PROVIDERS.find check. Only check OPENROUTER_PROVIDERS:
  ```
  return OPENROUTER_PROVIDERS.find(p => p.id === id);
  ```
- In `getFreeProviders()` and `getPremiumProviders()`: Change from `ALL_PROVIDERS` to `OPENROUTER_PROVIDERS`
- In `getProviderStats()`: Remove `together` field. Change to single `openrouter: OPENROUTER_PROVIDERS.length`. Remove `TOGETHER_PROVIDERS` from allProviders.
- Remove `export { TOGETHER_PROVIDERS };`
- Remove `export { TogetherProvider, type ModelTier, type ModelPricing } from './providers/together';`
- Add `export { type ModelTier, type ModelPricing } from './providers/openrouter';` (types now in openrouter.ts)
- Keep `export { OpenRouterProvider } from './providers/openrouter';`

**Step 5: Update `src/lib/llm/budget.ts`**

- Change `import { TogetherProvider, ModelTier } from './providers/together';` to `import { OpenRouterProvider, ModelTier } from './providers/openrouter';`
- Change `shouldSkipProvider` parameter type from `TogetherProvider | { tier?...}` to `OpenRouterProvider | { tier?...}`

**Step 6: Update content generation to use OpenRouter**

In `src/lib/content/config.ts`:
- Change `provider: 'together'` to `provider: 'openrouter'`
- Change `model:` to the OpenRouter model ID for DeepSeek V3.1: `'deepseek/deepseek-chat-v3.1'`
- Change `apiUrl:` to `'https://openrouter.ai/api/v1/chat/completions'`
- Update pricing to OpenRouter rates: `inputCostPerMillion: 0.15, outputCostPerMillion: 0.75`

In `src/lib/content/together-client.ts`:
- Update file-level JSDoc: "Content Generation Client (DeepSeek V3.1 via OpenRouter)"
- Change `MODEL` to `'deepseek/deepseek-chat-v3.1'`
- Change `API_URL` to `'https://openrouter.ai/api/v1/chat/completions'`
- Update `PRICING` to OpenRouter rates: `{ inputCostPerMillion: 0.15, outputCostPerMillion: 0.75 }`
- Change `FALLBACK_MODEL` to `'meta-llama/llama-4-maverick-17b-128e-instruct'` (OpenRouter ID)
- Change `FALLBACK_API_URL` to `'https://openrouter.ai/api/v1/chat/completions'`
- Update `FALLBACK_PRICING` to OpenRouter rates: `{ inputCostPerMillion: 0.10, outputCostPerMillion: 0.25 }`
- Rename `TogetherMessage` to `OpenRouterMessage`, `TogetherRequest` to `OpenRouterRequest`, `TogetherResponse` to `OpenRouterResponse` (or keep generic names like `LLMMessage`)
- Change `process.env.TOGETHER_API_KEY` references (lines 209, 212, 409, 412) to `process.env.OPENROUTER_API_KEY`
- Change the error messages from 'TOGETHER_API_KEY' to 'OPENROUTER_API_KEY'
- Update the `Authorization: Bearer ${apiKey}` header calls to also include OpenRouter-standard headers:
  ```
  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'X-Title': 'Football AI Predictions',
  ```
- Update all log messages from "DeepSeek V3.1" and "Llama 4 Maverick" to mention "(OpenRouter)" suffix
- Keep function names `generateWithTogetherAI` and `generateTextWithTogetherAI` as-is OR rename to `generateWithOpenRouter` / `generateTextWithOpenRouter`. If renaming, also update imports in `match-content.ts` and `generator.ts`. Renaming is preferred for clarity.

In `src/lib/content/match-content.ts`:
- Update import from `'./together-client'` -- if functions were renamed, update the import names. If file is being renamed, update path.

In `src/lib/content/generator.ts`:
- Same as match-content.ts -- update import if function names changed.

**Step 7: Update env-validation.ts**

In `src/lib/utils/env-validation.ts`:
- Change `TOGETHER_API_KEY` entry to `OPENROUTER_API_KEY`:
  ```
  { name: 'OPENROUTER_API_KEY', required: true, description: 'OpenRouter API key for predictions and content generation' }
  ```
- Remove the separate optional OPENROUTER_API_KEY entry (it's now the required one above)

**Step 8: Update retry-config.ts**

In `src/lib/utils/retry-config.ts`:
- Rename `TOGETHER_CONTENT_RETRY` to `OPENROUTER_CONTENT_RETRY` (or keep name, it's internal)
- Rename `TOGETHER_CONTENT_TIMEOUT_MS` to `OPENROUTER_CONTENT_TIMEOUT_MS`
- Rename `TOGETHER_CONTENT_FALLBACK_RETRY` to `OPENROUTER_CONTENT_FALLBACK_RETRY`
- Rename `TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS` to `OPENROUTER_CONTENT_FALLBACK_TIMEOUT_MS`
- Update SERVICE_NAMES: `TOGETHER_CONTENT` -> `OPENROUTER_CONTENT`, `TOGETHER_CONTENT_FALLBACK` -> `OPENROUTER_CONTENT_FALLBACK`
- Update the imports in together-client.ts to match the new names

**Step 9: Update logger modules**

In `src/lib/logger/modules.ts`:
- Rename `togetherClient` logger to `openrouterClient` (or `contentClient`). Update references in together-client.ts accordingly. If keeping `togetherClient` name for backward compat, at minimum update the string: `createLogger('openrouter-client')`.

**Step 10: Update base.ts comments**

In `src/lib/llm/providers/base.ts`:
- Update SERVICE_NAMES import if renamed
- Update any comments referencing "Together AI" to "OpenRouter"
- The `callAPIWithFallback` log message "attempting fallback to Together AI" should be "attempting next provider in route"
  </action>
  <verify>
    Run `npx tsc --noEmit` to verify zero TypeScript errors.
    Run `grep -r "TOGETHER_API_KEY" src/` to confirm no references remain in src/ (some may remain in scripts/, that's OK for task 2).
    Run `grep -r "api.together.xyz" src/` to confirm no Together API URLs remain.
    Run `grep -r "from.*together" src/lib/llm/` to confirm no imports from together.ts.
  </verify>
  <done>
    - OpenRouterProvider is the sole provider class
    - ModelPricing and ModelTier types live in openrouter.ts
    - ALL_PROVIDERS uses OPENROUTER_PROVIDERS only
    - MODEL_PROVIDER_ROUTES has single-entry OpenRouter-only routes for all models
    - Content generation uses OpenRouter API (openrouter.ai endpoint)
    - OPENROUTER_API_KEY is the only required LLM API key
    - Marin 8B model dropped (not on OpenRouter)
    - TypeScript compilation passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete Together provider file and update all consumers (tests, scripts, admin UI)</name>
  <files>
    src/lib/llm/providers/together.ts
    src/components/admin/model-health-table.tsx
    src/app/api/admin/data/route.ts
    src/app/api/admin/fallback-stats/route.ts
    src/__tests__/setup.ts
    src/__tests__/fixtures/golden/index.ts
    src/__tests__/integration/models/all-models.test.ts
    src/__tests__/integration/models/regression.test.ts
    scripts/validate-model-ids.ts
    scripts/validate-all-models.ts
    scripts/sync-models.ts
    scripts/diagnose-models.ts
    scripts/generate-golden-fixtures.ts
    scripts/diagnostic/run-diagnostics.ts
    package.json
  </files>
  <action>
**Step 1: Delete together.ts**

Delete `src/lib/llm/providers/together.ts` entirely. This file defined the TogetherProvider class and 30 model instances. All its functionality is now in openrouter.ts.

**Step 2: Update admin UI components**

In `src/components/admin/model-health-table.tsx`:
- Change `import { TogetherProvider } from '@/lib/llm/providers/together'` to `import { OpenRouterProvider } from '@/lib/llm/providers/openrouter'`
- Change `providerConfig: Map<string, TogetherProvider>` to `providerConfig: Map<string, OpenRouterProvider>`

In `src/app/api/admin/data/route.ts`:
- Change `import { TOGETHER_PROVIDERS } from '@/lib/llm/providers/together'` to `import { OPENROUTER_PROVIDERS } from '@/lib/llm/providers/openrouter'`
- Change `const providerConfig = TOGETHER_PROVIDERS.map(...)` to `const providerConfig = OPENROUTER_PROVIDERS.map(...)`

In `src/app/api/admin/fallback-stats/route.ts`:
- Change `import { ..., TogetherProvider, OpenRouterProvider } from '@/lib/llm'` -- remove `TogetherProvider`
- Change the `instanceof` check from `!(provider instanceof TogetherProvider) && !(provider instanceof OpenRouterProvider)` to just `!(provider instanceof OpenRouterProvider)`

**Step 3: Update test files**

In `src/__tests__/setup.ts`:
- Remove `const hasTogetherKey = !!process.env.TOGETHER_API_KEY;` check (line 24)
- Update `shouldSkipRealAPI()` to only check OpenRouter: `return !process.env.OPENROUTER_API_KEY`
- Remove Together API log line, keep only OpenRouter log

In `src/__tests__/fixtures/golden/index.ts`:
- Change `GoldenFixture.provider` type from `'together' | 'openrouter'` to just `'openrouter'` (string literal)
- Change `getFixturesByProvider` to accept `'openrouter'` only
- Rename `togetherCount` to remove it from `getFixtureStats()`. Return only `openrouterCount`.

In `src/__tests__/integration/models/all-models.test.ts`:
- Remove `const hasTogetherKey = !!process.env.TOGETHER_API_KEY;`
- Change `const shouldSkip` to check `!process.env.OPENROUTER_API_KEY`
- Rename "Together AI Models" describe group to "OpenRouter Models"
- Update model count comments from "23 Together" to reflect actual OpenRouter count
- Change `hasTogetherKey` references to `hasOpenRouterKey`

In `src/__tests__/integration/models/regression.test.ts`:
- Update "Together AI Models" section label to "OpenRouter Models"
- Change `fixtureStats.togetherCount` references to `openrouterCount`
- Update expected model count from 23 to new count (should be total minus Marin 8B that was dropped)

**Step 4: Update scripts**

In `scripts/validate-model-ids.ts`:
- Change `import { TOGETHER_PROVIDERS } from '../src/lib/llm/providers/together'` to import from openrouter
- Update TOGETHER_PROVIDERS references to OPENROUTER_PROVIDERS
- Update comments and console.log messages

In `scripts/validate-all-models.ts`:
- Change `import { ALL_PROVIDERS, TOGETHER_PROVIDERS } from '../src/lib/llm'` -- remove TOGETHER_PROVIDERS
- Update console.log model counts
- Remove `hasTogetherKey` check, use `hasOpenRouterKey` instead
- Update error message about missing API keys

In `scripts/sync-models.ts`:
- Change `import { TOGETHER_PROVIDERS } from '../src/lib/llm/providers/together'` to `import { OPENROUTER_PROVIDERS } from '../src/lib/llm/providers/openrouter'`
- Update references

In `scripts/diagnose-models.ts`:
- Change `process.env.TOGETHER_API_KEY` references to `process.env.OPENROUTER_API_KEY`
- Update error messages
- Update provider references and comments

In `scripts/generate-golden-fixtures.ts`:
- Change `TOGETHER_API_KEY` references to `OPENROUTER_API_KEY`
- Update console.log messages and error checks

In `scripts/diagnostic/run-diagnostics.ts`:
- Change `hasTogetherKey` to `hasOpenRouterKey` with `OPENROUTER_API_KEY` check
- Update warning messages

**Step 5: Update package.json**

No Together-specific scripts remain (validate:synthetic already removed in quick-040). Verify no Together references in scripts section.

**Step 6: Verify build**

Run `npm run build` to confirm production build passes.
  </action>
  <verify>
    Run `npx tsc --noEmit` -- zero errors.
    Run `npm run build` -- build succeeds (use `npx next build --webpack` if turbopack fails locally).
    Run `grep -r "TOGETHER_API_KEY" src/` -- returns no results.
    Run `grep -r "TOGETHER_PROVIDERS" src/` -- returns no results.
    Run `grep -r "TogetherProvider" src/` -- returns no results.
    Run `grep -r "import.*together" src/lib/llm/` -- returns no results (no imports from together.ts).
    Run `grep -r "api.together.xyz" src/` -- returns no results.
    Confirm `src/lib/llm/providers/together.ts` does not exist.
  </verify>
  <done>
    - together.ts file deleted
    - All src/ imports updated to use OpenRouterProvider/OPENROUTER_PROVIDERS
    - No TOGETHER_API_KEY, TOGETHER_PROVIDERS, TogetherProvider, or api.together.xyz references in src/
    - All test files updated to reference OpenRouter only
    - All scripts updated to use OPENROUTER_API_KEY
    - Application builds successfully
    - Admin UI components reference OpenRouterProvider for type info
    - Marin 8B model fully removed from system (no route, no provider definition)
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npm run build` succeeds (webpack or turbopack)
3. `grep -r "TOGETHER_API_KEY" src/` returns no results
4. `grep -r "TOGETHER_PROVIDERS" src/` returns no results
5. `grep -r "TogetherProvider" src/` returns no results
6. `grep -r "api.together.xyz" src/` returns no results
7. `grep -r "import.*from.*together" src/lib/llm/` returns no results
8. MODEL_PROVIDER_ROUTES has no Together provider IDs (all entries are OpenRouter IDs ending in -or or OpenRouter-primary names)
9. OPENROUTER_PROVIDERS array contains all active models
10. `src/lib/llm/providers/together.ts` does not exist
</verification>

<success_criteria>
- Together AI provider fully removed (file deleted, class gone, no imports)
- All 22 former Together-primary models (23 minus Marin 8B) route through OpenRouter with correct promptConfigs
- Content generation uses OpenRouter API endpoint and OPENROUTER_API_KEY
- OPENROUTER_API_KEY is the sole required LLM API key in env-validation
- Each model appears exactly once in the system (no duplicate provider definitions)
- Application builds and type-checks with zero errors
- No Together references remain in application source (src/)
</success_criteria>

<output>
After completion, create `.planning/quick/041-remove-together-ai-provider-move-all-mod/041-SUMMARY.md`
</output>
