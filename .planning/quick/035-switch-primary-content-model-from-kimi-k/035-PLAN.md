---
phase: quick-035
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/together-client.ts
  - src/lib/utils/retry-config.ts
autonomous: true

must_haves:
  truths:
    - "Primary content generation uses DeepSeek V3.1 via Together API"
    - "Both primary and fallback use TOGETHER_API_KEY (no SYNTHETIC_API_KEY dependency)"
    - "JSON generation requests include response_format for structured output"
    - "Text generation requests do NOT include response_format"
    - "Fallback still uses Llama 4 Maverick via Together API"
    - "Function signatures are unchanged"
  artifacts:
    - path: "src/lib/content/together-client.ts"
      provides: "Content generation with DeepSeek V3.1 primary"
      contains: "deepseek-ai/DeepSeek-V3.1"
    - path: "src/lib/utils/retry-config.ts"
      provides: "Updated timeout/retry config for DeepSeek V3.1"
      contains: "DeepSeek V3.1"
  key_links:
    - from: "src/lib/content/together-client.ts"
      to: "https://api.together.xyz/v1/chat/completions"
      via: "API_URL constant"
      pattern: "api\\.together\\.xyz"
    - from: "src/lib/content/together-client.ts"
      to: "src/lib/utils/retry-config.ts"
      via: "TOGETHER_CONTENT_RETRY import"
      pattern: "TOGETHER_CONTENT_RETRY"
---

<objective>
Switch primary content generation model from Kimi K2 Thinking (Synthetic API) to DeepSeek V3.1 (Together API).

Purpose: DeepSeek V3.1 is cheaper ($0.60/$1.70 vs $2.00/$6.00 per M tokens), uses the same TOGETHER_API_KEY as fallback (eliminating SYNTHETIC_API_KEY dependency for content), and supports `response_format: { type: "json_object" }` for more reliable JSON output.

