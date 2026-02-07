---
phase: quick-034
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
    - "Content generation recovers automatically when Kimi K2 Thinking fails after retries"
    - "Fallback uses Llama 4 Maverick via Together API with TOGETHER_API_KEY"
    - "Logs clearly indicate whether primary (Kimi K2) or fallback (Llama 4 Maverick) model was used"
    - "Both generateWithTogetherAI and generateTextWithTogetherAI have fallback support"
  artifacts:
    - path: "src/lib/content/together-client.ts"
      provides: "Fallback logic for both generation functions"
      contains: "FALLBACK_MODEL"
    - path: "src/lib/utils/retry-config.ts"
      provides: "Fallback-specific retry and timeout config"
      contains: "TOGETHER_CONTENT_FALLBACK"
  key_links:
    - from: "src/lib/content/together-client.ts"
      to: "src/lib/utils/retry-config.ts"
      via: "import fallback retry config"
      pattern: "TOGETHER_CONTENT_FALLBACK"
---

<objective>
Add automatic fallback from Kimi K2 Thinking (Synthetic API) to Llama 4 Maverick (Together API) when content generation fails after all retries.

Purpose: Prevent content generation jobs from hitting DLQ when Kimi K2 is temporarily unavailable. Llama 4 Maverick is a reliable, fast fallback that produces acceptable quality content.
Output: Modified together-client.ts with fallback logic in both generation functions.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/content/together-client.ts
@src/lib/utils/retry-config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fallback retry config and implement model fallback in both generation functions</name>
  <files>src/lib/utils/retry-config.ts, src/lib/content/together-client.ts</files>
  <action>
**Step 1: Add fallback config to retry-config.ts**

Add a new section after the existing `TOGETHER_CONTENT_*` config block (after line 154):

```typescript
// ============================================================================
// TOGETHER AI - CONTENT FALLBACK (Llama 4 Maverick)
// Used when primary Kimi K2 Thinking fails after all retries
// Typical latency: 5-15s (faster than reasoning model)
// ============================================================================
export const TOGETHER_CONTENT_FALLBACK_RETRY: Partial<RetryConfig> = {
  maxRetries: 2,            // Fewer retries - this IS the fallback
  baseDelayMs: 1500,
  maxDelayMs: 15000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS = 60000; // 60s - Llama 4 is faster
```

Also add `TOGETHER_CONTENT_FALLBACK: 'together-content-fallback'` to the `SERVICE_NAMES` object.

**Step 2: Add fallback model config to together-client.ts**

After the existing `PRICING` const (line 68), add:

```typescript
// Fallback model config (when primary Kimi K2 Thinking fails)
const FALLBACK_MODEL = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
const FALLBACK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const FALLBACK_PRICING = {
  inputCostPerMillion: 0.27,
  outputCostPerMillion: 0.85,
};
```

Update the imports to include the new fallback config constants:
```typescript
import {
  TOGETHER_CONTENT_RETRY, TOGETHER_CONTENT_TIMEOUT_MS,
  TOGETHER_CONTENT_FALLBACK_RETRY, TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS,
  SERVICE_NAMES
} from '@/lib/utils/retry-config';
```

**Step 3: Extract shared API call logic into a private helper**

Create a private helper function `callContentAPI` that encapsulates the fetch-with-retry pattern. This avoids duplicating the fetch logic for primary vs fallback:

```typescript
async function callContentAPI(params: {
  apiUrl: string;
  apiKey: string;
  model: string;
  messages: TogetherMessage[];
  temperature: number;
  maxTokens: number;
  retryConfig: Partial<RetryConfig>;
  timeoutMs: number;
  serviceName: string;
}): Promise<TogetherResponse> {
  const request: TogetherRequest = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: 0.9,
  };

  const response = await fetchWithRetry(
    params.apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(request),
    },
    params.retryConfig,
    params.timeoutMs,
    params.serviceName
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as TogetherResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from API');
  }

  return data;
}
```

**Step 4: Refactor `generateWithTogetherAI` to use primary-then-fallback**

Wrap the existing primary call in a try-catch. On any error, log a warning and attempt with fallback model. Key differences for fallback:
- Use `FALLBACK_MODEL`, `FALLBACK_API_URL`, `FALLBACK_PRICING`
- Use `process.env.TOGETHER_API_KEY` (not SYNTHETIC_API_KEY)
- Use `TOGETHER_CONTENT_FALLBACK_RETRY` and `TOGETHER_CONTENT_FALLBACK_TIMEOUT_MS`
- Do NOT call `stripThinkingTags()` on fallback response (Llama 4 Maverick does not produce thinking tags)
- Log message should say `'Content generated (Llama 4 Maverick FALLBACK)'`
- Cost calculation uses `FALLBACK_PRICING`

Important: If the fallback API key (`TOGETHER_API_KEY`) is not set, re-throw the original primary error instead of attempting fallback. Log: `'TOGETHER_API_KEY not set, cannot attempt fallback'`.

If fallback also fails, throw the fallback error (which is the most recent), but log BOTH the primary and fallback errors for debugging.

**Step 5: Refactor `generateTextWithTogetherAI` with the same fallback pattern**

Apply the exact same primary-then-fallback pattern. Same differences as Step 4: different model, API URL, API key, no `stripThinkingTags()`, fallback pricing, fallback log message.

**Step 6: Update `calculateCost` to accept pricing param**

Change signature to:
```typescript
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputCostPerMillion: number; outputCostPerMillion: number } = PRICING
): number
```

This allows both primary and fallback calls to calculate cost with their respective pricing.

**Important constraints:**
- The function signatures of `generateWithTogetherAI` and `generateTextWithTogetherAI` must NOT change (same params, same return types). Callers are unaffected.
- The env var check at the top of each function should check `SYNTHETIC_API_KEY` first (primary). If missing, immediately try fallback with `TOGETHER_API_KEY`. If BOTH are missing, throw error.
- Keep `cleanJSONString` and `stripThinkingTags` functions unchanged.
  </action>
  <verify>
1. `npx tsc --noEmit` passes with no type errors
2. `npm run build` completes successfully (or `npx next build --webpack` if turbopack SWC issue)
3. Grep the file to confirm: `FALLBACK_MODEL` is defined, both functions have try-catch with fallback, log messages distinguish primary vs fallback
  </verify>
  <done>
- Both `generateWithTogetherAI` and `generateTextWithTogetherAI` attempt Kimi K2 Thinking first, then fall back to Llama 4 Maverick on failure
- Fallback uses Together API endpoint with TOGETHER_API_KEY
- Fallback does not strip thinking tags
- Fallback uses its own retry config (2 retries, 60s timeout)
- Log messages clearly distinguish primary model success, fallback attempt, and fallback success/failure
- No changes to function signatures or return types
- TypeScript compiles clean, build passes
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit` - zero errors
2. Build verification: `npm run build` or `npx next build --webpack`
3. Code review: Both generation functions have primary-then-fallback pattern
4. Log messages: grep for 'FALLBACK' in together-client.ts confirms distinguishable log lines
</verification>

<success_criteria>
- Content generation automatically falls back to Llama 4 Maverick when Kimi K2 Thinking fails
- Fallback is transparent to callers (no API changes)
- Logs clearly show which model produced content
- Build passes, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/034-content-fallback-model-kimi-errors/034-SUMMARY.md`
</output>
