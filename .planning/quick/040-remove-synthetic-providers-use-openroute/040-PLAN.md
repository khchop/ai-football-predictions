---
phase: quick-040
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/synthetic.ts
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
  - src/lib/llm/providers/base.ts
  - src/lib/content/config.ts
  - src/components/admin/model-health-cards.tsx
  - src/__tests__/setup.ts
  - src/__tests__/fixtures/golden/index.ts
  - src/__tests__/integration/models/all-models.test.ts
  - src/__tests__/integration/models/regression.test.ts
  - scripts/diagnose-models.ts
  - scripts/validate-model-ids.ts
  - scripts/diagnostic/categorize-failure.ts
  - scripts/diagnostic/validate-coverage.ts
  - scripts/diagnostic/generate-coverage-report.ts
  - scripts/diagnostic/run-diagnostics.ts
autonomous: true

must_haves:
  truths:
    - "All 10 former Synthetic-exclusive models route through OpenRouter as primary provider"
    - "kimi-k2.5 route no longer includes kimi-k2.5-syn"
    - "No reference to SyntheticProvider class or SYNTHETIC_PROVIDERS array in index.ts"
    - "OpenRouter model configs have all promptConfig fields that Synthetic models had (supportsJsonMode, maxTokens, responseHandler)"
    - "Application builds successfully with npm run build"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "Updated OpenRouter models with full Synthetic configs migrated"
    - path: "src/lib/llm/index.ts"
      provides: "Clean provider registry with only Together + OpenRouter"
  key_links:
    - from: "src/lib/llm/index.ts"
      to: "src/lib/llm/providers/openrouter.ts"
      via: "MODEL_PROVIDER_ROUTES and ALL_PROVIDERS"
      pattern: "OPENROUTER_PROVIDERS"
---

<objective>
Remove the Synthetic.new provider entirely. Migrate all 11 Synthetic models to use their existing OpenRouter equivalents as primary. Sync promptConfig (supportsJsonMode, maxTokens, responseHandler) from Synthetic models to their OpenRouter counterparts to ensure identical behavior.

Purpose: Simplify provider architecture from 3 providers to 2 (Together AI + OpenRouter). Synthetic.new is being deprecated.
Output: Clean 2-provider system where all former Synthetic models route through OpenRouter with correct configs.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/providers/synthetic.ts (DELETE this file)
@src/lib/llm/providers/openrouter.ts (update configs)
@src/lib/llm/index.ts (remove Synthetic, update routes)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sync Synthetic promptConfigs to OpenRouter models and update routes</name>
  <files>
    src/lib/llm/providers/openrouter.ts
    src/lib/llm/index.ts
    src/lib/llm/providers/base.ts
    src/lib/content/config.ts
    src/components/admin/model-health-cards.tsx
  </files>
  <action>
**Step 1: Update OpenRouter model configs in `src/lib/llm/providers/openrouter.ts`**

The following OpenRouter models are missing configs that their Synthetic counterparts had. Add the missing fields to each model's promptConfig:

1. `Qwen3_235BThinking_OR` (line ~484) — ADD: `supportsJsonMode: false, maxTokensSingle: 2000, maxTokensBatch: 3000`
2. `DeepSeekV32_OR` (line ~395) — ADD: `supportsJsonMode: false, maxTokensSingle: 1000, maxTokensBatch: 1500`
3. `MiniMaxM2_OR` (line ~411) — REPLACE empty `{}` with: `{ supportsJsonMode: false }`
4. `MiniMaxM21_OR` (line ~423) — REPLACE empty `{}` with: `{ supportsJsonMode: false, responseHandler: ResponseHandler.EXTRACT_JSON }`
5. `GLM46_OR` (line ~435) — CHANGE `responseHandler: ResponseHandler.DEFAULT` to `responseHandler: ResponseHandler.STRIP_THINKING_TAGS` and ADD: `supportsJsonMode: false, maxTokensSingle: 1000, maxTokensBatch: 1500`
6. `GLM47_OR` (line ~451) — ADD: `supportsJsonMode: false, maxTokensSingle: 1000, maxTokensBatch: 1500`
7. `GPTOSS120B_OR` (line ~524) — ADD: `supportsJsonMode: false, maxTokensSingle: 1000, maxTokensBatch: 1500`

Models that need NO changes (configs already match or Synthetic had no special config):
- `DeepSeekV3_0324_OR` — OK (both use defaults)
- `DeepSeekV31Terminus_OR` — OK (both use defaults)
- `Qwen3Coder480B_OR` — OK (Synthetic had no special config beyond tier/pricing)

Update the section comment from "SYNTHETIC MODELS -> OPENROUTER FALLBACKS" to "FORMER SYNTHETIC MODELS (now OpenRouter primary)" in both batch sections.

**Step 2: Update `src/lib/llm/index.ts`**

a) Remove import: `import { SYNTHETIC_PROVIDERS } from './providers/synthetic';`