Output: Updated together-client.ts and retry-config.ts with DeepSeek V3.1 as primary content model.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/lib/content/together-client.ts
@src/lib/utils/retry-config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch primary model constants and API key logic in together-client.ts</name>
  <files>src/lib/content/together-client.ts</files>
  <action>
  Update the primary model configuration and API key logic in `src/lib/content/together-client.ts`:

  **1. Update file header comment:**
  Change from "Synthetic API Content Generation Client (Kimi K2 Thinking)" to "Content Generation Client (DeepSeek V3.1 via Together API)"

  **2. Update primary model constants (lines 71-76):**
  ```
  const MODEL = 'deepseek-ai/DeepSeek-V3.1';
  const API_URL = 'https://api.together.xyz/v1/chat/completions';
  const PRICING = {
    inputCostPerMillion: 0.60,
    outputCostPerMillion: 1.70,
  };
  ```

  **3. Update the `TogetherRequest` interface (lines 25-31) to support optional `response_format`:**
  Add `response_format?: { type: string }` field to the interface.

  **4. Update `callContentAPI` to accept optional `responseFormat` parameter:**
  Add `responseFormat?: { type: string }` to the params interface. When provided, include it in the request object:
  ```typescript
  const request: TogetherRequest = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: 0.9,
    ...(params.responseFormat && { response_format: params.responseFormat }),
  };
  ```

  **5. In `generateWithTogetherAI` (JSON function):**
  - Change `const primaryApiKey = process.env.SYNTHETIC_API_KEY` to `const primaryApiKey = process.env.TOGETHER_API_KEY`
  - Remove `const fallbackApiKey = process.env.TOGETHER_API_KEY` (primary and fallback now share the same key)
  - Update the error message: `'TOGETHER_API_KEY environment variable is not set'`
  - Update the guard: `if (!primaryApiKey)` throws immediately (single key for both)
  - Remove the `if (primaryApiKey)` conditional wrapper around primary — it always runs now
  - For the primary `callContentAPI` call, add `responseFormat: { type: 'json_object' }` parameter
  - Remove the `stripThinkingTags(rawContent)` call on primary response — just use `data.choices[0].message.content` directly (DeepSeek V3.1 does NOT produce thinking tags in non-thinking mode)
  - Update log message from `'Content generated (Kimi K2 Thinking)'` to `'Content generated (DeepSeek V3.1)'`
  - For the fallback section: use the same `primaryApiKey` variable (it IS `TOGETHER_API_KEY` already). Remove the separate `fallbackApiKey` check.
  - Keep all JSON parsing/cleaning logic intact (safety net)

  **6. In `generateTextWithTogetherAI` (text function):**
  - Same API key changes as above: `const apiKey = process.env.TOGETHER_API_KEY`, single guard, remove conditional wrapper
  - Do NOT add `responseFormat` to the primary or fallback `callContentAPI` call (text output, no JSON mode)
  - Remove `stripThinkingTags(rawContent)` call on primary response — use content directly
  - Update log message from `'Text content generated (Kimi K2 Thinking)'` to `'Text content generated (DeepSeek V3.1)'`
  - Same fallback key simplification as JSON function

  **7. Keep `stripThinkingTags()` function definition** — do NOT delete it. Future models may need it. Just remove the calls to it in primary response handling.

  **Important: Do NOT change function signatures.** `generateWithTogetherAI` and `generateTextWithTogetherAI` must keep their exact same parameter lists and return types.
  </action>
  <verify>
  Run `npx tsc --noEmit` to verify TypeScript compiles. Then verify:
  - `grep -c "SYNTHETIC_API_KEY" src/lib/content/together-client.ts` returns 0
  - `grep -c "DeepSeek-V3.1" src/lib/content/together-client.ts` returns at least 1
  - `grep -c "response_format" src/lib/content/together-client.ts` returns at least 1
  - `grep -c "stripThinkingTags" src/lib/content/together-client.ts` returns at least 1 (function definition kept)
  - `grep "json_object" src/lib/content/together-client.ts` shows response_format usage
  - `grep "api.together.xyz" src/lib/content/together-client.ts` shows primary API URL
  </verify>
  <done>
  Primary content generation uses DeepSeek V3.1 via Together API with `TOGETHER_API_KEY`. JSON requests include `response_format: { type: "json_object" }`. Text requests do not. No `SYNTHETIC_API_KEY` references remain. `stripThinkingTags` is not called but function is preserved. Fallback still uses Llama 4 Maverick. Function signatures unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update retry config and timeout for DeepSeek V3.1</name>
  <files>src/lib/utils/retry-config.ts</files>
  <action>
  Update `src/lib/utils/retry-config.ts` to reflect the new primary content model:

  **1. Update the content section comment block (lines 142-155):**
  Change from:
  ```
  // SYNTHETIC API - CONTENT (Kimi K2 Thinking)
  // Rate limit: Same as predictions
  // Typical latency: 10-30s for long-form content (reasoning model)
  ```
  To:
  ```
  // TOGETHER AI - CONTENT (DeepSeek V3.1)
  // Rate limit: Together AI plan limits
  // Typical latency: 5-15s for long-form content (non-reasoning model)
  // Reliability: High (99.5%)
  ```

  **2. Reduce primary content timeout from 90s to 60s:**
  `TOGETHER_CONTENT_TIMEOUT_MS = 60000` — DeepSeek V3.1 is a non-reasoning model, does not need the extra 90s that Kimi K2 Thinking required. 60s matches the fallback timeout and provides ample buffer.

  **3. Update the SERVICE_NAMES comment (line 176):**
  Change from `// Now points to Synthetic API (Kimi K2 Thinking)` to `// DeepSeek V3.1 via Together API`

  **4. Keep retry config values the same** — `TOGETHER_CONTENT_RETRY` with maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 30000 is appropriate for DeepSeek V3.1 too.

  **5. Keep fallback config unchanged** — `TOGETHER_CONTENT_FALLBACK_RETRY` and `TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS` stay as-is.
  </action>
  <verify>
  Run `npx tsc --noEmit` to verify TypeScript compiles. Then:
  - `grep "TOGETHER_CONTENT_TIMEOUT_MS" src/lib/utils/retry-config.ts` shows 60000
  - `grep "DeepSeek" src/lib/utils/retry-config.ts` shows updated comments
  - `grep "Synthetic" src/lib/utils/retry-config.ts` returns 0 hits (comments updated)
  - Run `npm run build` (or `npx next build --webpack` if turbopack unavailable locally) to verify full build succeeds
  </verify>
  <done>
  Retry config reflects DeepSeek V3.1 as primary content model. Timeout reduced from 90s to 60s for non-reasoning model. Comments updated. Build passes.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes — no type errors
2. `npm run build` (or `npx next build --webpack`) passes — full build works
3. No references to `SYNTHETIC_API_KEY` in `src/lib/content/together-client.ts`
4. `DeepSeek-V3.1` appears as MODEL in together-client.ts
5. `api.together.xyz` is the primary API_URL
6. `response_format` appears in JSON generation path only
7. `stripThinkingTags` function exists but is not called
8. Function signatures of `generateWithTogetherAI` and `generateTextWithTogetherAI` are unchanged
9. Fallback still uses `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`

Note: The LLM prediction provider (`src/lib/llm/providers/synthetic.ts`) still uses `SYNTHETIC_API_KEY` independently — that is a separate concern and should NOT be changed in this task. Only the content generation client is being switched.
</verification>

<success_criteria>
- DeepSeek V3.1 is the primary content generation model via Together API
- Both primary and fallback content generation use `TOGETHER_API_KEY`
- JSON mode (`response_format: { type: "json_object" }`) is used for JSON content generation
- Text content generation does NOT use response_format
- Timeout reduced from 90s to 60s for non-reasoning model
- All existing JSON parsing/cleaning safety nets preserved
- `stripThinkingTags()` function preserved but not called
- Build passes, types compile
</success_criteria>

<output>
After completion, create `.planning/quick/035-switch-primary-content-model-from-kimi-k/035-SUMMARY.md`
</output>
