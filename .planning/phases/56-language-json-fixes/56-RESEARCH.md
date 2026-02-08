# Phase 56: Category Fixes - Language & JSON - Research

**Researched:** 2026-02-08
**Domain:** Language enforcement prompts, JSON extraction from wrapped LLM responses
**Confidence:** HIGH

## Summary

Phase 56 addresses the third and fourth failure categories from Phase 54's diagnostic infrastructure: language mixing (models defaulting to Chinese/non-English) and JSON extraction failures (models wrapping JSON in markdown blocks or adding explanatory text).

Research confirms that GLM models (GLM-4.6, GLM-4.7) are bilingual Chinese-English models that default to Chinese output when prompts don't explicitly specify language. The project already has `PromptVariant.ENGLISH_ENFORCED` infrastructure (Phase 40) with the instruction "CRITICAL: Respond ONLY in English. Do not output Chinese or any other language." Currently, GLM-4.6 uses `ENGLISH_ENFORCED`, but GLM-4.7 uses `ENGLISH_ENFORCED` + `EXTRACT_JSON` handler, suggesting observed language + JSON wrapping issues.

For JSON extraction, models commonly wrap JSON in markdown code blocks (```json ... ```), add explanatory prefixes ("Here's the prediction:"), or include conversational fluff. The project has `ResponseHandler.EXTRACT_JSON` that strips markdown blocks and extracts JSON objects/arrays. Industry research (2026) shows the standard approach is: (1) use `response_format: {type: "json_object"}` to request JSON mode (already implemented), (2) add explicit JSON-only instructions to prompts (partially implemented via `PromptVariant.JSON_STRICT`), and (3) apply regex-based extraction as fallback cleanup (already implemented in `parsePredictionResponse()`).

The fix strategy is straightforward: (1) audit GLM models to ensure all have `ENGLISH_ENFORCED` variant, (2) audit models with markdown/wrapper issues to apply `EXTRACT_JSON` handler, (3) potentially combine variants (e.g., `ENGLISH_THINKING_STRIPPED` pattern) for models with multiple issues, (4) enhance JSON extraction regex in `parsePredictionResponse()` if needed, (5) run regression tests to confirm working models unaffected.

**Primary recommendation:** Audit GLM models for English enforcement, identify models wrapping JSON from diagnostic results, apply appropriate prompt variants and response handlers, validate with regression tests.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Existing prompt variants** | In-place | `PromptVariant.ENGLISH_ENFORCED`, `JSON_STRICT` | Already implemented in Phase 40, append language/format instructions to prompts |
| **Existing response handlers** | In-place | `ResponseHandler.EXTRACT_JSON` | Already implemented in Phase 40, strips markdown and extracts JSON |
| **Existing JSON parser** | In-place | `parsePredictionResponse()`, `parseBatchPredictionResponse()` | Already in `src/lib/llm/prompt.ts`, multi-strategy extraction with regex fallbacks |
| **regex (built-in)** | ES2024 | Pattern matching for Chinese chars, markdown blocks, JSON objects | Standard JavaScript, no dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Diagnostic results** | Phase 54 output | Raw response JSON files showing language/JSON issues | Identify which models need fixes |
| **Zod validation** | 4.3.6 (installed) | Validate regression test results | Verify fixes don't break working models |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt variant only | Response handler only | Variant prevents issue (preferred), handler cleans up when prevention fails (belt-and-suspenders) |
| Response handler only | Prompt variant only | Handler is last-resort, variant more efficient (fewer tokens/less latency) |
| Custom regex | llm-output-parser library | Existing regex works, adding library is overkill for 2-3 patterns |
| Manual fixes per model | Combined variants (e.g., ENGLISH_JSON_STRICT) | Combined variant reduces config duplication for models with multiple issues |

**Installation:** No new packages required. All infrastructure exists from Phase 40 (prompt variants, response handlers).

## Architecture Patterns

### Pattern 1: Language Enforcement for Bilingual Models

**What:** Apply `ENGLISH_ENFORCED` prompt variant to models that default to non-English output.

**When to use:** GLM family models, any model with bilingual capabilities that outputs Chinese/non-English in diagnostic tests.