b) Update `ALL_PROVIDERS` to only include Together:
```typescript
export const ALL_PROVIDERS: LLMProvider[] = [
  ...TOGETHER_PROVIDERS,
];
```
Update the comment above to remove Synthetic references. Change "Together AI + Synthetic.new" to "Together AI core providers". Update count: "Together: 23 active models = 23 total"

c) Update `MODEL_PROVIDER_ROUTES` — the "Synthetic -> OpenRouter" section:
- Change ALL 10 Synthetic-primary routes to OpenRouter-only (single entry):
  ```
  'deepseek-v3.2': ['deepseek-v3.2-or'],
  'minimax-m2': ['minimax-m2-or'],
  'minimax-m2.1': ['minimax-m2.1-or'],
  'glm-4.6': ['glm-4.6-or'],
  'glm-4.7': ['glm-4.7-or'],
  'qwen3-coder-480b': ['qwen3-coder-480b-or'],
  'qwen3-235b-thinking': ['qwen3-235b-thinking-or'],
  'deepseek-v3-0324': ['deepseek-v3-0324-or'],
  'deepseek-v3.1-terminus': ['deepseek-v3.1-terminus-or'],
  'gpt-oss-120b': ['gpt-oss-120b-or'],
  ```
- Rename section comment to `// --- OpenRouter-primary (migrated from Synthetic) ---`
- Update `kimi-k2.5` route: change `['kimi-k2.5', 'kimi-k2.5-syn', 'kimi-k2.5-or']` to `['kimi-k2.5', 'kimi-k2.5-or']`

d) Remove the Synthetic block from `getActiveProviders()` (lines 198-203 — the entire `if (process.env.SYNTHETIC_API_KEY)` block).

e) Update `getProviderById()` comment: change "Together + Synthetic" to "Together"

f) Update `getProviderStats()`:
- Remove `...SYNTHETIC_PROVIDERS` from `allProviders`
- Remove `synthetic: SYNTHETIC_PROVIDERS.length` from return
- Remove `synthetic: number` from return type
- The return type and object should only have: total, free, ultraBudget, budget, premium, together, openrouter

g) Remove these export lines:
- `export { SYNTHETIC_PROVIDERS };`
- `export { SyntheticProvider } from './providers/synthetic';`

h) Update the comment on line 474 in base.ts: change "e.g., GLM on SGLang, Synthetic models" to "e.g., GLM on SGLang, models with non-standard JSON support"

**Step 3: Update `src/lib/content/config.ts`**

Update the stale Synthetic references (these are metadata only, not used for API calls):
- Change `provider: 'synthetic'` to `provider: 'together'` (content gen uses Together API via together-client.ts)
- Change `model: 'hf:moonshotai/Kimi-K2-Thinking'` to the Together model ID format used by together-client.ts
- Change `apiUrl: 'https://api.synthetic.new/...'` to `apiUrl: 'https://api.together.xyz/v1/chat/completions'`
- Update the top comment to say "Together API" instead of "Synthetic API"

**Step 4: Update `src/components/admin/model-health-cards.tsx`**

Remove the `synthetic` entry from the `colors` record in `ProviderBadge` (line ~103). Only keep `together` (and add `openrouter` if not present).
  </action>
  <verify>
Run `npx tsc --noEmit` to verify no TypeScript errors from removed Synthetic types/imports.
Verify no import of `./providers/synthetic` remains in index.ts.
  </verify>
  <done>
OpenRouter models have full promptConfigs migrated from Synthetic. index.ts has no Synthetic references. MODEL_PROVIDER_ROUTES point former Synthetic models to OpenRouter-only. ALL_PROVIDERS contains only Together. getProviderStats has no synthetic field.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete Synthetic provider file and clean up scripts/tests</name>
  <files>
    src/lib/llm/providers/synthetic.ts
    src/__tests__/setup.ts
    src/__tests__/fixtures/golden/index.ts
    src/__tests__/integration/models/all-models.test.ts
    src/__tests__/integration/models/regression.test.ts
    scripts/diagnose-models.ts
    scripts/validate-model-ids.ts
    scripts/diagnostic/categorize-failure.ts
    scripts/diagnostic/validate-coverage.ts
    scripts/diagnostic/generate-coverage-report.ts
    scripts/diagnostic/run-diagnostics.ts
  </files>
  <action>
**Step 1: Delete `src/lib/llm/providers/synthetic.ts`**

Remove the file entirely using `rm`.

**Step 2: Update `src/__tests__/setup.ts`**

- Remove `hasSyntheticKey` variable and its usage
- Change `shouldSkipRealAPI` to check `hasTogetherKey` only (or add `hasOpenRouterKey` check)
- Remove the `Synthetic API:` console.log line
- Add `OpenRouter API:` console.log if not present

**Step 3: Update `src/__tests__/fixtures/golden/index.ts`**

- Change `provider: 'together' | 'synthetic'` type to `provider: 'together' | 'openrouter'`
- Change `getFixturesByProvider` parameter type from `'together' | 'synthetic'` to `'together' | 'openrouter'`
- Rename `syntheticCount` to `openrouterCount` in `getFixtureStats` return type and implementation
- Update the internal call from `getFixturesByProvider('synthetic')` to `getFixturesByProvider('openrouter')`

