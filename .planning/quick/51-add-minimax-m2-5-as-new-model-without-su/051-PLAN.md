---
phase: quick-051
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/openrouter.ts
  - src/lib/llm/index.ts
  - src/__tests__/fixtures/test-data.ts
  - src/__tests__/integration/models/all-models.test.ts
  - scripts/validate-all-models.ts
autonomous: true
must_haves:
  truths:
    - "MiniMax M2.5 provider exists with correct OpenRouter model ID and pricing"
    - "MiniMax M2.5 is included in OPENROUTER_PROVIDERS array (21 total models)"
    - "MiniMax M2.5 has a provider route in MODEL_PROVIDER_ROUTES"
    - "MiniMax M2.5 is classified as a reasoning model in test fixtures"
    - "Model count assertions reflect 21 models"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "MiniMaxM25_OR provider constant + inclusion in OPENROUTER_PROVIDERS"
      contains: "MiniMaxM25_OR"
    - path: "src/lib/llm/index.ts"
      provides: "Provider route for minimax-m2.5"
      contains: "minimax-m2.5"
  key_links:
    - from: "src/lib/llm/providers/openrouter.ts"
      to: "src/lib/llm/index.ts"
      via: "OPENROUTER_PROVIDERS array export"
      pattern: "MiniMaxM25_OR"
---

<objective>
Add MiniMax M2.5 as the 21st active model on OpenRouter. This is a thinking/reasoning model with mandatory `<think>` tags, priced at $0.30/$1.20 per 1M tokens (budget tier). No model substitution -- this is a net new addition.

Purpose: Expand model coverage with MiniMax's latest reasoning model.
Output: MiniMax M2.5 fully integrated into provider system, routes, and test fixtures.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/llm/providers/openrouter.ts
@src/lib/llm/index.ts
@src/__tests__/fixtures/test-data.ts
@src/__tests__/integration/models/all-models.test.ts
@scripts/validate-all-models.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add MiniMax M2.5 provider and route</name>
  <files>
    src/lib/llm/providers/openrouter.ts
    src/lib/llm/index.ts
  </files>
  <action>
In `src/lib/llm/providers/openrouter.ts`:

1. After the `MiniMaxM21_OR` constant (line ~141), add the new M2.5 provider:

```typescript
// MiniMax M2.5 (reasoning model with mandatory <think> tags)
export const MiniMaxM25_OR = new OpenRouterProvider(
  'minimax-m2.5-or',
  'openrouter',
  'minimax/minimax-m2.5',
  'MiniMax M2.5 (OpenRouter)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 1.20 },
  false,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
    supportsJsonMode: false,
  }
);
```

Key config rationale:
- `THINKING_STRIPPED` + `STRIP_THINKING_TAGS`: Same pattern as Qwen3 235B Thinking and DeepSeek R1-0528 for mandatory thinking tag models.
- `timeoutMs: 120000`: Standard 2-min timeout for reasoning models.
- `supportsJsonMode: false`: Matches M2.1 behavior (safer; JSON extracted after thinking tags stripped).
- NOT using `EXTRACT_JSON` like M2.1 because `STRIP_THINKING_TAGS` already handles extraction from thinking model output.

2. Update the section comment from `// ALL OPENROUTER PROVIDERS (20 models)` to `// ALL OPENROUTER PROVIDERS (21 models)`.

3. In the `OPENROUTER_PROVIDERS` array, update the MiniMax section from:
```
  // MiniMax (1 model)
  MiniMaxM21_OR,               // MiniMax M2.1 (UPDATED pricing)
```
to:
```
  // MiniMax (2 models)
  MiniMaxM21_OR,               // MiniMax M2.1 (UPDATED pricing)
  MiniMaxM25_OR,               // MiniMax M2.5 (NEW - reasoning model)
```

In `src/lib/llm/index.ts`:

1. Update comment on line 10 from `// OpenRouter: 20 active models = 20 total` to `// OpenRouter: 21 active models = 21 total`.

