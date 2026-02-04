# Phase 39: Testing & Validation - Research

**Researched:** 2026-02-04
**Domain:** Multi-model LLM validation and production readiness testing
**Confidence:** HIGH

## Summary

Phase 39 validates that all 13 newly-added Synthetic.new models produce usable predictions in production. This is not traditional unit testing, but **production readiness validation** — ensuring each model can be called via API, returns parseable JSON, and integrates correctly with the existing prediction pipeline.

The research identifies three critical validation domains:
1. **API connectivity and error handling** — Standard for all 13 models
2. **Reasoning model output parsing** — Special handling for 3 models with `<think>` tags
3. **Language output monitoring** — Chinese detection for 2 GLM models

The existing architecture already handles most edge cases (retry logic, multi-strategy parsing, health tracking). Validation focuses on **smoke testing** each model and verifying special-case handling works correctly.

**Primary recommendation:** Create a validation script that tests each model with a sample prediction, verifies parsing succeeds, and logs any special-case behaviors (thinking tags, Chinese output) for manual review.

## Standard Stack

The project uses **existing infrastructure** — no new test frameworks needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript Node scripts | Built-in | Validation script | Project already uses `tsx` for scripts (sync-models.ts, migrate-*.ts) |
| Existing parsers | Built-in | JSON extraction | `parseBatchPredictionResponse`, `parseBatchPredictionEnhanced` handle all edge cases |
| Health tracking | Built-in | Model status | `recordModelSuccess`/`recordModelFailure` track consecutive failures |
| Pino logger | 10.2.1 | Validation output | Structured logging with `loggers.llm` module |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.2.3 | Load SYNTHETIC_API_KEY | Already used in sync-models.ts |
| drizzle-orm | 0.45.1 | Database queries | Check model registration status |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom script | Jest/Vitest unit tests | Unit tests require mocking LLM APIs (complex, unreliable). Validation script tests REAL API calls. |
| Manual testing | Automated E2E test suite | E2E frameworks (Playwright, Cypress) overkill for API validation. Script is simpler. |
| Production monitoring | Pre-deployment validation | Both needed — script validates before launch, monitoring catches runtime issues. |

**Installation:**
No new dependencies required. Use existing project setup.

## Architecture Patterns

### Recommended Script Structure
```
scripts/
├── validate-models.ts     # Main validation script
└── sync-models.ts         # Existing (reference for structure)

src/lib/llm/
├── providers/
│   ├── base.ts            # OpenAICompatibleProvider.callAPI()
│   ├── synthetic.ts       # 13 model instances
│   └── together.ts        # Existing Together models
├── prompt.ts              # parseBatchPredictionResponse (handles thinking tags)
└── index.ts               # getActiveProviders (filters auto-disabled)
```

### Pattern 1: Isolated Model Testing
**What:** Test each model independently with identical input
**When to use:** Initial validation, debugging specific model failures
**Example:**
```typescript
// Source: Existing predictions.worker.ts pattern (lines 147-236)
// Adapted for validation script

import { SYNTHETIC_PROVIDERS } from '../src/lib/llm/providers/synthetic';
import { BATCH_SYSTEM_PROMPT } from '../src/lib/llm/prompt';
import { parseBatchPredictionResponse } from '../src/lib/llm/prompt';

async function validateModel(provider: SyntheticProvider) {
  const testMatchId = 'test-validation-001';
  const testPrompt = `Predict the score for this test match.