**Step 4: Update `src/__tests__/integration/models/all-models.test.ts`**

- Remove `hasSyntheticKey` variable
- Remove or update the "Synthetic Models" describe block — these models are now OpenRouter, so remove the Synthetic-specific test group
- Update the provider count assertion: `ALL_PROVIDERS` will now be 23 (Together only), not 42. The test at line 143 `expect(ALL_PROVIDERS.length).toBe(42)` must change to `expect(ALL_PROVIDERS.length).toBe(23)`. Remove the synthetic count assertions.
- Update `shouldSkip` to use `hasTogetherKey` and optionally `hasOpenRouterKey`

**Step 5: Update `src/__tests__/integration/models/regression.test.ts`**

- Change `syntheticCount` references to `openrouterCount`
- Update the "Synthetic model count is 13" test — remove it or change to test OpenRouter count
- Rename "Synthetic Models - Structural Validation" section to "OpenRouter Models - Structural Validation" (or remove if fixtures don't exist for these)
- Update `getFixturesByProvider('synthetic')` calls to `getFixturesByProvider('openrouter')`

**Step 6: Update `scripts/diagnose-models.ts`**

- Remove the entire `testSyntheticModel` function (lines ~188-318)
- Remove `'synthetic'` from the `ModelDef.provider` union type — change to `'together' | 'openrouter'`
- Move the 11 Synthetic model entries (lines ~504-514) to use `provider: 'openrouter'` with their OpenRouter model IDs and `-or` suffixed IDs
- Remove `SYNTHETIC_API_KEY` references from the keys check and console output
- Remove the `case 'synthetic':` branch in the test loop
- Update the import to not reference synthetic

**Step 7: Update `scripts/validate-model-ids.ts`**

- Remove import of `SYNTHETIC_PROVIDERS` from `../src/lib/llm/providers/synthetic`
- Remove `SYNTHETIC_PROVIDERS.map(...)` from `allProviders` array
- Remove `Synthetic:` console.log line

**Step 8: Update diagnostic scripts**

In `scripts/diagnostic/categorize-failure.ts`:
- Change `provider: 'together' | 'synthetic'` to `provider: 'together' | 'openrouter'`

In `scripts/diagnostic/validate-coverage.ts`:
- Change `provider: 'together' | 'synthetic'` to `provider: 'together' | 'openrouter'`
- Update `isSynthetic` logic to `isOpenRouter` (check `provider.name === 'openrouter'`)
- Rename `syntheticCount` to `openrouterCount`
- Update console output strings

In `scripts/diagnostic/generate-coverage-report.ts`:
- Change `provider: 'together' | 'synthetic'` to `provider: 'together' | 'openrouter'`
- Update `isSynthetic` checks to `isOpenRouter`
- Update string references from "Synthetic" to "OpenRouter"

In `scripts/diagnostic/run-diagnostics.ts`:
- Change provider detection from `endsWith('-syn')` to check for OpenRouter
- Remove `SYNTHETIC_API_KEY` references
- Update console output

**Step 9: Remove `validate:synthetic` npm script**

In `package.json`, remove the line: `"validate:synthetic": "npx tsx scripts/validate-synthetic-models.ts",`
Also delete `scripts/validate-synthetic-models.ts` if it exists.
  </action>
  <verify>
Run `npm run build` (or `npx next build --webpack` if turbopack fails locally) to verify the full application builds.
Run `npx tsc --noEmit` to verify no type errors.
Grep for "synthetic" in src/ to verify no remaining references (excluding test fixture JSON data files which are static snapshots).
  </verify>
  <done>
synthetic.ts deleted. All scripts and tests updated to reference 'openrouter' instead of 'synthetic'. Provider type unions are 'together' | 'openrouter'. Application builds successfully. No functional references to Synthetic remain in source code.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npm run build` (or `npx next build --webpack`) succeeds
3. `grep -r "SYNTHETIC_API_KEY" src/` returns no results
4. `grep -r "import.*synthetic" src/` returns no results
5. `grep -r "SYNTHETIC_PROVIDERS" src/` returns no results
6. MODEL_PROVIDER_ROUTES has no Synthetic provider IDs (no entries without `-or` suffix in the former Synthetic section)
7. All 10 former Synthetic models have OpenRouter-only routes
8. kimi-k2.5 route is `['kimi-k2.5', 'kimi-k2.5-or']` (no kimi-k2.5-syn)
</verification>

<success_criteria>
- Synthetic provider fully removed (file deleted, class unexported, no imports)
- 10 former Synthetic-exclusive models route through OpenRouter with correct promptConfigs (supportsJsonMode, maxTokens, responseHandler all preserved)
- kimi-k2.5-syn removed from kimi-k2.5 route
- ALL_PROVIDERS contains only Together (23 models)
- getProviderStats returns 2 providers (together + openrouter), not 3
- Application builds and type-checks successfully
- No SYNTHETIC_API_KEY references in application source
</success_criteria>

<output>
After completion, create `.planning/quick/040-remove-synthetic-providers-use-openroute/040-SUMMARY.md`
</output>