2. In `MODEL_PROVIDER_ROUTES`, update the MiniMax section from:
```
  // MiniMax (1)
  'minimax-m2.1': ['minimax-m2.1-or'],
```
to:
```
  // MiniMax (2)
  'minimax-m2.1': ['minimax-m2.1-or'],
  'minimax-m2.5': ['minimax-m2.5-or'],
```
  </action>
  <verify>
Run `npx tsc --noEmit` to confirm no TypeScript errors. Grep for `MiniMaxM25_OR` in openrouter.ts to confirm it exists. Grep for `minimax-m2.5` in index.ts to confirm route exists.
  </verify>
  <done>
MiniMaxM25_OR provider constant exists with model ID `minimax/minimax-m2.5`, budget tier, $0.30/$1.20 pricing, THINKING_STRIPPED + STRIP_THINKING_TAGS config. Provider is in OPENROUTER_PROVIDERS array (21 total). Route `minimax-m2.5` -> `['minimax-m2.5-or']` exists in MODEL_PROVIDER_ROUTES. All comments updated to reflect 21 models. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update test fixtures and model count assertions</name>
  <files>
    src/__tests__/fixtures/test-data.ts
    src/__tests__/integration/models/all-models.test.ts
    scripts/validate-all-models.ts
  </files>
  <action>
In `src/__tests__/fixtures/test-data.ts`:

Add `'minimax-m2.5-or'` to the `REASONING_MODEL_IDS` set (it's a thinking model with mandatory `<think>` tags):
```typescript
export const REASONING_MODEL_IDS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
  'deepseek-r1',
  'minimax-m2.5-or',
]);
```

In `scripts/validate-all-models.ts`:

Add `'minimax-m2.5-or'` to the local `REASONING_MODEL_IDS` set (line ~38):
```typescript
const REASONING_MODEL_IDS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
  'deepseek-r1',
  'minimax-m2.5-or',
]);
```

In `src/__tests__/integration/models/all-models.test.ts`:

Update the expected model count on line 75. The current assertion is `expect(ALL_PROVIDERS.length).toBe(23)` but OPENROUTER_PROVIDERS currently has 20 items (ALL_PROVIDERS = [...OPENROUTER_PROVIDERS]). With M2.5 added, OPENROUTER_PROVIDERS will have 21 items. Update the assertion to `expect(ALL_PROVIDERS.length).toBe(21)`.

Note: The existing `23` may be stale from when synthetic providers were included. The correct count after this change is 21.
  </action>
  <verify>
Run `npx vitest run src/__tests__/integration/models/all-models.test.ts --reporter=verbose 2>&1 | head -30` to verify the model count test passes (it will skip the API tests without key, but the count test should run). Grep `minimax-m2.5-or` in test-data.ts and validate-all-models.ts to confirm presence.
  </verify>
  <done>
`minimax-m2.5-or` is in REASONING_MODEL_IDS in both `test-data.ts` and `validate-all-models.ts`. Model count assertion in `all-models.test.ts` is updated to 21 and passes.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npx vitest run src/__tests__/integration/models/all-models.test.ts` -- count test passes (API tests skipped without key)
3. Grep confirms 21 entries in OPENROUTER_PROVIDERS array
4. Grep confirms `minimax-m2.5` route in MODEL_PROVIDER_ROUTES
5. Grep confirms `minimax-m2.5-or` in both REASONING_MODEL_IDS sets
</verification>

<success_criteria>
- MiniMax M2.5 is the 21st model in OPENROUTER_PROVIDERS with correct config (THINKING_STRIPPED, STRIP_THINKING_TAGS, 120s timeout, budget tier, $0.30/$1.20)
- Provider route exists mapping `minimax-m2.5` to `['minimax-m2.5-or']`
- All model count comments and test assertions updated from 20 to 21
- Reasoning model test sets include `minimax-m2.5-or`
- TypeScript compiles with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/51-add-minimax-m2-5-as-new-model-without-su/051-SUMMARY.md`
</output>