**Implementation:**
```typescript
// Source: src/lib/llm/prompt-variants.ts (existing)
export enum PromptVariant {
  ENGLISH_ENFORCED = 'english-enforced',
  // ... other variants
}

export const PROMPT_VARIANTS: Record<PromptVariant, string> = {
  [PromptVariant.ENGLISH_ENFORCED]:
    '\n\nCRITICAL: Respond ONLY in English. Do not output Chinese or any other language.',
  // ... other variants
};

// CURRENT: GLM-4.6 has English enforcement
export const GLM46_SynProvider = new SyntheticProvider(
  'glm-4.6-syn',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6 (Synthetic)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED, // ✅ Correct
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000,
  }
);

// CURRENT: GLM-4.7 has English enforcement + JSON extraction
export const GLM47_SynProvider = new SyntheticProvider(
  'glm-4.7-syn',
  'synthetic',
  'hf:zai-org/GLM-4.7',
  'GLM 4.7 (Synthetic)',
  'budget',
  { promptPer1M: 0.45, completionPer1M: 0.90 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED, // ✅ Correct
    responseHandler: ResponseHandler.EXTRACT_JSON, // ✅ Handles JSON wrapping
    timeoutMs: 60000,
  }
);
```

**Detection in diagnostics:**
```typescript
// Source: scripts/diagnostic/categorize-failure.ts (existing)
const CHINESE_CHAR_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;

// Category 4: Language - non-English response
else if (CHINESE_CHAR_REGEX.test(rawResponse)) {
  category = FailureCategory.LANGUAGE;
}

// Fix recommendation
[FailureCategory.LANGUAGE]:
  'Add English-only instruction to prompt variant or switch to different model',
```

**Key insight:** Bilingual models (GLM-130B family) are trained 50/50 Chinese-English. Without explicit language instruction, they may default to Chinese based on model architecture biases. `ENGLISH_ENFORCED` variant prevents this at generation time (more efficient than post-processing).

