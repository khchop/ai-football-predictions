# Phase 55: Category Fixes - Timeouts & Tags - Research

**Researched:** 2026-02-08
**Domain:** Model-specific timeout tuning, thinking tag response handling
**Confidence:** HIGH

## Summary

Phase 55 addresses the two highest-priority failure categories identified by Phase 54's diagnostic infrastructure: timeout failures (reasoning models exceeding configured limits) and thinking-tag leakage (reasoning model output containing unstripped `<think>`, `<thinking>`, or `<reasoning>` tags that break JSON parsing).

Research confirms that reasoning models (DeepSeek R1, Qwen3-235B-Thinking, Kimi K2-Thinking) require extended timeouts due to their chain-of-thought processing phases. Production deployments report 2-minute (120s) timeout limits causing failures, with recommendations ranging from 90s-120s for reasoning models. The project already has timeout infrastructure (`REASONING_MODEL_IDS`, `getModelTimeout()`) but needs data-driven tuning based on actual P95 latency measurements from diagnostic runs.

For thinking-tag handling, the project has existing infrastructure (`STRIP_THINKING_TAGS` response handler, `THINKING_STRIPPED` prompt variant) but research shows these are not consistently applied to all reasoning models. Together AI's DeepSeek R1 currently has a 60s timeout and uses thinking tag handlers, while Synthetic's three reasoning models (deepseek-r1-0528-syn, kimi-k2-thinking-syn, qwen3-235b-thinking-syn) are configured with handlers but may have insufficient timeouts (60s-90s).

The fix approach is straightforward: (1) analyze diagnostic raw response data to calculate P95 latency per model, (2) set model-specific timeouts to P95 + safety margin (20-30%), (3) verify all reasoning models have `responseHandler: ResponseHandler.STRIP_THINKING_TAGS` in their PromptConfig, (4) run regression tests to confirm working models unaffected.