Match ID: ${testMatchId}
Home Team: Manchester United
Away Team: Liverpool
Competition: Premier League
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;

  try {
    // Call LLM API (uses existing base class method)
    const rawResponse = await (provider as any).callAPI(
      BATCH_SYSTEM_PROMPT,
      testPrompt
    );

    // Parse response (handles thinking tags automatically)
    const parsed = parseBatchPredictionResponse(rawResponse, [testMatchId]);

    return {
      modelId: provider.id,
      success: parsed.success,
      prediction: parsed.predictions[0],
      error: parsed.error,
      rawResponsePreview: rawResponse.slice(0, 300),
    };
  } catch (error) {
    return {
      modelId: provider.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Pattern 2: Reasoning Model Detection
**What:** Identify models that require thinking tag stripping
**When to use:** Logging, debugging, performance analysis
**Example:**
```typescript
// Source: Phase 37 model definitions (synthetic.ts lines 78-114)
const REASONING_MODEL_IDS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
]);

function isReasoningModel(modelId: string): boolean {
  return REASONING_MODEL_IDS.has(modelId);
}

function logModelType(modelId: string, rawResponse: string) {
  if (isReasoningModel(modelId)) {
    const hasThinkTags = /<think>/i.test(rawResponse);
    console.log(`[${modelId}] Reasoning model — thinking tags present: ${hasThinkTags}`);
  }
}
```

### Pattern 3: Chinese Output Detection
**What:** Detect Chinese characters in model output (GLM models)
**When to use:** Post-validation monitoring, auto-disable trigger
**Example:**
```typescript
// Detect Chinese characters (Unicode ranges for CJK)
function containsChinese(text: string): boolean {
  // CJK Unified Ideographs: U+4E00–U+9FFF
  // CJK Extension A: U+3400–U+4DBF
  const chineseRegex = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
  return chineseRegex.test(text);
}

function validateLanguage(modelId: string, rawResponse: string) {
  const GLM_MODEL_IDS = ['glm-4.6-syn', 'glm-4.7-syn'];

  if (GLM_MODEL_IDS.includes(modelId)) {
    const hasChinese = containsChinese(rawResponse);
    if (hasChinese) {
      console.warn(`[${modelId}] WARNING: Chinese characters detected in output`);
      console.warn(`Preview: ${rawResponse.slice(0, 200)}`);
      return false; // Mark as validation failure
    }
  }
  return true;
}
```

### Anti-Patterns to Avoid
- **Testing in production first:** Don't deploy without validation script. First prediction failure triggers health tracking, risking auto-disable.
- **Mocking API responses:** Unit tests with mocked responses don't catch real API issues (format changes, rate limits, Chinese output).
- **Synchronous validation:** Testing 13 models sequentially is slow (30+ seconds). Use concurrent promises with `Promise.allSettled()`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction from LLM output | Custom regex parser | `parseBatchPredictionResponse` + `parseBatchPredictionEnhanced` (prompt.ts) | Already handles 4 fallback strategies: direct JSON, markdown blocks, regex patterns, flexible matching. Strips thinking tags automatically (lines 275-278). |
| Thinking tag removal | Manual string replacement | Built into parser (lines 148-150, 275-278) | Parser already strips `<think>`, `<thinking>`, `<reasoning>` tags before JSON extraction. No additional logic needed. |
| Model health tracking | Custom failure counter | `recordModelSuccess`/`recordModelFailure` (queries.ts:782-852) | Atomic SQL updates prevent race conditions. Auto-disables after 5 consecutive model-specific failures. Partial recovery after 1-hour cooldown. |
| API retry logic | setTimeout loops | `fetchWithRetry` from api-client.ts (base.ts:217-242) | Handles 429 rate limits, 5xx errors, timeouts with exponential backoff. Integrates with service-specific retry configs. |

**Key insight:** The prediction pipeline is production-hardened. Validation focuses on **smoke testing** (does it work at all?) not **robust error handling** (already implemented).

## Common Pitfalls

### Pitfall 1: Expecting JSON Mode to Work
**What goes wrong:** Synthetic.new API support for `response_format: { type: "json_object" }` is unknown/untested
**Why it happens:** Base provider class (base.ts:236) always sets JSON mode, but Synthetic.new may ignore it
**How to avoid:** Validation script tests if JSON mode works. If not, parser fallbacks handle non-JSON responses
**Warning signs:** Models return markdown-wrapped JSON or plain text with scores embedded

### Pitfall 2: Thinking Tags in Final Output
**What goes wrong:** Reasoning models return `<think>reasoning</think>{json}` and parser extracts thinking content instead of JSON
**Why it happens:** Parser strips tags (lines 148-150, 275-278), but some models may use nested tags or different formats
**How to avoid:** Validation script logs raw responses for reasoning models. Manual review confirms tags are stripped correctly.
**Warning signs:** Parsed predictions have extremely long text values or contain reasoning traces

### Pitfall 3: Chinese Output Not Detected
**What goes wrong:** GLM models output Chinese despite English prompts, but predictions marked as successful
**Why it happens:** JSON structure is valid, but content is wrong language. Parser doesn't validate language.
**How to avoid:** Validation script includes Chinese detection function. Log warnings for manual review.
**Warning signs:** Predictions have valid scores but Chinese text in reasoning/explanation fields (if exposed)

### Pitfall 4: Silent Model Auto-Disable
**What goes wrong:** Model fails validation, gets auto-disabled, never gets re-tested
**Why it happens:** Health tracking auto-disables after 5 consecutive failures (queries.ts:808-819). Cooldown recovery is 1 hour (line 871).
**How to avoid:** Validation script tests BEFORE models are registered in production. Reset health tracking (`autoDisabled=false, consecutiveFailures=0`) before deployment.
**Warning signs:** `getActiveProviders()` returns fewer models than expected. Check `models.autoDisabled` in database.

### Pitfall 5: Rate Limit During Validation
**What goes wrong:** Testing 13 models concurrently hits rate limit (135 req/5hrs on Synthetic Standard tier)
**Why it happens:** Each validation call counts as 1 request (or 0.2 for small requests <2048 tokens)
**How to avoid:** Validation script uses sequential testing OR small batches (3-5 concurrent). Log rate limit errors separately (don't count as model failure).
**Warning signs:** Multiple models fail with "429 rate limit exceeded" error

## Code Examples

Verified patterns from existing codebase:

### Testing Single Model with Error Classification
```typescript
// Source: predictions.worker.ts (lines 212-236)
// Adapted for validation context

import { classifyErrorType, isModelSpecificFailure } from '@/lib/utils/retry-config';

async function testModelWithClassification(provider: SyntheticProvider) {
  try {
    const rawResponse = await (provider as any).callAPI(
      BATCH_SYSTEM_PROMPT,
      testPrompt
    );

    const parsed = parseBatchPredictionResponse(rawResponse, [testMatchId]);

    if (!parsed.success) {
      // Parse failure is model-specific (not transient)
      console.error(`[${provider.id}] Parse failure: ${parsed.error}`);
      return { success: false, errorType: 'parse-error' };
    }

    return { success: true, prediction: parsed.predictions[0] };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const countsTowardDisable = isModelSpecificFailure(errorType);

    console.error(`[${provider.id}] API error:`, {
      message: error instanceof Error ? error.message : String(error),
      errorType,
      countsTowardDisable,
    });

    return { success: false, errorType };
  }
}
```

### Concurrent Validation with Promise.allSettled
```typescript
// Run all validations concurrently, don't fail-fast
async function validateAllModels() {
  const providers = SYNTHETIC_PROVIDERS;

  console.log(`Testing ${providers.length} Synthetic models...`);

  const results = await Promise.allSettled(
    providers.map(p => validateModel(p))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

  console.log(`\nResults: ${successful.length}/${providers.length} models validated`);

  // Log failures for manual review
  for (const result of failed) {
    if (result.status === 'fulfilled') {
      console.error(`❌ ${result.value.modelId}: ${result.value.error}`);
    } else {
      console.error(`❌ Validation crashed: ${result.reason}`);
    }
  }
}
```

### Logging Special Cases (Thinking Tags, Chinese)
```typescript
// Source: Combined patterns from prompt.ts and GLM research
function logSpecialCases(
  modelId: string,
  rawResponse: string,
  parsed: ParsedPrediction
) {
  // Check reasoning models
  if (isReasoningModel(modelId)) {
    const hasThinkTags = /<think>/i.test(rawResponse);
    const thinkTagsStripped = !/<think>/i.test(JSON.stringify(parsed));

    console.log(`[${modelId}] Reasoning model:`, {
      thinkTagsPresent: hasThinkTags,
      thinkTagsStripped,
      status: thinkTagsStripped ? '✓ Correctly parsed' : '⚠️ Tags leaked into output',
    });
  }

  // Check GLM models for Chinese
  if (['glm-4.6-syn', 'glm-4.7-syn'].includes(modelId)) {
    const hasChinese = containsChinese(rawResponse);

    console.log(`[${modelId}] Language check:`, {
      hasChinese,
      status: hasChinese ? '⚠️ Chinese detected' : '✓ English output',
    });

    if (hasChinese) {
      console.log(`Preview: ${rawResponse.slice(0, 200)}`);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual testing via UI | Validation scripts before deployment | 2020s (DevOps standard) | Catches issues before production, no user-facing failures |
| Single-strategy JSON parsing | Multi-strategy fallback parsing | Phase 01-03 (Jan 2026) | Handles markdown blocks, embedded JSON, flexible formats |
| Global rate limit handling | Per-service retry config | Phase 01 (Jan 2026) | Different backoff strategies for Together vs Synthetic |
| Permanent model disable | Auto-recovery after cooldown | Phase 01 (Jan 2026) | Transient failures don't permanently break models |

**Deprecated/outdated:**
- **Mocked API tests:** 2010s approach. Modern LLM testing uses real API calls in staging/validation environments.
- **Synchronous validation:** 2010s pattern. Concurrent testing with `Promise.allSettled()` is standard (2020s).
- **Manual failure tracking:** Spreadsheets or logs. Modern approach: structured health tracking in database.

## Reasoning Models: Thinking Tags Format

Based on research, reasoning models use specific output formats:

### DeepSeek R1
- **Format:** `<think>\n[reasoning process]\n</think>\n[final answer]`
- **API field:** May expose `reasoning` field separate from `content`
- **Best practice:** Prompt with "respond with JSON" to ensure answer is structured (thinking is separate)
- **Reference:** [DeepSeek R1 Quickstart - Together.ai](https://docs.together.ai/docs/deepseek-r1), [vLLM Reasoning Outputs](https://docs.vllm.ai/en/stable/features/reasoning_outputs/)

### Kimi K2 Thinking
- **Format:** Similar to DeepSeek — thinking exposed via `reasoning_content` field in API response
- **API field:** `response.choices[0].message.reasoning_content` (separate from `content`)
- **2026 update:** Kimi K2.5 released (Jan 27, 2026) with instant and thinking modes
- **Reference:** [Kimi K2 Thinking - Hugging Face](https://huggingface.co/moonshotai/Kimi-K2-Thinking), [Kimi K2 Thinking API - Together AI](https://www.together.ai/models/kimi-k2-thinking)

### Qwen3 Thinking
- **Format:** Qwen3-Max-Thinking released alongside Kimi K2.5 (Jan 2026)
- **Best practice:** Similar reasoning exposure patterns (check API docs for field names)
- **Reference:** [Kimi K2 vs Qwen 3 comparison](https://www.clarifai.com/blog/kimi-k2-vs-qwen-3-vs-glm-4.5)

**Key insight:** Synthetic.new uses OpenAI-compatible API. Base class checks `message.content`, `message.reasoning`, and `message.reasoning_details` (base.ts:302-319). This should handle all reasoning model formats.

**Validation requirement:** TEST-02 requires verifying thinking tags are stripped. Parser already does this (prompt.ts:148-150, 275-278), but validation script should log raw responses to confirm.

## GLM Models: Chinese Output Control

Based on research, GLM models have bilingual capabilities but may output Chinese by default:

### Language Control Strategies
1. **System prompt directive:** "Always respond in English" or "Respond in English and reason in English"
2. **Prompt positioning:** GLM-4.7 has strong bias toward beginning of prompt — place language directive FIRST
3. **Explicit instruction:** "Explicit language control prevents unexpected language-switching behavior"
4. **Reference:** [GLM-4.7 Overview](https://docs.z.ai/guides/llm/glm-4.7), [GLM-4.6 Migration Guide](https://www.cerebras.ai/blog/glm-4-6-10-tricks-to-migrate)

### Current Implementation
Project uses `BATCH_SYSTEM_PROMPT` (prompt.ts:56-94) for all models. System prompt doesn't include language directive.

**Validation requirement:** TEST-03 requires monitoring GLM output for Chinese. If detected:
- **Option 1:** Add "Respond in English" to system prompt (affects all models)
- **Option 2:** Auto-disable GLM models if they consistently output Chinese (use existing health tracking)
- **Option 3:** Accept Chinese output as failure, let health tracking auto-disable after 5 consecutive failures

**Recommendation:** Start with Option 3 (auto-disable if Chinese). If both GLM models work in English, no changes needed.

## Open Questions

Things that couldn't be fully resolved:

1. **Does Synthetic.new support JSON mode?**
   - What we know: Base class sets `response_format: { type: "json_object" }` (base.ts:236)
   - What's unclear: Synthetic.new API docs don't explicitly document JSON mode support
   - Recommendation: Validation script tests this. Parser fallbacks handle non-JSON responses if needed.

2. **Which reasoning field does Synthetic.new use?**
   - What we know: Base class checks `content`, `reasoning`, `reasoning_details` (base.ts:302-319)
   - What's unclear: Do all 3 reasoning models use the same field name?
   - Recommendation: Validation script logs which field contains output for each reasoning model.

3. **What triggers GLM Chinese output?**
   - What we know: Models are bilingual, may switch languages (research findings)
   - What's unclear: Does simple "predict score" prompt stay in English, or does it trigger Chinese?
   - Recommendation: Validation script tests with project's actual prompt. If Chinese appears, add language directive.

4. **Should validation reset health tracking?**
   - What we know: Validation failures count toward auto-disable threshold (5 failures)
   - What's unclear: Should validation script run in "test mode" that doesn't affect health tracking?
   - Recommendation: Run validation BEFORE registering models in database (they don't exist yet, no health tracking). After validation passes, run `sync-models.ts` to register.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/llm/providers/base.ts` (OpenAI-compatible provider), `src/lib/llm/prompt.ts` (parsing logic)
- Existing architecture: `src/lib/queue/workers/predictions.worker.ts` (model testing pattern)
- Database schema: `src/lib/db/schema.ts` (health tracking fields), `src/lib/db/queries.ts` (recordModelSuccess/Failure)

### Secondary (MEDIUM confidence)
- [DeepSeek R1 Quickstart - Together.ai](https://docs.together.ai/docs/deepseek-r1) — Thinking tags format
- [vLLM Reasoning Outputs](https://docs.vllm.ai/en/stable/features/reasoning_outputs/) — Reasoning field structure
- [Kimi K2 Thinking - Hugging Face](https://huggingface.co/moonshotai/Kimi-K2-Thinking) — API response format
- [GLM-4.7 Overview - Z.AI](https://docs.z.ai/guides/llm/glm-4.7) — Language control strategies
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) — JSON mode vs structured outputs
- [Synthetic.new API Overview](https://dev.synthetic.new/docs/api/overview) — OpenAI-compatible API, rate limits
- [LLM Testing in 2026 - Confident AI](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) — Modern testing strategies
- [LLM Evaluation Landscape 2026 - AIMultiple](https://research.aimultiple.com/llm-eval-tools/) — Multi-model validation patterns

### Tertiary (LOW confidence — general context)
- [REST API Testing Guide 2026](https://talent500.com/blog/rest-api-testing-guide-2026/) — General API testing best practices
- [LLM Monitoring Guide - Splunk](https://www.splunk.com/en_us/blog/learn/llm-monitoring.html) — Production monitoring strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing project infrastructure (tsx scripts, parsers, health tracking)
- Architecture: HIGH - Patterns extracted from existing predictions.worker.ts (production-tested)
- Pitfalls: HIGH - Based on existing error handling code and health tracking logic
- Reasoning models: MEDIUM - Format documented in official sources, but Synthetic.new-specific behavior untested
- GLM language control: MEDIUM - Strategies documented, but effectiveness with project prompts unknown

**Research date:** 2026-02-04
**Valid until:** 14 days (until 2026-02-18) — Fast-moving domain (new model releases, API changes)