Sources:
- [GLM-130B: An Open Bilingual Pre-Trained Model](https://keg.cs.tsinghua.edu.cn/glm-130b/posts/glm-130b/)
- [The Best Open Source LLMs for Mandarin Chinese in 2026](https://www.siliconflow.com/articles/en/best-open-source-LLM-for-Mandarin-Chinese)

### Pattern 2: JSON Extraction from Wrapped Responses

**What:** Apply `EXTRACT_JSON` response handler to models that wrap JSON in markdown code blocks or add explanatory text.

**When to use:** Models that ignore `response_format: {type: "json_object"}` parameter and add markdown/prefixes to JSON output.

**Implementation:**
```typescript
// Source: src/lib/llm/response-handlers.ts (existing)
const extractJsonHandler: ResponseHandlerFn = (response: string): string => {
  // 1. Remove markdown code blocks
  let cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // 2. Try to extract JSON object first (prefer single prediction)
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return objMatch[0];
  }

  // 3. Fall back to JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    return arrMatch[0];
  }

  // 4. No JSON found, return cleaned input
  return cleaned;
};

// EXAMPLE: DeepSeek V3.2 wraps JSON in explanations
export const DeepSeekV32_SynProvider = new SyntheticProvider(
  'deepseek-v3.2-syn',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3.2',
  'DeepSeek V3.2 (Synthetic)',
  'budget',
  { promptPer1M: 0.65, completionPer1M: 1.30 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT, // Prevent wrapping
    responseHandler: ResponseHandler.EXTRACT_JSON, // Cleanup if prevention fails
    timeoutMs: 45000,
  }
);

// EXAMPLE: GPT-OSS 120B adds markdown blocks
export const GPTOSS120B_SynProvider = new SyntheticProvider(
  'gpt-oss-120b-syn',
  'synthetic',
  'hf:openai/gpt-oss-120b',
  'GPT-OSS 120B (Synthetic)',
  'budget',
  { promptPer1M: 1.20, completionPer1M: 2.40 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT, // Prevent wrapping
    responseHandler: ResponseHandler.EXTRACT_JSON, // Cleanup if prevention fails
    timeoutMs: 45000,
  }
);
```

**Enhanced JSON parsing (already implemented):**
```typescript
// Source: src/lib/llm/prompt.ts lines 142-248 (existing)
export function parsePredictionResponse(response: string): ParsedPrediction {
  try {
    let cleaned = response.trim();

    // 1. Remove thinking/reasoning tags (in case any slip through)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

    // 2. Remove markdown code block markers
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    // 3. Try multiple JSON patterns (home_score/homeScore variants)
    const jsonPatterns = [
      /\{\s*"home_score"\s*:\s*\d+\s*,\s*"away_score"\s*:\s*\d+\s*\}/i,
      /\{\s*"away_score"\s*:\s*\d+\s*,\s*"home_score"\s*:\s*\d+\s*\}/i,
      /\{\s*"homeScore"\s*:\s*\d+\s*,\s*"awayScore"\s*:\s*\d+\s*\}/i,
      /\{\s*"awayScore"\s*:\s*\d+\s*,\s*"homeScore"\s*:\s*\d+\s*\}/i,
      /\{[^{}]*"home_?[sS]core"[^{}]*"away_?[sS]core"[^{}]*\}/i,
      /\{[^{}]*"away_?[sS]core"[^{}]*"home_?[sS]core"[^{}]*\}/i,
    ];

    // 4. Try parsing with each pattern
    for (const pattern of jsonPatterns) {
      const jsonMatch = cleaned.match(pattern);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // ... validate and return
      }
    }

    // 5. Fallback: try parsing entire cleaned response
    // ... (already handles this)
  } catch (error) {
    return { homeScore: 0, awayScore: 0, success: false, error: ... };
  }
}
```

**Key insight:** Belt-and-suspenders approach: `JSON_STRICT` variant prevents wrapping via prompt instruction, `EXTRACT_JSON` handler cleans up when prevention fails. This covers models that ignore `response_format` parameter or add conversational context despite instructions.

Sources:
- [Data extraction: The many ways to get LLMs to spit JSON content](https://glaforge.dev/posts/2024/11/18/data-extraction-the-many-ways-to-get-llms-to-spit-json-content/)
- [LLM Output Parser: Effortless JSON/XML Extraction](https://kamenialexnea.github.io/portfolio/2025-03-01-llm-output-parser/)
- [GitHub - tryparse: Multi-strategy parser for messy LLM responses](https://github.com/agents-sh/tryparse)

### Pattern 3: Combined Variants for Multi-Issue Models

**What:** Create combined prompt variants for models exhibiting multiple issues (e.g., language + thinking tags).

**When to use:** When a model needs both English enforcement AND thinking suppression (or other combinations).

**Already implemented:**
```typescript
// Source: src/lib/llm/prompt-variants.ts lines 23, 49-54 (existing)
export enum PromptVariant {
  // ... single variants
  ENGLISH_THINKING_STRIPPED = 'english-thinking-stripped',
}

export const PROMPT_VARIANTS: Record<PromptVariant, string> = {
  [PromptVariant.ENGLISH_THINKING_STRIPPED]:
    '\n\nCRITICAL: Respond ONLY in English. Do not output Chinese or any other language.\n\n' +
    'OUTPUT FORMAT - CRITICAL:\n' +
    '- Do NOT use <think>, <thinking>, or <reasoning> tags\n' +
    '- Output ONLY the JSON prediction\n' +
    '- No thinking process in the response',
};
```

**Potential new combinations needed:**
```typescript
// IF diagnostic results show need for these combinations:

// English + JSON strict (for bilingual models that also wrap JSON)
ENGLISH_JSON_STRICT = 'english-json-strict',

// Example implementation:
[PromptVariant.ENGLISH_JSON_STRICT]:
  '\n\nCRITICAL: Respond ONLY in English. Do not output Chinese or any other language.\n\n' +
  'OUTPUT FORMAT - CRITICAL:\n' +
  '- Return ONLY valid JSON\n' +
  '- No explanations before or after the JSON\n' +
  '- No markdown code blocks\n' +
  '- No natural language\n' +
  '- Just the raw JSON object',
```

**Decision criteria:**
- If 2+ models need same combination → create combined variant (DRY principle)
- If only 1 model → use multiple handlers (variant + response handler)
- Prefer combined variants for clarity and maintainability

### Pattern 4: Diagnostic-Driven Fix Application

**What:** Use diagnostic raw responses to identify which models need which fixes.

**When to use:** Before applying any fixes, to ensure targeted changes based on actual failures.

**Workflow:**
1. Run diagnostic suite: `npm run diagnose`
2. Review diagnostic report: `src/__tests__/diagnostic-results/reports/diagnostic-YYYY-MM-DD.md`
3. Identify LANGUAGE failures: models outputting Chinese characters
4. Identify PARSE failures with JSON wrapping: inspect raw responses for markdown blocks
5. Apply fixes to identified models only
6. Run regression tests: verify working models still work
7. Re-run diagnostics: confirm fixes resolved issues

**Example diagnostic analysis:**
```typescript
// Script to analyze diagnostic results (56-01 implementation)
import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface DiagnosticResult {
  modelId: string;
  success: boolean;
  error?: string;
  rawResponse: string;
  category?: string;
}

async function analyzeLanguageAndJsonIssues(): Promise<void> {
  const resultsDir = 'src/__tests__/diagnostic-results/raw-responses';
  const files = await readdir(resultsDir);

  const languageIssues: string[] = [];
  const jsonWrappingIssues: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filepath = path.join(resultsDir, file);
    const content = await readFile(filepath, 'utf-8');
    const result: DiagnosticResult = JSON.parse(content);

    // Skip successful predictions
    if (result.success) continue;

    // Check for language issues (Chinese characters)
    if (/[\u3400-\u4DBF\u4E00-\u9FFF]/.test(result.rawResponse)) {
      languageIssues.push(result.modelId);
      console.log(`Language issue: ${result.modelId}`);
      console.log(`  Preview: ${result.rawResponse.slice(0, 100)}`);
    }

    // Check for JSON wrapping (markdown blocks, explanatory text)
    if (
      result.rawResponse.includes('```json') ||
      result.rawResponse.includes('```') ||
      /^[A-Z].*:/.test(result.rawResponse.trim()) || // "Here is the JSON:"
      /\n/.test(result.rawResponse.trim().split('{')[0]) // Newline before JSON
    ) {
      jsonWrappingIssues.push(result.modelId);
      console.log(`JSON wrapping issue: ${result.modelId}`);
      console.log(`  Preview: ${result.rawResponse.slice(0, 100)}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Models with language issues: ${languageIssues.length}`);
  console.log(languageIssues.join(', '));
  console.log(`\nModels with JSON wrapping issues: ${jsonWrappingIssues.length}`);
  console.log(jsonWrappingIssues.join(', '));
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chinese character detection | Custom NLP-based language detection | Simple regex: `/[\u3400-\u4DBF\u4E00-\u9FFF]/` | CJK Unicode ranges are well-defined, regex is fast and deterministic |
| JSON extraction from markdown | Custom parser with state machine | Existing `EXTRACT_JSON` handler + `parsePredictionResponse()` | Already handles 6+ JSON patterns, markdown stripping, fallbacks |
| Prompt variant combinations | Duplicate prompt text in each model config | Combined `PromptVariant` enums | Single source of truth, easier to update, type-safe |
| Diagnostic analysis | Manual inspection of 42 raw response files | Script to batch-analyze diagnostic results | Automated analysis finds patterns, saves time, no human error |

**Key insight:** This phase builds on existing Phase 40 infrastructure (prompt variants, response handlers) and Phase 54 infrastructure (diagnostic results). Don't rebuild parsing or categorization logic that already works.

## Common Pitfalls

### Pitfall 1: Applying Fixes Without Diagnostic Evidence

**What goes wrong:** Adding `ENGLISH_ENFORCED` or `EXTRACT_JSON` to models that don't need it.

**Why it happens:** Preemptive fixes based on model family assumptions instead of actual failures.

**How to avoid:** ALWAYS check diagnostic raw responses first. Only apply fixes to models that actually failed with language/JSON issues in diagnostic tests.

**Warning signs:** Regression tests show previously-working models now failing after "fixes" applied.

### Pitfall 2: Using Response Handler Without Prompt Variant

**What goes wrong:** Relying only on `EXTRACT_JSON` handler without `JSON_STRICT` variant.

**Why it happens:** Handler is easier to add (one line) than prompt variant (requires testing).

**How to avoid:** Belt-and-suspenders approach: ALWAYS use BOTH prompt variant (prevention) AND response handler (cleanup). Variant prevents wasted tokens, handler catches edge cases.

**Warning signs:** Models work but have high latency or token costs due to generating then stripping unwanted content.

### Pitfall 3: Breaking `response_format: {type: "json_object"}` Parameter

**What goes wrong:** Removing `response_format` parameter when adding prompt variants.

**Why it happens:** Assuming prompt instructions replace API parameter.

**How to avoid:** Keep `response_format: {type: "json_object"}` in `callAPI()` method (line 246 of `base.ts`). This parameter works at API level, prompt variants work at instruction level. They're complementary, not alternatives.

**Code reference:**
```typescript
// Source: src/lib/llm/providers/base.ts lines 236-246
body: JSON.stringify({
  model: this.model,
  messages: [
    { role: 'system', content: enhancedSystemPrompt },
    { role: 'user', content: userPrompt },
  ],
  temperature: 0.5,
  max_tokens: maxTokens,
  // CRITICAL: Keep this - enforces JSON mode at API level
  response_format: { type: 'json_object' },
}),
```

### Pitfall 4: Overly Broad JSON Extraction Regex

**What goes wrong:** Regex extracts incorrect JSON objects when response has multiple nested objects.

**Why it happens:** Greedy regex patterns like `/\{.*\}/` match too much.

**How to avoid:** Use non-greedy patterns `/\{[\s\S]*?\}/` or rely on existing multi-pattern approach in `parsePredictionResponse()` that tries specific field patterns first.

**Warning signs:** Parse succeeds but extracts wrong object (e.g., gets error object instead of prediction object).

### Pitfall 5: Not Testing Combined Variants

**What goes wrong:** Creating new combined variant but not testing with actual model responses.

**Why it happens:** Copying existing variant patterns without validating against real LLM output.

**How to avoid:** After creating combined variant, run single-model diagnostic test before applying to all models. Verify raw response shows both issues resolved.

**Example test:**
```bash
# Test single model with new variant
npm run diagnose -- --model glm-4.7-syn
# Inspect raw response: should be English + clean JSON
cat src/__tests__/diagnostic-results/raw-responses/glm-4.7-syn.json
```

Sources:
- [A practical guide to OpenAI JSON Mode in 2025](https://www.eesel.ai/blog/openai-json-mode)
- [Enforcing JSON Outputs in Commercial LLMs](https://datachain.ai/blog/enforcing-json-outputs-in-commercial-llms)

## Code Examples

### Example 1: Audit Script for Language & JSON Issues

```typescript
// Source: Diagnostic analysis + model audit patterns
import { ALL_PROVIDERS } from '@/lib/llm';
import { PromptVariant } from '@/lib/llm/prompt-variants';
import { ResponseHandler } from '@/lib/llm/response-handlers';

interface ModelAudit {
  modelId: string;
  hasEnglishEnforcement: boolean;
  hasJsonExtraction: boolean;
  needsEnglishFix: boolean; // Based on diagnostic results
  needsJsonFix: boolean; // Based on diagnostic results
  currentConfig: { variant?: PromptVariant; handler?: ResponseHandler };
  recommendedConfig: { variant?: PromptVariant; handler?: ResponseHandler };
}

function auditLanguageAndJsonHandling(
  diagnosticLanguageFailures: string[], // From LANGUAGE category
  diagnosticJsonFailures: string[] // From PARSE category with markdown
): ModelAudit[] {
  const audits: ModelAudit[] = [];

  for (const provider of Object.values(ALL_PROVIDERS)) {
    const config = provider.promptConfig || {};
    const variant = config.promptVariant;
    const handler = config.responseHandler;

    const hasEnglish = variant === PromptVariant.ENGLISH_ENFORCED ||
                       variant === PromptVariant.ENGLISH_THINKING_STRIPPED;
    const hasJson = handler === ResponseHandler.EXTRACT_JSON ||
                    variant === PromptVariant.JSON_STRICT;

    const needsEnglish = diagnosticLanguageFailures.includes(provider.id);
    const needsJson = diagnosticJsonFailures.includes(provider.id);

    // Determine recommended config
    let recommendedVariant = variant;
    let recommendedHandler = handler;

    if (needsEnglish && !hasEnglish) {
      // Add English enforcement
      if (variant === PromptVariant.THINKING_STRIPPED) {
        recommendedVariant = PromptVariant.ENGLISH_THINKING_STRIPPED;
      } else {
        recommendedVariant = PromptVariant.ENGLISH_ENFORCED;
      }
    }

    if (needsJson && !hasJson) {
      // Add JSON extraction
      recommendedHandler = ResponseHandler.EXTRACT_JSON;
      if (!recommendedVariant || recommendedVariant === PromptVariant.BASE) {
        recommendedVariant = PromptVariant.JSON_STRICT;
      }
    }

    audits.push({
      modelId: provider.id,
      hasEnglishEnforcement: hasEnglish,
      hasJsonExtraction: hasJson,
      needsEnglishFix: needsEnglish,
      needsJsonFix: needsJson,
      currentConfig: { variant, handler },
      recommendedConfig: {
        variant: recommendedVariant,
        handler: recommendedHandler,
      },
    });
  }

  // Filter to models needing fixes
  const needsFixes = audits.filter(a => a.needsEnglishFix || a.needsJsonFix);

  console.log('\n=== MODELS NEEDING FIXES ===\n');
  for (const audit of needsFixes) {
    console.log(`${audit.modelId}:`);
    if (audit.needsEnglishFix) {
      console.log('  ❌ Language issue detected - needs ENGLISH_ENFORCED');
    }
    if (audit.needsJsonFix) {
      console.log('  ❌ JSON wrapping detected - needs EXTRACT_JSON handler');
    }
    console.log(`  Current: variant=${audit.currentConfig.variant || 'BASE'}, handler=${audit.currentConfig.handler || 'DEFAULT'}`);
    console.log(`  Recommended: variant=${audit.recommendedConfig.variant || 'BASE'}, handler=${audit.recommendedConfig.handler || 'DEFAULT'}`);
    console.log();
  }

  return audits;
}

// Usage: Run after diagnostic suite
const languageFailures = ['glm-4.6-syn', 'glm-4.7-syn']; // Example from diagnostics
const jsonFailures = ['deepseek-v3.2-syn', 'gpt-oss-120b-syn']; // Example

const audits = auditLanguageAndJsonHandling(languageFailures, jsonFailures);
```

### Example 2: Model Configuration Updates

```typescript
// Source: src/lib/llm/providers/synthetic.ts pattern (existing + proposed)

// BEFORE Phase 56: GLM-4.6 (if missing English enforcement)
export const GLM46_BEFORE = new SyntheticProvider(
  'glm-4.6-syn',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6 (Synthetic)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false,
  {
    promptVariant: PromptVariant.BASE, // ❌ No language enforcement
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000,
  }
);

// AFTER Phase 56: GLM-4.6 with English enforcement
export const GLM46_AFTER = new SyntheticProvider(
  'glm-4.6-syn',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6 (Synthetic)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED, // ✅ Fixed
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000,
  }
);

// EXAMPLE: Model with both language + JSON issues
// IF diagnostic shows a bilingual model that also wraps JSON
export const HypotheticalModel = new SyntheticProvider(
  'hypothetical-model-syn',
  'synthetic',
  'hf:org/model',
  'Hypothetical Model',
  'budget',
  { promptPer1M: 0.50, completionPer1M: 1.00 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED, // Prevent Chinese output
    responseHandler: ResponseHandler.EXTRACT_JSON, // Extract from markdown
    timeoutMs: 60000,
  }
);

// EXAMPLE: Model with language + thinking tags
// (Would need ENGLISH_THINKING_STRIPPED variant)
export const BilingualReasoningModel = new SyntheticProvider(
  'bilingual-reasoning-syn',
  'synthetic',
  'hf:org/model',
  'Bilingual Reasoning Model',
  'premium',
  { promptPer1M: 2.00, completionPer1M: 5.00 },
  true,
  {
    promptVariant: PromptVariant.ENGLISH_THINKING_STRIPPED, // Combined variant
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS, // Cleanup fallback
    timeoutMs: 90000,
  }
);
```

### Example 3: Enhanced JSON Extraction (if needed)

```typescript
// Source: src/lib/llm/prompt.ts + industry patterns
// ONLY implement if existing parser fails with new patterns

/**
 * Enhanced JSON extraction for models with prefixes/wrappers
 * Handles: "Here's the prediction: {...}", "Result:\n{...}", etc.
 */
function extractJsonWithPrefixes(response: string): string | null {
  let cleaned = response.trim();

  // 1. Remove common prefixes (case-insensitive)
  const prefixes = [
    /^Here(?:'s| is) (?:the )?(?:prediction|result|json):?\s*/i,
    /^Result:?\s*/i,
    /^Prediction:?\s*/i,
    /^Output:?\s*/i,
    /^Response:?\s*/i,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }

  // 2. Remove markdown code blocks
  cleaned = cleaned
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // 3. Extract JSON object (non-greedy to avoid matching too much)
  const objMatch = cleaned.match(/\{[\s\S]*?\}/);
  if (objMatch) {
    return objMatch[0];
  }

  // 4. Extract JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    return arrMatch[0];
  }

  return null;
}

// Integrate into parsePredictionResponse if needed
// (Current implementation already handles most cases)
```

### Example 4: Regression Test for Language & JSON Fixes

```typescript
// Source: Phase 53 regression test pattern
import { describe, it, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { TEST_PROMPT, TEST_MATCH_ID } from '@/__tests__/fixtures/test-data';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';

describe('Phase 56: Language & JSON Fixes Regression', () => {
  const glmModels = ['glm-4.6-syn', 'glm-4.7-syn'];
  const jsonWrappingModels = ['deepseek-v3.2-syn', 'gpt-oss-120b-syn'];

  it.each(glmModels)(
    '%s should output only English after Phase 56',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      expect(result.success).toBe(true);

      // Raw response should NOT contain Chinese characters
      const chineseRegex = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
      expect(result.rawResponse).not.toMatch(chineseRegex);
    }
  );

  it.each(jsonWrappingModels)(
    '%s should extract JSON from wrapped responses after Phase 56',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      expect(result.success).toBe(true);

      const prediction = result.predictions.get(TEST_MATCH_ID);
      expect(prediction).toBeDefined();

      // Validate schema (parse succeeded)
      const validated = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: prediction?.homeScore,
        away_score: prediction?.awayScore,
      });

      expect(validated.success).toBe(true);
    }
  );

  // Regression check: working models should still work
  const workingModels = [
    'deepseek-v3.1',
    'qwen3-235b-instruct',
    'llama-3.1-405b',
    // ... all models from Phase 53 success list
  ];

  it.each(workingModels)(
    '%s should still work after Phase 56 changes',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      expect(result.success).toBe(true);

      const prediction = result.predictions.get(TEST_MATCH_ID);
      const validated = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: prediction?.homeScore,
        away_score: prediction?.awayScore,
      });

      expect(validated.success).toBe(true);
    }
  );
});
```

## State of the Art

### Current Approach vs. Best Practices (2026)

| Aspect | Current State | 2026 Best Practice | Status |
|--------|---------------|-------------------|--------|
| Language enforcement | `ENGLISH_ENFORCED` prompt variant | Explicit language instruction in system prompt | ✅ Already implemented (Phase 40) |
| JSON mode | `response_format: {type: "json_object"}` | JSON mode + prompt instructions + fallback extraction | ✅ All three layers present |
| JSON extraction | Regex-based multi-pattern matching | Multi-strategy parser with fallbacks | ✅ Already implemented |
| Bilingual model handling | Case-by-case variant application | Systematic audit + automated testing | ⚠️ Need diagnostic-driven audit |
| Combined issues | Manual config for each model | Combined prompt variants (e.g., ENGLISH_JSON_STRICT) | ✅ ENGLISH_THINKING_STRIPPED exists, pattern established |

### Language Enforcement Evolution (2025-2026)

| Approach | 2025 | 2026 | Project Status |
|----------|------|------|----------------|
| Translate all to English | Common practice | Discouraged (loses context) | Not applicable (using English prompts) |
| Match prompt to content language | Emerging research | Recommended for multilingual content | Not applicable (English content) |
| Explicit output language in prompt | Standard for bilingual models | Industry standard | ✅ Implemented |
| System-level language parameter | Not widely supported | Not standard in APIs | Not available |

Sources:
- [Why Your LLM Prompts Should Match Your Content Language](https://ryanstenhouse.dev/why-your-llm-prompts-should-match-your-content-language/)
- [Tips to Write Effective LLM Prompts and Generate Multilingual Content](https://labs.lilt.com/tips-to-write-effective-llm-prompts-and-generate-multilingual-content)

### JSON Extraction Approaches (2026)

| Approach | Reliability | Performance | Project Usage |
|----------|-------------|-------------|---------------|
| JSON mode parameter only | 60-70% (models ignore it) | Fast | ✅ Used (line 1) |
| Prompt instructions only | 70-80% (models add fluff) | Medium | ✅ Used (JSON_STRICT variant) |
| Regex extraction only | 80-90% (brittle patterns) | Fast | ✅ Used (parsePredictionResponse) |
| **Triple layer (all three)** | **95%+ (belt-and-suspenders)** | **Medium** | **✅ Full implementation** |
| Structured outputs (JSON schema) | 99%+ (enforced at API) | Medium | ❌ Not supported by Together/Synthetic |

**Key insight:** Project already implements the 2026 best practice (triple-layer approach). Phase 56 just needs to apply existing infrastructure to models identified by diagnostics.

Sources:
- [The guide to structured outputs and function calling with LLMs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [A practical guide to OpenAI JSON Mode in 2025](https://www.eesel.ai/blog/openai-json-mode)
- [Data extraction: The many ways to get LLMs to spit JSON content](https://glaforge.dev/posts/2024/11/18/data-extraction-the-many-ways-to-get-llms-to-spit-json-content/)

## Open Questions

### 1. Which Specific Models Have Language Issues in Production?

**What we know:**
- GLM-4.6 and GLM-4.7 are bilingual (Chinese-English) models
- GLM-4.6 already has `ENGLISH_ENFORCED` configured
- GLM-4.7 has `ENGLISH_ENFORCED` + `EXTRACT_JSON`

**What's unclear:** Are there actual diagnostic failures showing Chinese output, or is current config already working?

**Recommendation:** Run `npm run diagnose` and check diagnostic report for LANGUAGE category failures. Only apply fixes to models that actually failed, not preemptively.

### 2. Which Models Wrap JSON Despite JSON Mode Parameter?

**What we know:**
- DeepSeek V3.2 has `JSON_STRICT` + `EXTRACT_JSON` configured
- GPT-OSS 120B has `JSON_STRICT` + `EXTRACT_JSON` configured
- This suggests observed wrapping issues during testing

**What's unclear:** Are there other models wrapping JSON that aren't configured with handlers?

**Recommendation:** Analyze diagnostic results in PARSE category. Inspect raw responses for markdown blocks (```json) or prefixes ("Here is:"). List models needing `EXTRACT_JSON` handler.

### 3. Do We Need New Combined Variants?

**What we know:** `ENGLISH_THINKING_STRIPPED` already exists for bilingual reasoning models.

**What's unclear:** Do any models need `ENGLISH_JSON_STRICT` combination?

**Recommendation:** Cross-reference diagnostic failures. If any model has BOTH language AND parse failures, create combined variant. If only 1 model, use separate variant + handler instead.

### 4. Current Extraction Regex Coverage

**What we know:** `parsePredictionResponse()` has 6 JSON patterns, handles markdown stripping, multiple fallbacks.

**What's unclear:** Are there JSON wrapping patterns not covered by existing regex?

**Recommendation:** Review diagnostic raw responses for PARSE failures. If new patterns emerge (e.g., "Result: {...}"), add to prefix removal list. If existing patterns work, no changes needed.

## Sources

### Primary (HIGH confidence)

**Project codebase:**
- `src/lib/llm/prompt-variants.ts` - Prompt variant infrastructure (ENGLISH_ENFORCED, JSON_STRICT)
- `src/lib/llm/response-handlers.ts` - Response handler infrastructure (EXTRACT_JSON)
- `src/lib/llm/prompt.ts` - JSON parsing with multi-strategy extraction (parsePredictionResponse)
- `src/lib/llm/providers/synthetic.ts` - GLM model configurations, existing variant usage
- `src/lib/llm/providers/base.ts` - response_format parameter application
- `scripts/diagnostic/categorize-failure.ts` - LANGUAGE and PARSE category definitions
- `.planning/phases/54-diagnostic-infrastructure/54-RESEARCH.md` - Diagnostic infrastructure

**GLM Models:**
- [GLM-130B: An Open Bilingual Pre-Trained Model](https://keg.cs.tsinghua.edu.cn/glm-130b/posts/glm-130b/)
- [GitHub - zai-org/GLM-130B](https://github.com/zai-org/GLM-130B)
- [GLM-4.6: A Data-Driven Look at China's Rising AI Model](https://blog.kilo.ai/p/glm-46-a-data-driven-look-at-chinas)
- [The Best Open Source LLMs for Mandarin Chinese in 2026](https://www.siliconflow.com/articles/en/best-open-source-LLM-for-Mandarin-Chinese)

### Secondary (MEDIUM confidence)

**JSON mode and structured outputs:**
- [The guide to structured outputs and function calling with LLMs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Structured Outputs - Together.ai Docs](https://docs.together.ai/docs/json-mode)
- [A practical guide to OpenAI JSON Mode in 2025](https://www.eesel.ai/blog/openai-json-mode)
- [Enforcing JSON Outputs in Commercial LLMs](https://datachain.ai/blog/enforcing-json-outputs-in-commercial-llms)

**JSON extraction patterns:**
- [Data extraction: The many ways to get LLMs to spit JSON content](https://glaforge.dev/posts/2024/11/18/data-extraction-the-many-ways-to-get-llms-to-spit-json-content/)
- [LLM Output Parser: Effortless JSON/XML Extraction](https://kamenialexnea.github.io/portfolio/2025-03-01-llm-output-parser/)
- [GitHub - tryparse: Multi-strategy parser for messy LLM responses](https://github.com/agents-sh/tryparse)
- [llm-output-parser · PyPI](https://pypi.org/project/llm-output-parser/)

**Language enforcement:**
- [Why Your LLM Prompts Should Match Your Content Language](https://ryanstenhouse.dev/why-your-llm-prompts-should-match-your-content-language/)
- [Tips to Write Effective LLM Prompts and Generate Multilingual Content](https://labs.lilt.com/tips-to-write-effective-llm-prompts-and-generate-multilingual-content)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists from Phase 40, no new libraries needed
- Architecture patterns: HIGH - Prompt variants and response handlers are well-established, diagnostic-driven approach is straightforward
- Pitfalls: HIGH - Based on project code patterns and industry best practices for JSON extraction

**Research date:** 2026-02-08
**Valid until:** 60 days (stable domain - language enforcement and JSON extraction patterns unlikely to change rapidly)

**Key findings:**
1. All infrastructure exists - Phase 40 prompt variants + response handlers ready to use
2. GLM models already partially configured (GLM-4.6 has ENGLISH_ENFORCED, GLM-4.7 has both fixes)
3. Triple-layer JSON approach already implemented (response_format + prompt instructions + regex extraction)
4. Diagnostic results (Phase 54) provide evidence for targeted fixes
5. Belt-and-suspenders pattern established: prompt variant (prevention) + response handler (cleanup)
6. Combined variants already exist (ENGLISH_THINKING_STRIPPED), pattern ready for reuse
7. Regression tests (Phase 53) provide validation framework
8. Industry standard (2026): explicit language instructions in prompts for bilingual models
9. Industry standard (2026): multi-strategy JSON extraction with fallbacks

**Dependencies:**
- Phase 54 diagnostic results (identify which models need fixes)
- Phase 53 regression test suite (validate no regressions)
- Phase 40 prompt variants and response handlers (apply consistently)
