# Phase 40: Model-Specific Prompt Selection - Research

**Researched:** 2026-02-05
**Domain:** LLM prompt engineering and response handling for reliable JSON output
**Confidence:** HIGH

## Summary

This phase implements model-specific prompt variants and timeout configurations to ensure failing AI models (GLM, Kimi, DeepSeek, Qwen thinking models) return valid JSON reliably. The approach extends the existing provider configuration with three new fields: `promptVariant`, `responseHandler`, and `timeoutMs`.

The standard approach uses TypeScript constant-based configuration (not external JSON files) to maintain type safety and enable compile-time validation. Prompt variants extend a base prompt rather than duplicating content, keeping maintenance simple. Response handlers perform post-processing to extract JSON from non-conforming outputs.

Current codebase already has robust JSON parsing with multi-strategy fallbacks (4 strategies in `parseBatchPredictionEnhanced`), timeout infrastructure via `fetchWithRetry`, and error classification via `ErrorType` enum. This phase extends these existing patterns rather than creating new infrastructure.

**Primary recommendation:** Extend `TogetherProvider` and `SyntheticProvider` classes with optional prompt/timeout configuration, create TypeScript constants file for prompt variants, implement three response handlers as pure functions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe configuration | Compile-time validation of variant names and enum values |
| OpenAI-compatible API | N/A | LLM API format | Used by Together.ai, Synthetic.new - supports `response_format: { type: "json_object" }` |
| fetchWithRetry | Internal | HTTP with retry | Already implemented in codebase with timeout support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Regex (built-in) | N/A | Thinking tag removal | Post-processing `<think>...</think>` and similar patterns |
| JSON.parse (built-in) | N/A | Response parsing | Already used in 4-strategy parser (`parseBatchPredictionEnhanced`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeScript constants | External JSON config | JSON loses type safety, increases runtime errors |
| Enum for handlers | String literals only | Enum provides autocomplete and prevents typos |
| Function-based handlers | Class-based strategy pattern | Overkill for 3 simple handlers, functions are sufficient |

**Installation:**
No new dependencies required - all built-in or already in codebase.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/llm/
├── prompt-variants.ts       # New: PROMPT_VARIANTS constant, PromptVariant enum
├── response-handlers.ts     # New: Handler functions (default, extract-json, strip-thinking)
├── prompt.ts                # Existing: Base prompts, parsing logic
├── providers/
│   ├── base.ts              # Update: Add promptVariant/responseHandler support
│   ├── together.ts          # Update: Add configuration fields to constructor
│   └── synthetic.ts         # Update: Add configuration fields to constructor
└── index.ts                 # Existing: Provider registry
```

### Pattern 1: Type-Safe Configuration Extension
**What:** Extend existing provider classes with optional configuration fields
**When to use:** Need backward compatibility while adding new features
**Example:**
```typescript
// Source: Phase 40 CONTEXT.md decisions
export enum PromptVariant {
  BASE = 'base',
  ENGLISH_ENFORCED = 'english-enforced',
  JSON_STRICT = 'json-strict',
  THINKING_STRIPPED = 'thinking-stripped',
  ENGLISH_THINKING_STRIPPED = 'english-thinking-stripped', // Combo variant
}

export enum ResponseHandler {
  DEFAULT = 'default',
  EXTRACT_JSON = 'extract-json',
  STRIP_THINKING_TAGS = 'strip-thinking-tags',
}

export interface PromptConfig {
  promptVariant?: PromptVariant;
  responseHandler?: ResponseHandler;
  timeoutMs?: number;
}

// Extend existing TogetherProvider constructor
export class TogetherProvider extends OpenAICompatibleProvider {
  public readonly promptConfig: PromptConfig;

  constructor(
    id: string,
    name: string,
    model: string,
    displayName: string,
    tier: ModelTier,
    pricing: ModelPricing,
    isPremium: boolean = false,
    promptConfig: PromptConfig = {} // New optional parameter
  ) {
    super();
    this.promptConfig = {
      promptVariant: promptConfig.promptVariant ?? PromptVariant.BASE,
      responseHandler: promptConfig.responseHandler ?? ResponseHandler.DEFAULT,
      timeoutMs: promptConfig.timeoutMs ?? 30000, // Default 30s
    };
    // ... existing fields
  }
}
```

### Pattern 2: Prompt Variant Extension (Not Duplication)
**What:** Store only the additional instructions for each variant, append to base prompt
**When to use:** Multiple prompt variants need to share common instructions
**Example:**
```typescript
// Source: Verified approach from LangChain documentation
export const PROMPT_VARIANTS = {
  [PromptVariant.BASE]: '', // No additional instructions

  [PromptVariant.ENGLISH_ENFORCED]: `

CRITICAL: Respond ONLY in English. Do not output Chinese or any other language.`,

  [PromptVariant.JSON_STRICT]: `

OUTPUT FORMAT - CRITICAL:
- Return ONLY valid JSON
- No explanations before or after the JSON
- No markdown code blocks
- No natural language
- Just the raw JSON object`,

  [PromptVariant.THINKING_STRIPPED]: `

OUTPUT FORMAT - CRITICAL:
- Do NOT use <think>, <thinking>, or <reasoning> tags
- Output ONLY the JSON prediction
- No thinking process in the response`,

  [PromptVariant.ENGLISH_THINKING_STRIPPED]: `

CRITICAL: Respond ONLY in English. Do not output Chinese or any other language.

OUTPUT FORMAT - CRITICAL:
- Do NOT use <think>, <thinking>, or <reasoning> tags
- Output ONLY the JSON prediction
- No thinking process in the response`,
} as const;

// Usage: Append variant to base system prompt
function getSystemPrompt(variant: PromptVariant): string {
  return SYSTEM_PROMPT + PROMPT_VARIANTS[variant];
}
```

### Pattern 3: Response Handler Pipeline
**What:** Pure functions that transform raw API response before JSON parsing
**When to use:** Model outputs valid content but in non-standard format
**Example:**
```typescript
// Source: Based on existing parsing patterns in prompt.ts
export type ResponseHandlerFn = (response: string) => string;

export const RESPONSE_HANDLERS: Record<ResponseHandler, ResponseHandlerFn> = {
  [ResponseHandler.DEFAULT]: (response) => response,

  [ResponseHandler.EXTRACT_JSON]: (response) => {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\n?/gi, '').replace(/```\n?/g, '');

    // Try to extract JSON object or array
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? jsonMatch[0] : cleaned;
  },

  [ResponseHandler.STRIP_THINKING_TAGS]: (response) => {
    // Remove thinking tags and their content
    let cleaned = response
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

    return cleaned.trim();
  },
};

// Apply handler in callAPI method before parsing
const rawResponse = await fetchAPI(/* ... */);
const processedResponse = RESPONSE_HANDLERS[this.promptConfig.responseHandler](rawResponse);
```

### Pattern 4: Error Type Distinction
**What:** Different error classes for timeout vs parse vs API failures
**When to use:** Fallback logic needs to handle errors differently (Phase 41)
**Example:**
```typescript
// Source: Existing retry-config.ts ErrorType enum
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Usage in callAPI
try {
  const response = await fetchWithRetry(/* ... */, timeout);
  // ... parsing
} catch (error) {
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    throw new TimeoutError(`Request timed out after ${timeout}ms`, timeout);
  }
  // ... other error handling
}
```

### Anti-Patterns to Avoid
- **Duplicating base prompt in variants:** Leads to maintenance burden when base prompt changes
- **Runtime validation of variant names:** Use TypeScript enums for compile-time safety
- **Complex class hierarchies for handlers:** Three simple functions are sufficient
- **Per-request timeout configuration:** Timeout should be per-model, not per-request

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction from text | Custom regex parser | Existing `parseBatchPredictionEnhanced` (4 strategies) | Already handles markdown blocks, flexible patterns, validated |
| Retry with timeout | Manual setTimeout + Promise.race | Existing `fetchWithRetry` with timeout parameter | Handles exponential backoff, retry logic, circuit breaking |
| Error classification | if/else chains | Existing `classifyErrorType` and `ErrorType` enum | Centralized logic, already handles 7 error types |
| Thinking tag removal | One-off regex | Dedicated response handler function | Reusable, testable, handles nested tags correctly |

**Key insight:** Codebase already has robust infrastructure for the hard parts (retry, parsing, error handling). This phase is about configuration, not reinventing primitives.

## Common Pitfalls

### Pitfall 1: Response Format Not Enforced in Prompt
**What goes wrong:** Model ignores `response_format: { type: "json_object" }` and returns natural language
**Why it happens:** Some models need explicit instruction in the prompt itself, not just API parameter
**How to avoid:** Always include "Respond with ONLY valid JSON" in prompt text, don't rely solely on API parameter
**Warning signs:** Models return explanations before/after JSON, markdown formatting, or pure natural language

### Pitfall 2: Thinking Tags Appearing Mid-JSON
**What goes wrong:** Regex removes thinking tags but breaks JSON structure (e.g., `{"score": 2<think>...`)
**Why it happens:** Reasoning models can emit tags at unexpected positions
**How to avoid:** Strip thinking tags BEFORE extracting JSON, not after. Order matters: strip tags → extract JSON → parse
**Warning signs:** JSON parsing fails with "Unexpected token <" or similar syntax errors

### Pitfall 3: Timeout Too Short for Thinking Models
**What goes wrong:** Reasoning models consistently timeout at 30s but would succeed at 60s
**Why it happens:** Thinking models generate thousands of reasoning tokens before the final answer
**How to avoid:** Set timeouts based on model type: 30s (standard) → 60s (thinking) → 90s (very slow thinkers)
**Warning signs:** Specific models have >50% timeout rate while others succeed

### Pitfall 4: Language Enforcement Positioned Wrong
**What goes wrong:** GLM models ignore "Respond in English" instruction buried in prompt
**Why it happens:** Language preference needs to be prominent (start of system prompt or end of user prompt)
**How to avoid:** Place language instruction at START of variant additions (makes it high-priority for model)
**Warning signs:** Models return Chinese characters despite English instruction present

### Pitfall 5: Combo Variants Not Created
**What goes wrong:** Model needs both English enforcement AND thinking tag removal, but only gets one
**Why it happens:** Assuming single variant per model is sufficient
**How to avoid:** Create combo variants for models with multiple issues (e.g., `ENGLISH_THINKING_STRIPPED`)
**Warning signs:** Model works after manual post-processing but not with single variant

### Pitfall 6: Hard-Coding Timeout in fetchWithRetry
**What goes wrong:** All models forced to use same timeout, causing unnecessary delays for fast models or timeouts for slow ones
**Why it happens:** Timeout set once in retry-config.ts constants
**How to avoid:** Pass timeout from provider config through to fetchWithRetry call
**Warning signs:** Fast models wait unnecessarily, slow models timeout prematurely

## Code Examples

Verified patterns from official sources:

### Extending Provider Configuration
```typescript
// Source: Existing together.ts pattern + Phase 40 decisions
// Update together.ts provider instantiation

import { PromptVariant, ResponseHandler, PromptConfig } from './prompt-variants';

export const DeepSeekR1Provider = new TogetherProvider(
  'deepseek-r1',
  'together',
  'deepseek-ai/DeepSeek-R1',
  'DeepSeek R1 (Reasoning)',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 7.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 60000, // 60s for reasoning model
  }
);

// GLM model with English enforcement
export const GLM46_SynProvider = new SyntheticProvider(
  'glm-4.6-syn',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6 (Synthetic)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000, // 60s (reported timeouts)
  }
);
```

### Using Prompt Variant in API Call
```typescript
// Source: Existing base.ts callAPI method + extension pattern
// Update OpenAICompatibleProvider.callAPI method

protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
  // Apply prompt variant
  const variant = this.promptConfig?.promptVariant ?? PromptVariant.BASE;
  const enhancedSystemPrompt = systemPrompt + PROMPT_VARIANTS[variant];

  // Use model-specific timeout
  const timeout = this.promptConfig?.timeoutMs ?? 30000;

  try {
    const response = await fetchWithRetry(
      this.endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 150,
          response_format: { type: 'json_object' },
        }),
      },
      TOGETHER_PREDICTION_RETRY,
      timeout, // Model-specific timeout
      SERVICE_NAMES.TOGETHER_PREDICTIONS
    );

    if (!response.ok) {
      // Existing error handling...
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Apply response handler
    const handler = this.promptConfig?.responseHandler ?? ResponseHandler.DEFAULT;
    const processedContent = RESPONSE_HANDLERS[handler](rawContent);

    return processedContent;

  } catch (error) {
    // Distinguish timeout errors
    if (error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('timeout'))) {
      throw new TimeoutError(
        `Request timed out after ${timeout}ms`,
        timeout
      );
    }
    throw error;
  }
}
```

### Response Handler Implementation
```typescript
// Source: Existing parsePredictionResponse patterns + web search findings
// New file: response-handlers.ts

export enum ResponseHandler {
  DEFAULT = 'default',
  EXTRACT_JSON = 'extract-json',
  STRIP_THINKING_TAGS = 'strip-thinking-tags',
}

export type ResponseHandlerFn = (response: string) => string;

/**
 * Response handlers for model-specific post-processing
 * Applied before JSON parsing to normalize output format
 */
export const RESPONSE_HANDLERS: Record<ResponseHandler, ResponseHandlerFn> = {
  /**
   * Default: No processing, pass through as-is
   */
  [ResponseHandler.DEFAULT]: (response: string) => response,

  /**
   * Extract JSON: Remove markdown blocks, explanatory text
   * Use for models that return "Here's the prediction: ```json{...}```"
   */
  [ResponseHandler.EXTRACT_JSON]: (response: string) => {
    // Remove markdown code blocks
    let cleaned = response
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract first JSON object or array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    // Prefer object over array (single prediction format)
    if (objectMatch) return objectMatch[0];
    if (arrayMatch) return arrayMatch[0];

    // No JSON found, return cleaned response (will fail parsing downstream)
    return cleaned;
  },

  /**
   * Strip Thinking Tags: Remove <think>, <thinking>, <reasoning> tags
   * Use for reasoning models (DeepSeek R1, Qwen3 Thinking)
   *
   * Note: Must strip tags BEFORE JSON extraction to avoid breaking structure
   */
  [ResponseHandler.STRIP_THINKING_TAGS]: (response: string) => {
    return response
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .trim();
  },
};
```

### Error Type Distinction
```typescript
// Source: Existing retry-config.ts ErrorType + Phase 40 requirements
// Add to utils/api-client.ts or create new errors.ts

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly modelId?: string
  ) {
    super(message);
    this.name = 'TimeoutError';
    Error.captureStackTrace?.(this, TimeoutError);
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly modelId?: string
  ) {
    super(message);
    this.name = 'ParseError';
    Error.captureStackTrace?.(this, ParseError);
  }
}

// ApiError already exists in utils/api-client.ts - extend if needed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global timeout for all models | Per-model timeout configuration | 2025-2026 (reasoning models emerged) | Reasoning models need 2-3x longer, standard models shouldn't wait |
| Generic prompts for all models | Model-specific prompt variants | 2025-2026 (JSON mode adoption) | Models have different instruction-following behaviors |
| Single error type | Distinct TimeoutError, ParseError, ApiError | 2026 (fallback chains) | Enables intelligent retry strategies in Phase 41 |
| Thinking tags in output | Strip thinking tags pre-parsing | Jan 2026 (DeepSeek R1 release) | Prevents JSON structure corruption |
| Language assumed English | Explicit language enforcement | 2025 (multilingual models common) | GLM and other Chinese models need explicit instruction |

**Deprecated/outdated:**
- **Relying solely on `response_format: json_object`**: Many models need explicit prompt instructions too
- **Single 30s timeout for all models**: Reasoning models regularly need 60s+
- **Ignoring thinking tags**: Modern parsers must handle them or strip them

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal timeout for Kimi K2.5**
   - What we know: Currently times out at 30s (synthetic.ts comments)
   - What's unclear: Whether 60s is sufficient or 90s needed
   - Recommendation: Start with 60s, monitor failure rate, adjust to 90s if >10% still timeout

2. **Whether DeepSeek V3.2 needs combo variant**
   - What we know: Currently fails JSON parsing (returns natural language - synthetic.ts line 263)
   - What's unclear: If it ALSO needs thinking tag removal (name doesn't indicate reasoning model)
   - Recommendation: Start with JSON_STRICT variant only, add STRIP_THINKING_TAGS if needed after testing

3. **Minimal system prompt for DeepSeek R1**
   - What we know: PRMT-04 requirement states "minimal system prompt (empty or single line)"
   - What's unclear: Whether "minimal" means empty string or shortened version of SYSTEM_PROMPT
   - Recommendation: Test both (empty vs 1-sentence instruction), verify which gives better JSON adherence

4. **English enforcement effectiveness**
   - What we know: Web search confirms "Always respond in English" at prompt start works
   - What's unclear: Whether all GLM models need this or just specific versions
   - Recommendation: Apply to all GLM models (defensive), can narrow later if data shows some don't need it

## Sources

### Primary (HIGH confidence)
- OpenAI API Structured Outputs Documentation: https://platform.openai.com/docs/guides/structured-outputs
- Together.ai DeepSeek R1 Prompting Guide: https://docs.together.ai/docs/prompting-deepseek-r1
- Cerebras GLM-4.7 Migration Guide (English enforcement): https://www.cerebras.ai/blog/glm-4-7-migration-guide
- Existing codebase: `src/lib/llm/prompt.ts` (4-strategy parser), `src/lib/utils/retry-config.ts` (error types)

### Secondary (MEDIUM confidence)
- DeepSeek Prompting Techniques: https://www.datastudios.org/post/deepseek-prompting-techniques-reasoning-models-structured-outputs-and-efficient-control
- Helicone: How to Prompt Thinking Models: https://www.helicone.ai/blog/prompt-thinking-models
- BytePlus API Timeout Guide: https://www.byteplus.com/en/topic/405537
- Thinking tag removal discussion (GitHub): https://github.com/Aider-AI/aider/issues/3008

### Tertiary (LOW confidence)
- N/A - all key findings verified with authoritative sources or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All based on existing codebase patterns (TypeScript, fetchWithRetry, OpenAI API)
- Architecture: HIGH - Extending proven patterns already in use (provider classes, enum-based config)
- Pitfalls: MEDIUM-HIGH - Derived from web search and logical analysis, not battle-tested in this exact codebase
- Response handlers: HIGH - Based on existing parsing code patterns in prompt.ts
- Prompt variants: MEDIUM-HIGH - Text content based on web search best practices, not official model documentation

**Research date:** 2026-02-05
**Valid until:** ~30 days (2026-03-05) - Prompt engineering techniques stable, but model APIs evolve rapidly