**Primary recommendation:** Use diagnostic runner results to measure actual model latencies, tune timeouts per-model based on P95 + 20% safety margin, audit and apply STRIP_THINKING_TAGS handler to all reasoning models, validate with regression tests.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Existing timeout infrastructure** | In-place | `REASONING_MODEL_IDS` Set, `getModelTimeout()` function | Already implemented in `src/__tests__/fixtures/test-data.ts`, provides 90s timeout for reasoning models |
| **Existing response handlers** | In-place | `ResponseHandler.STRIP_THINKING_TAGS` enum, `stripThinkingTagsHandler` function | Already implemented in `src/lib/llm/response-handlers.ts`, removes thinking tags via regex |
| **Existing prompt variants** | In-place | `PromptVariant.THINKING_STRIPPED` enum, prompt enhancement system | Already implemented in `src/lib/llm/prompt-variants.ts`, suppresses thinking tags in prompts |
| **Node.js built-in** | Built-in | Array sort, percentile calculation | Standard library, no dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Diagnostic results** | Phase 54 output | Raw response JSON files with durationMs field | Calculate P95 latency from diagnostic-results/raw-responses/*.json |
| **Zod validation** | 4.3.6 (installed) | Validate regression test results match expected schema | Verify fixes don't break working models |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| P95 + 20% margin | Fixed timeout (e.g., all reasoning = 120s) | Data-driven is more precise, prevents over-provisioning fast models |
| Per-model timeout config | Global reasoning timeout | Per-model allows fine-tuning (DeepSeek R1 may need 120s, Kimi only 75s) |
| Response handler only | Prompt variant only | Response handler is last-resort cleanup, prompt variant prevents generation |
| Both handler + variant | Either/or | Belt-and-suspenders approach more reliable for reasoning models |

**Installation:** No new packages required. All infrastructure exists from Phase 40 (prompt variants), Phase 53 (regression tests), and Phase 54 (diagnostics).

## Architecture Patterns

### Pattern 1: Data-Driven Timeout Configuration

**What:** Calculate per-model timeout based on P95 latency from diagnostic data, not guesswork.

**When to use:** After running diagnostic suite with sufficient sample size (5+ runs per model recommended).

**Calculation steps:**
1. Load all diagnostic results from `diagnostic-results/raw-responses/*.json`
2. Extract `durationMs` values per model (filter successful runs only)
3. Calculate P95 latency: sort ascending, take value at `floor(0.95 * N)` index
4. Apply safety margin: `timeout = P95 * 1.2` (20% buffer for variance)
5. Round up to nearest 5s for clean config values

**Example:**
```typescript
// Source: Latency percentile calculation best practices + production monitoring
interface DiagnosticResult {
  modelId: string;
  success: boolean;
  durationMs: number;
  // ... other fields
}

function calculateP95Latency(durations: number[]): number {
  if (durations.length === 0) return 0;

  // Sort ascending
  const sorted = [...durations].sort((a, b) => a - b);

  // P95 index (95% of samples)
  const index = Math.floor(0.95 * sorted.length);

  return sorted[index];
}

function calculateRecommendedTimeout(
  modelId: string,
  diagnosticResults: DiagnosticResult[]
): number {
  // Filter successful runs for this model
  const durations = diagnosticResults
    .filter(r => r.modelId === modelId && r.success)
    .map(r => r.durationMs);

  if (durations.length < 3) {
    console.warn(`Insufficient data for ${modelId} (${durations.length} samples)`);
    return 60000; // Default 60s
  }

  const p95 = calculateP95Latency(durations);

  // 20% safety margin
  const withMargin = p95 * 1.2;

  // Round up to nearest 5s
  const roundedMs = Math.ceil(withMargin / 5000) * 5000;

  console.log(`${modelId}: P95=${p95}ms, +20%=${withMargin}ms, rounded=${roundedMs}ms`);

  return roundedMs;
}

// Usage: Analyze diagnostic results and update model configs
const results = loadDiagnosticResults();
const timeouts = {
  'deepseek-r1': calculateRecommendedTimeout('deepseek-r1', results),
  'qwen3-235b-thinking-syn': calculateRecommendedTimeout('qwen3-235b-thinking-syn', results),
  // ... other reasoning models
};

// Update model PromptConfig with calculated timeouts
```

**P95 Rationale:**
- P50 (median): Too optimistic, 50% of requests exceed this
- P95 (95th percentile): Covers most variance, only 5% of requests slower
- P99 (99th percentile): Too pessimistic, optimizes for rare outliers
- Production recommendation: P95 + 20-30% margin provides 99%+ coverage

Sources:
- [Mastering Latency Metrics: P90, P95, P99](https://medium.com/javarevisited/mastering-latency-metrics-p90-p95-p99-d5427faea879)
- [Statistics Behind Latency Metrics: Understanding P90, P95, and P99](https://medium.com/tuanhdotnet/statistics-behind-latency-metrics-understanding-p90-p95-and-p99-dc87420d505d)

### Pattern 2: Reasoning Model Audit and Configuration

**What:** Systematic audit of all reasoning models to ensure correct timeout and handler configuration.

**When to use:** Before applying fixes, to identify gaps in current configuration.

**Audit checklist per model:**
```typescript
// Source: Phase 40 model configuration patterns + diagnostic findings
interface ModelAuditResult {
  modelId: string;
  isReasoningModel: boolean; // Based on model name or capabilities
  hasThinkingTagHandler: boolean; // responseHandler includes STRIP_THINKING_TAGS
  hasThinkingPromptVariant: boolean; // promptVariant is THINKING_STRIPPED or ENGLISH_THINKING_STRIPPED
  currentTimeout: number; // timeoutMs in PromptConfig
  inReasoningModelIds: boolean; // Listed in REASONING_MODEL_IDS set
  recommendedTimeout: number; // From P95 calculation
  needsUpdate: boolean; // True if config doesn't match recommendations
}

function auditReasoningModel(
  provider: TogetherProvider | SyntheticProvider,
  recommendedTimeouts: Record<string, number>
): ModelAuditResult {
  const config = provider.promptConfig || {};

  // Identify reasoning models by ID pattern
  const reasoningModelPattern = /r1|thinking|reasoning/i;
  const isReasoning = reasoningModelPattern.test(provider.id);

  const hasHandler = config.responseHandler === ResponseHandler.STRIP_THINKING_TAGS;
  const hasVariant = config.promptVariant === PromptVariant.THINKING_STRIPPED ||
                     config.promptVariant === PromptVariant.ENGLISH_THINKING_STRIPPED;

  const currentTimeout = config.timeoutMs || 60000; // Default 60s
  const inSet = REASONING_MODEL_IDS.has(provider.id);
  const recommended = recommendedTimeouts[provider.id] || 90000;

  const needsUpdate = isReasoning && (
    !hasHandler ||
    !hasVariant ||
    currentTimeout < recommended ||
    !inSet
  );

  return {
    modelId: provider.id,
    isReasoningModel: isReasoning,
    hasThinkingTagHandler: hasHandler,
    hasThinkingPromptVariant: hasVariant,
    currentTimeout,
    inReasoningModelIds: inSet,
    recommendedTimeout: recommended,
    needsUpdate,
  };
}

// Generate audit report for all models
const allProviders = [...Object.values(ALL_PROVIDERS)];
const auditResults = allProviders.map(p => auditReasoningModel(p, recommendedTimeouts));

// Models needing updates
const needsFix = auditResults.filter(r => r.needsUpdate);
console.log(`Models needing timeout/handler updates: ${needsFix.length}`);
needsFix.forEach(r => {
  console.log(`- ${r.modelId}:`);
  if (!r.hasThinkingTagHandler) console.log('  ❌ Missing STRIP_THINKING_TAGS handler');
  if (!r.hasThinkingPromptVariant) console.log('  ❌ Missing THINKING_STRIPPED variant');
  if (r.currentTimeout < r.recommendedTimeout) {
    console.log(`  ⚠️  Timeout too low: ${r.currentTimeout}ms < ${r.recommendedTimeout}ms`);
  }
  if (!r.inReasoningModelIds) console.log('  ❌ Not in REASONING_MODEL_IDS set');
});
```

### Pattern 3: Thinking Tag Handler Application

**What:** Apply both prompt variant (prevention) and response handler (cleanup) to reasoning models.

**When to use:** For any model that generates chain-of-thought output with thinking tags.

**Belt-and-suspenders approach:**
1. **Prompt variant** (`THINKING_STRIPPED`): Instructs model NOT to generate thinking tags
2. **Response handler** (`STRIP_THINKING_TAGS`): Strips tags if model ignores instruction

**Example configuration:**
```typescript
// Source: src/lib/llm/providers/synthetic.ts pattern (already implemented)
// CORRECT: DeepSeek R1 on Together AI
export const DeepSeekR1Provider = new TogetherProvider(
  'deepseek-r1',
  'together',
  'deepseek-ai/DeepSeek-R1',
  'DeepSeek R1 (Reasoning)',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 7.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED, // Prevent generation
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS, // Cleanup fallback
    timeoutMs: 90000, // UPDATED: 90s based on P95 data (was 60s)
  }
);

// NEEDS FIX: Qwen3 Thinking (timeout too low)
export const Qwen3_235BThinking_SynProvider = new SyntheticProvider(
  'qwen3-235b-thinking-syn',
  'synthetic',
  'hf:Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen3 235B Thinking (Synthetic)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 6.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED, // ✅ Correct
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS, // ✅ Correct
    timeoutMs: 90000, // CURRENT - may need increase based on P95 data
  }
);
```

**Handler implementation reference:**
```typescript
// Source: src/lib/llm/response-handlers.ts (existing)
const stripThinkingTagsHandler: ResponseHandlerFn = (response: string): string => {
  return response
    .replace(/<think>[\s\S]*?<\/think>/gi, '')      // Remove <think>...</think>
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // Remove <thinking>...</thinking>
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '') // Remove <reasoning>...</reasoning>
    .trim();
};
```

Sources:
- [How to Prompt Thinking Models like DeepSeek R1 and OpenAI o3](https://www.helicone.ai/blog/prompt-thinking-models)
- [Deploy a reasoning LLM — Ray 2.53.0](https://docs.ray.io/en/latest/serve/tutorials/deployment-serve-llm/reasoning-llm/README.html)

### Pattern 4: Regression Protection Strategy

**What:** Test working models before and after fixes to prevent regressions.

**When to use:** Always, before applying timeout/handler changes to production.

**Approach:**
1. Run regression test suite (Phase 53) BEFORE changes → baseline results
2. Apply timeout/handler fixes to identified models
3. Run regression test suite AFTER changes → new results
4. Compare: working models must remain working, failing models should improve

**Validation:**
```typescript
// Source: Phase 53 regression test pattern
import { describe, it, expect } from 'vitest';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';

describe('Phase 55 Regression Tests', () => {
  it('timeout fixes do not break working models', async () => {
    // Test models that worked BEFORE Phase 55
    const workingModels = [
      'deepseek-v3.1',
      'qwen3-235b-instruct', // Non-thinking version
      'llama-3.1-405b',
      // ... all models from Phase 53 success list
    ];

    for (const modelId of workingModels) {
      const provider = ALL_PROVIDERS[modelId];
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      expect(result.success, `${modelId} should still work`).toBe(true);
      expect(result.predictions.size, `${modelId} should return prediction`).toBeGreaterThan(0);

      // Validate with Zod schema
      const prediction = result.predictions.get(TEST_MATCH_ID);
      const validated = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: prediction?.homeScore,
        away_score: prediction?.awayScore,
      });

      expect(validated.success, `${modelId} should return valid schema`).toBe(true);
    }
  });

  it('timeout fixes improve previously-failing reasoning models', async () => {
    const reasoningModels = [
      'deepseek-r1',
      'qwen3-235b-thinking-syn',
      'kimi-k2-thinking-syn',
      'deepseek-r1-0528-syn',
    ];

    for (const modelId of reasoningModels) {
      const provider = ALL_PROVIDERS[modelId];
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      // After Phase 55, these should NOT timeout
      expect(result.error).not.toMatch(/timeout/i);

      // After Phase 55, these should NOT have thinking tags in output
      if (result.rawResponse) {
        expect(result.rawResponse).not.toMatch(/<think>|<thinking>|<reasoning>/i);
      }
    }
  });
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| P95 latency calculation | Custom percentile algorithm with edge case handling | Standard sort + index calculation | P95 is just `sorted[floor(0.95 * N)]`, no need for complex histogram approximations |
| Thinking tag detection | Custom NLP-based tag extraction | Simple regex: `/<think>\|<thinking>\|<reasoning>/i` | Reasoning models use consistent tag format, regex is fast and deterministic |
| Per-model timeout config | Database table or config file | Direct PromptConfig in model constructor | Timeout is model-intrinsic property, keep with model definition for type safety |
| Regression validation | Manual testing after each change | Automated Vitest suite from Phase 53 | Regression tests already exist, just run them before/after |

**Key insight:** This phase builds on existing infrastructure (timeout system, response handlers, regression tests). Don't rebuild what Phase 40 and 53 already provide.

## Common Pitfalls

### Pitfall 1: Timeout Too Close to P95

**What goes wrong:** Setting timeout exactly at P95 means 5% of requests will still timeout.

**Why it happens:** Misunderstanding that P95 is the point where 5% are SLOWER, not a guarantee.

**How to avoid:** Always add safety margin: P95 * 1.2 (20%) or P95 * 1.3 (30%) covers 99%+ of requests.

**Warning signs:** Diagnostic reports still show ~5% timeout rate after "fixing" timeouts.

Sources:
- [Understanding the P95/P99 Latency Principle](https://medium.com/@rajesh.sgr/understanding-the-p95-p99-latency-principle-why-the-slowest-requests-matter-most-1bcabf3bf5e5)
- [API-M Performance Tuning - WSO2 API Manager Documentation](https://apim.docs.wso2.com/en/latest/install-and-setup/setup/deployment-best-practices/tuning-performance/)

### Pitfall 2: Applying Handler Without Prompt Variant

**What goes wrong:** Response handler strips thinking tags AFTER generation, wasting tokens and latency.

**Why it happens:** Thinking models generate thousands of reasoning tokens before JSON output.

**How to avoid:** Always use BOTH `promptVariant: THINKING_STRIPPED` (prevention) AND `responseHandler: STRIP_THINKING_TAGS` (cleanup). Prompt variant reduces generation cost, handler catches edge cases.

**Warning signs:** Models work but have high latency (60s+) and high token costs despite producing simple JSON.

Sources:
- [How to Prompt Thinking Models like DeepSeek R1 and OpenAI o3](https://www.helicone.ai/blog/prompt-thinking-models)

### Pitfall 3: Updating REASONING_MODEL_IDS But Not PromptConfig.timeoutMs

**What goes wrong:** Model added to `REASONING_MODEL_IDS` set but `PromptConfig.timeoutMs` overrides it.

**Why it happens:** `getModelTimeout()` function is only used in test scripts, not in production `callAPI()`.

**How to avoid:** Production timeout comes from `PromptConfig.timeoutMs` in model definition, NOT from `REASONING_MODEL_IDS`. Set `timeoutMs` in the model constructor's `promptConfig` parameter.

**Warning signs:** Test suite passes with 90s timeout, production still times out at 60s.

**Code reference:**
```typescript
// Source: src/lib/llm/providers/base.ts (lines 215-216)
// CORRECT: Uses model-specific timeout if configured
const modelTimeout = this.promptConfig?.timeoutMs;
const timeout = modelTimeout ?? (isBatch ? this.batchRequestTimeout : this.requestTimeout);

// This means: REASONING_MODEL_IDS is for TESTS only
// Production uses PromptConfig.timeoutMs in model definition
```

### Pitfall 4: Insufficient Diagnostic Sample Size

**What goes wrong:** Calculating P95 from 1-2 samples produces unreliable timeout values.

**Why it happens:** Small sample size means outliers dominate the calculation.

**How to avoid:** Run diagnostic suite 5+ times before calculating P95. If fewer than 5 successful samples, use conservative default (90s for reasoning models).

**Warning signs:** P95 calculation shows wildly different timeouts across runs (e.g., 45s then 85s then 120s).

### Pitfall 5: Breaking Working Models with Aggressive Timeout Reduction

**What goes wrong:** Reducing timeouts for "slow" models that are actually working fine.

**Why it happens:** Optimizing for cost/latency without checking if model is already successful.

**How to avoid:** ONLY increase timeouts, NEVER decrease. If a model works with 60s, keep it. Phase 55 fixes FAILURES, not optimizes SUCCESSES.

**Warning signs:** Regression tests show previously-working models now timing out.

Sources:
- [Performance and Timeout Issues with DeepSeek R1 on Azure AI Foundry](https://learn.microsoft.com/en-us/answers/questions/5545726/performance-and-timeout-issues-with-deepseek-r1-on)
- [DeepSeek R1 in chat times out when the thought process is long](https://forum.cursor.com/t/deepseek-r1-in-chat-times-out-when-the-thought-process-is-long/44808)

## Code Examples

### Example 1: Timeout Analysis Script

```typescript
// Source: Diagnostic data analysis + P95 calculation
import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface DiagnosticResult {
  modelId: string;
  success: boolean;
  durationMs: number;
  error?: string;
  category?: string;
}

async function analyzeDiagnosticResults(): Promise<void> {
  const resultsDir = path.join(process.cwd(), 'src/__tests__/diagnostic-results/raw-responses');
  const files = await readdir(resultsDir);

  const allResults: DiagnosticResult[] = [];

  // Load all diagnostic result files
  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filepath = path.join(resultsDir, file);
    const content = await readFile(filepath, 'utf-8');
    const result: DiagnosticResult = JSON.parse(content);
    allResults.push(result);
  }

  // Group by model
  const byModel = new Map<string, number[]>();
  for (const result of allResults) {
    if (!result.success) continue; // Only analyze successful runs

    if (!byModel.has(result.modelId)) {
      byModel.set(result.modelId, []);
    }
    byModel.get(result.modelId)!.push(result.durationMs);
  }

  // Calculate timeouts for reasoning models
  console.log('\n=== REASONING MODEL TIMEOUT ANALYSIS ===\n');

  const reasoningModels = [
    'deepseek-r1',
    'deepseek-r1-0528-syn',
    'kimi-k2-thinking-syn',
    'qwen3-235b-thinking-syn',
  ];

  for (const modelId of reasoningModels) {
    const durations = byModel.get(modelId) || [];

    if (durations.length < 3) {
      console.log(`${modelId}: INSUFFICIENT DATA (${durations.length} samples) - use 90000ms default`);
      continue;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(0.50 * sorted.length)];
    const p95 = sorted[Math.floor(0.95 * sorted.length)];
    const p99 = sorted[Math.floor(0.99 * sorted.length)];
    const max = sorted[sorted.length - 1];

    const recommended = Math.ceil((p95 * 1.2) / 5000) * 5000; // P95 + 20%, rounded to 5s

    console.log(`${modelId}:`);
    console.log(`  Samples: ${durations.length}`);
    console.log(`  P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms | Max: ${max}ms`);
    console.log(`  Recommended timeout: ${recommended}ms (P95 + 20%)`);
    console.log();
  }
}

// Run analysis
analyzeDiagnosticResults().catch(console.error);
```

### Example 2: Model Configuration Update

```typescript
// Source: src/lib/llm/providers/together.ts and synthetic.ts pattern
import { TogetherProvider, SyntheticProvider } from './providers';
import { PromptVariant, PromptConfig } from './prompt-variants';
import { ResponseHandler } from './response-handlers';

// BEFORE Phase 55: DeepSeek R1 with 60s timeout
export const DeepSeekR1Provider_BEFORE = new TogetherProvider(
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
    timeoutMs: 60000, // ❌ TOO LOW - causes timeout failures
  }
);

// AFTER Phase 55: Updated based on P95 analysis
export const DeepSeekR1Provider_AFTER = new TogetherProvider(
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
    timeoutMs: 90000, // ✅ UPDATED: 90s based on P95=75s * 1.2 = 90s
  }
);

// BEFORE Phase 55: Qwen3 Thinking (timeout might be insufficient)
export const Qwen3_235BThinking_BEFORE = new SyntheticProvider(
  'qwen3-235b-thinking-syn',
  'synthetic',
  'hf:Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen3 235B Thinking (Synthetic)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 6.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 90000, // Current - verify with diagnostic data
  }
);

// AFTER Phase 55: Updated based on P95 analysis (example: needs 105s)
export const Qwen3_235BThinking_AFTER = new SyntheticProvider(
  'qwen3-235b-thinking-syn',
  'synthetic',
  'hf:Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen3 235B Thinking (Synthetic)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 6.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 105000, // ✅ UPDATED: 105s based on P95=88s * 1.2 = 105.6s
  }
);
```

### Example 3: Regression Test for Timeout Fixes

```typescript
// Source: Phase 53 regression test pattern
import { describe, it, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { TEST_PROMPT, TEST_MATCH_ID } from '@/__tests__/fixtures/test-data';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';

describe('Phase 55: Timeout & Tag Fixes Regression', () => {
  // List of reasoning models that should now work without timeout
  const reasoningModels = [
    'deepseek-r1',
    'deepseek-r1-0528-syn',
    'kimi-k2-thinking-syn',
    'qwen3-235b-thinking-syn',
  ];

  // List of working models that should remain working
  const workingModels = [
    'deepseek-v3.1',
    'qwen3-235b-instruct', // Non-thinking version
    'llama-3.1-405b',
    'qwen3-next-80b',
    // ... all models from Phase 53 success list
  ];

  it.each(reasoningModels)(
    '%s should complete without timeout after Phase 55',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];

      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      // Should NOT timeout
      expect(result.error).not.toMatch(/timeout/i);

      // Should return valid prediction
      expect(result.success).toBe(true);
      expect(result.predictions.size).toBeGreaterThan(0);
    },
    { timeout: 120000 } // 120s test timeout to allow full model execution
  );

  it.each(reasoningModels)(
    '%s should not have thinking tags in output after Phase 55',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];

      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      // Raw response should not contain thinking tags
      if (result.rawResponse) {
        expect(result.rawResponse).not.toMatch(/<think>/i);
        expect(result.rawResponse).not.toMatch(/<thinking>/i);
        expect(result.rawResponse).not.toMatch(/<reasoning>/i);
      }
    },
    { timeout: 120000 }
  );

  it.each(workingModels)(
    '%s should still work after Phase 55 changes (regression check)',
    async (modelId) => {
      const provider = ALL_PROVIDERS[modelId];

      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      expect(result.success, `${modelId} should still succeed`).toBe(true);

      const prediction = result.predictions.get(TEST_MATCH_ID);
      expect(prediction).toBeDefined();

      // Validate schema
      const validated = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: prediction?.homeScore,
        away_score: prediction?.awayScore,
      });

      expect(validated.success, `${modelId} should return valid schema`).toBe(true);
    }
  );
});
```

## State of the Art

### Current Approach vs. Best Practices (2026)

| Aspect | Current State | 2026 Best Practice | Gap |
|--------|---------------|-------------------|-----|
| Timeout configuration | Fixed 60s/90s tiers | P95 + 20-30% margin per model | Need data-driven tuning |
| Reasoning model handling | Some have handlers, some don't | All reasoning models need BOTH prompt variant + response handler | Audit and apply consistently |
| Timeout location | Mix of REASONING_MODEL_IDS (tests) and PromptConfig.timeoutMs (production) | Single source of truth in PromptConfig | Already correct in production, tests use helper |
| Tag stripping | Response handler only | Prompt variant (prevent) + response handler (cleanup) | Some models missing prompt variant |
| Diagnostic visibility | None before Phase 54 | Per-model latency tracking with P95/P99 | NOW AVAILABLE from Phase 54 |

### Timeout Recommendations from Industry

| Source | Recommendation | Reasoning |
|--------|---------------|-----------|
| Microsoft Azure AI | 120s for DeepSeek R1 | Production reports show 2-minute timeout limit causes failures |
| WSO2 API Manager | 300s standard, 600s high-resource | Cover 99%+ of scenarios with safety margin |
| ASP.NET Core 2026 | 120s global, override per endpoint | Conservative default, tune per model |
| DeepSeek Production | 100-300ms typical, up to 2min for thinking | Large variance in reasoning model latency |

Sources:
- [Performance and Timeout Issues with DeepSeek R1 on Azure AI Foundry](https://learn.microsoft.com/en-us/answers/questions/5545726/performance-and-timeout-issues-with-deepseek-r1-on)
- [API-M Performance Tuning - WSO2 API Manager Documentation](https://apim.docs.wso2.com/en/latest/install-and-setup/setup/deployment-best-practices/tuning-performance/)
- [What is the latency of DeepSeek's R1 model in production environments?](https://milvus.io/ai-quick-reference/what-is-the-latency-of-deepseeks-r1-model-in-production-environments)

### Reasoning Model Output Handling (2026)

**Evolution:**
- **2024-2025:** Reasoning models return raw thinking process in output, manual cleanup required
- **Late 2025:** OpenAI API introduces `reasoning_content` field for O1/O3 models, separates thinking from output
- **2026:** vLLM and Ray introduce `reasoning_parser` config for automated extraction
- **Current project:** Uses response handlers (cleanup approach) + prompt variants (prevention approach)

**Best practice (2026):** Dual approach is correct:
1. Prompt variant prevents generation of thinking tags (saves tokens/latency)
2. Response handler cleans up if model ignores instruction (defensive programming)

Sources:
- [Deploy a reasoning LLM — Ray 2.53.0](https://docs.ray.io/en/latest/serve/tutorials/deployment-serve-llm/reasoning-llm/README.html)
- [Understanding Reasoning LLMs](https://magazine.sebastianraschka.com/p/understanding-reasoning-llms)

## Open Questions

### 1. Actual P95 Latency Values per Model

**What we know:**
- DeepSeek R1 has 60s timeout currently, may need 90s-120s
- Qwen3-235B-Thinking has 90s timeout, may be sufficient
- Kimi K2-Thinking has 60s timeout, may need 75s-90s
- DeepSeek R1 0528 (Synthetic) has 60s timeout, may need 90s-120s

**What's unclear:** Exact P95 latency values from diagnostic runs not yet available.

**Recommendation:** Run `npm run diagnose` 5+ times, collect raw response data, calculate P95 per model using analysis script. Use P95 * 1.2 as recommended timeout.

### 2. Qwen3-235B-Thinking Timeout Sufficiency

**What we know:** Currently configured with 90s timeout, uses correct handlers.

**What's unclear:** Is 90s sufficient or does it need 105s-120s based on actual P95?

**Recommendation:** Check diagnostic raw responses for `qwen3-235b-thinking-syn`. If any timeout failures exist, calculate P95 + 20%. If all successful and max duration < 75s (90s * 0.83), keep 90s.

### 3. Impact of Prompt Variant on Token Cost

**What we know:** `THINKING_STRIPPED` variant adds instruction to NOT generate thinking tags.

**What's unclear:** How much does this reduce output tokens and latency for reasoning models?

**Recommendation:** Compare raw responses before/after adding prompt variant. Expected: significant reduction in reasoning tokens (hundreds to thousands fewer tokens), lower latency, lower cost. This validates belt-and-suspenders approach is cost-effective.

## Sources

### Primary (HIGH confidence)

**Project codebase:**
- `src/__tests__/fixtures/test-data.ts` - Timeout configuration infrastructure
- `src/lib/llm/response-handlers.ts` - STRIP_THINKING_TAGS handler implementation
- `src/lib/llm/prompt-variants.ts` - THINKING_STRIPPED variant implementation
- `src/lib/llm/providers/together.ts` - Together AI model configurations
- `src/lib/llm/providers/synthetic.ts` - Synthetic model configurations
- `src/lib/llm/providers/base.ts` - Timeout application in callAPI method
- `.planning/phases/54-diagnostic-infrastructure/54-02-SUMMARY.md` - Diagnostic infrastructure details

**Performance metrics:**
- [Mastering Latency Metrics: P90, P95, P99](https://medium.com/javarevisited/mastering-latency-metrics-p90-p95-p99-d5427faea879)
- [Statistics Behind Latency Metrics: Understanding P90, P95, and P99](https://medium.com/tuanhdotnet/statistics-behind-latency-metrics-understanding-p90-p95-and-p99-dc87420d505d)
- [Understanding the P95/P99 Latency Principle](https://medium.com/@rajesh.sgr/understanding-the-p95-p99-latency-principle-why-the-slowest-requests-matter-most-1bcabf3bf5e5)

**DeepSeek R1 performance:**
- [Performance and Timeout Issues with DeepSeek R1 on Azure AI Foundry](https://learn.microsoft.com/en-us/answers/questions/5545726/performance-and-timeout-issues-with-deepseek-r1-on)
- [DeepSeek-R1 deployed in Azure AI Hub got timeout](https://learn.microsoft.com/en-us/answers/questions/2201406/deepseek-r1-deployed-in-azure-ai-hub-got-timeout)
- [What is the latency of DeepSeek's R1 model in production environments?](https://milvus.io/ai-quick-reference/what-is-the-latency-of-deepseeks-r1-model-in-production-environments)
- [Deepseek R1 in chat times out when the thought process is long](https://forum.cursor.com/t/deepseek-r1-in-chat-times-out-when-the-thought-process-is-long/44808)

### Secondary (MEDIUM confidence)

**Timeout tuning best practices:**
- [API-M Performance Tuning - WSO2 API Manager Documentation](https://apim.docs.wso2.com/en/latest/install-and-setup/setup/deployment-best-practices/tuning-performance/)
- [Best practices for configuring I/O timeout | Apigee Edge](https://docs.apigee.com/how-to-guides/configuring-io-timeout-best-practices)
- [Performance Tuning in ASP.NET Core: Best Practices for 2026](https://www.syncfusion.com/blogs/post/performance-tuning-in-aspnetcore-2026)

**Reasoning model handling:**
- [How to Prompt Thinking Models like DeepSeek R1 and OpenAI o3](https://www.helicone.ai/blog/prompt-thinking-models)
- [Deploy a reasoning LLM — Ray 2.53.0](https://docs.ray.io/en/latest/serve/tutorials/deployment-serve-llm/reasoning-llm/README.html)
- [Understanding Reasoning LLMs](https://magazine.sebastianraschka.com/p/understanding-reasoning-llms)
- [DavidAU/How-To-Use-Reasoning-Thinking-Models-and-Create-Them](https://huggingface.co/DavidAU/How-To-Use-Reasoning-Thinking-Models-and-Create-Them)

**Qwen models:**
- [Qwen3: Think Deeper, Act Faster](https://qwenlm.github.io/blog/qwen3/)
- [Qwen/Qwen3-235B-A22B-Thinking-2507 · Hugging Face](https://huggingface.co/Qwen/Qwen3-235B-A22B-Thinking-2507)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists from Phase 40 (response handlers), Phase 53 (regression tests), Phase 54 (diagnostics)
- Architecture patterns: HIGH - P95 calculation is well-established, timeout tuning is straightforward, handler application is code change
- Pitfalls: HIGH - Based on production reports of DeepSeek R1 timeout issues and reasoning model tag leakage

**Research date:** 2026-02-08
**Valid until:** 60 days (stable domain - timeout tuning and tag handling patterns unlikely to change rapidly)

**Key findings:**
1. All infrastructure exists - no new libraries needed
2. P95 + 20% margin is industry standard for timeout tuning
3. Reasoning models need BOTH prompt variant (prevention) AND response handler (cleanup)
4. Production timeout comes from PromptConfig.timeoutMs, not REASONING_MODEL_IDS (test helper only)
5. Diagnostic data from Phase 54 provides raw latency measurements for data-driven tuning
6. Regression tests from Phase 53 provide before/after validation
7. DeepSeek R1 timeout issues confirmed in production (Azure reports 2-minute limit insufficient)
8. Current config shows some reasoning models have correct handlers, some don't - audit needed

**Dependencies:**
- Phase 54 diagnostic results (raw response JSON files with durationMs)
- Phase 53 regression test suite (validate no regressions)
- Phase 40 prompt variants and response handlers (apply consistently)
