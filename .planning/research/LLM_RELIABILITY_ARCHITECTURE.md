# Architecture Patterns: Per-Model LLM Reliability Fixes

**Domain:** Multi-model LLM prediction system with per-model diagnostic and fix infrastructure
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

This architecture integrates per-model diagnostic and fix infrastructure with your existing provider/prompt/handler system. The current architecture (Phase 40) provides model-specific prompt variants, response handlers, and timeouts. This milestone extends it with systematic diagnostics, targeted fixes by failure category, and comprehensive validation.

**Key insight:** Your existing infrastructure (4 prompt variants, 3 response handlers, multi-strategy JSON parser) handles most edge cases. The problem is coverage, not capability. You need diagnostics to identify which models fail and why, then systematic fixes mapped to failure categories.

**Architecture principle:** Diagnose all 42 models → Categorize failures → Apply targeted fixes in batches → Validate with test fixtures.

## Current Architecture (Phase 40 Baseline)

### Component Overview

```
src/lib/llm/
├── index.ts                     # Provider registry, 42 models, fallback mapping
├── prompt-variants.ts           # 4 variants (BASE, ENGLISH_ENFORCED, JSON_STRICT, THINKING_STRIPPED)
├── response-handlers.ts         # 3 handlers (DEFAULT, EXTRACT_JSON, STRIP_THINKING_TAGS)
├── prompt.ts                    # Multi-strategy JSON parser (4 strategies)
├── providers/
│   ├── base.ts                  # OpenAICompatibleProvider base class
│   ├── together.ts              # TogetherProvider (29 models)
│   └── synthetic.ts             # SyntheticProvider (13 models)
└── budget.ts                    # Cost tracking per prediction
```

### Data Flow (Current)

```
Match Scheduled (T-30m)
    ↓
predictions.worker.ts
    ↓
getActiveProviders() → Filters auto-disabled models
    ↓
For each provider:
    buildBatchPrompt(match, analysis, standings) → User prompt
    ↓
    provider.callAPIWithFallback(BATCH_SYSTEM_PROMPT, prompt)
        ↓
        callAPI():
            getEnhancedSystemPrompt(base, promptVariant) → Appends variant instructions
            ↓
            fetchWithRetry(endpoint, body, timeout) → HTTP call
            ↓
            RESPONSE_HANDLERS[handler](rawResponse) → Post-processing
            ↓
            Return cleaned response
        ↓
        (On error: getFallbackProvider() → Try Together equivalent)
    ↓
    parseBatchPredictionEnhanced(response, [matchId]) → 4-strategy parsing
    ↓
    Validation: validateScore(homeScore), validateScore(awayScore)
    ↓
    SUCCESS: createPredictionsBatch([prediction])
    FAILURE: recordModelFailure(modelId, error, errorType)
```

### Existing Configuration Points

**Per-Model Config (PromptConfig):**
```typescript
interface PromptConfig {
  promptVariant?: PromptVariant;    // Which prompt variant to use
  responseHandler?: ResponseHandler; // Which response handler to apply
  timeoutMs?: number;               // Request timeout (30s-90s)
}
```

**Example (DeepSeek R1):**
```typescript
new TogetherProvider(
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
```

### Error Classification

**ErrorType enum (retry-config.ts):**
- `TIMEOUT` - Request timeout (model took too long)
- `RATE_LIMIT` - 429 rate limit exceeded
- `PARSE_ERROR` - JSON parsing failed (invalid structure)
- `API_ERROR` - HTTP error (4xx/5xx)
- `NETWORK_ERROR` - Connection failures (ECONNREFUSED, ETIMEDOUT)
- `VALIDATION_ERROR` - Scores out of range (0-10)
- `UNKNOWN_ERROR` - Unclassified failures

**Model Health Tracking:**
- `recordModelSuccess(modelId)` - Decrements failure count
- `recordModelFailure(modelId, error, errorType)` - Increments failure count
- `getAutoDisabledModelIds()` - Returns Set of disabled model IDs
- Auto-disable threshold: 5+ consecutive model-specific failures

### Fallback Infrastructure

**Current Implementation (Phase 41):**
```typescript
// index.ts - Fallback mapping
MODEL_FALLBACKS = {
  'deepseek-r1-0528-syn': 'deepseek-r1',        // Synthetic → Together
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',   // Thinking → Instruct
  'kimi-k2.5-syn': 'kimi-k2-instruct',          // Non-thinking → Instruct
};

// base.ts - Fallback execution
async callAPIWithFallback(system, user): Promise<FallbackAPIResult> {
  try {
    const response = await this.callAPI(system, user);
    return { response, usedFallback: false };
  } catch (originalError) {
    const fallbackProvider = getFallbackProvider(this.id);
    if (!fallbackProvider) throw originalError;

    const fallbackResult = await fallbackProvider.callAPI(system, user);
    return { response: fallbackResult, usedFallback: true };
  }
}
```

## Extended Architecture: Per-Model Diagnostics

### New Components

```
src/lib/llm/
├── diagnostics/
│   ├── runner.ts                # Diagnostic test runner
│   ├── fixtures.ts              # Golden test fixtures (5 matches)
│   ├── validators.ts            # Validation functions
│   └── report.ts                # Diagnostic report generation
└── __tests__/
    └── diagnostics.test.ts      # Integration tests for diagnostics
```

### Golden Test Fixtures

**Purpose:** Consistent test data for diagnosing all 42 models

**Structure (fixtures.ts):**
```typescript
export interface DiagnosticFixture {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTime: string;
  expectedResult: 'H' | 'D' | 'A';  // Expected tendency
  notes: string;
}

export const DIAGNOSTIC_FIXTURES: DiagnosticFixture[] = [
  {
    matchId: 'diag-001',
    homeTeam: 'Manchester City',
    awayTeam: 'Sheffield United',
    competition: 'Premier League',
    kickoffTime: '2026-02-15T15:00:00Z',
    expectedResult: 'H',  // Clear favorite
    notes: 'Strong home favorite - tests basic JSON generation'
  },
  {
    matchId: 'diag-002',
    homeTeam: 'Everton',
    awayTeam: 'Liverpool',
    competition: 'Premier League',
    kickoffTime: '2026-02-15T17:30:00Z',
    expectedResult: 'A',  // Derby match
    notes: 'Derby match - tests handling of high-pressure scenarios'
  },
  {
    matchId: 'diag-003',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    competition: 'La Liga',
    kickoffTime: '2026-02-16T20:00:00Z',
    expectedResult: 'D',  // Likely draw
    notes: 'El Clásico - tests draw predictions'
  },
  {
    matchId: 'diag-004',
    homeTeam: 'Bayern München',
    awayTeam: 'Borussia Dortmund',
    competition: 'Bundesliga',
    kickoffTime: '2026-02-17T18:30:00Z',
    expectedResult: 'H',  // Home advantage
    notes: 'Der Klassiker - tests non-English team names with special characters'
  },
  {
    matchId: 'diag-005',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Olympique Marseille',
    competition: 'Ligue 1',
    kickoffTime: '2026-02-18T21:00:00Z',
    expectedResult: 'H',  // Home favorite
    notes: 'Le Classique - tests handling of French team names with hyphens'
  }
];
```

**Rationale:**
- 5 fixtures covers common scenarios without excessive test time
- Includes: clear favorite (H), upset (A), draw (D), special characters, hyphens
- Expected result guides validation but doesn't enforce exact scores
- Fixtures are synthetic (no real analysis data needed)

### Diagnostic Runner

**Purpose:** Run all 42 models against test fixtures, categorize failures

**Core Function (runner.ts):**
```typescript
export interface DiagnosticResult {
  modelId: string;
  totalTests: number;
  passed: number;
  failed: number;
  failures: FailureCategory[];
}

export enum FailureCategory {
  TIMEOUT = 'timeout',
  PARSE_ERROR = 'parse_error',
  INVALID_JSON = 'invalid_json',
  THINKING_TAGS = 'thinking_tags',
  MARKDOWN_WRAPPED = 'markdown_wrapped',
  NON_ENGLISH = 'non_english',
  SCORE_OUT_OF_RANGE = 'score_out_of_range',
  EMPTY_RESPONSE = 'empty_response',
  RATE_LIMIT = 'rate_limit',
}

export async function runDiagnostics(
  models: LLMProvider[],
  fixtures: DiagnosticFixture[]
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  for (const model of models) {
    const result: DiagnosticResult = {
      modelId: model.id,
      totalTests: fixtures.length,
      passed: 0,
      failed: 0,
      failures: [],
    };

    for (const fixture of fixtures) {
      try {
        const prompt = buildSingleMatchPrompt(fixture);
        const response = await model.callAPI(BATCH_SYSTEM_PROMPT, prompt);

        const parsed = parseBatchPredictionResponse(response, [fixture.matchId]);

        if (parsed.success && parsed.predictions.length === 1) {
          const prediction = parsed.predictions[0];
          if (isValidScorePair(prediction)) {
            result.passed++;
          } else {
            result.failed++;
            result.failures.push(FailureCategory.SCORE_OUT_OF_RANGE);
          }
        } else {
          result.failed++;
          result.failures.push(categorizeFailure(response, parsed.error));
        }
      } catch (error) {
        result.failed++;
        result.failures.push(categorizeError(error));
      }
    }

    results.push(result);
  }

  return results;
}
```

**Failure Categorization Logic:**
```typescript
function categorizeFailure(response: string, error?: string): FailureCategory {
  // Timeout detection
  if (!response || error?.includes('timeout')) {
    return FailureCategory.TIMEOUT;
  }

  // Empty response
  if (response.trim() === '') {
    return FailureCategory.EMPTY_RESPONSE;
  }

  // Thinking tags present
  if (/<think>|<thinking>|<reasoning>/i.test(response)) {
    return FailureCategory.THINKING_TAGS;
  }

  // Markdown code blocks
  if (/```json|```/i.test(response)) {
    return FailureCategory.MARKDOWN_WRAPPED;
  }

  // Non-English characters (Chinese, etc.)
  if (/[\u4e00-\u9fa5]/.test(response)) {
    return FailureCategory.NON_ENGLISH;
  }

  // JSON structure invalid
  try {
    JSON.parse(response);
    return FailureCategory.INVALID_JSON; // Valid JSON but wrong structure
  } catch {
    return FailureCategory.PARSE_ERROR; // Not valid JSON
  }
}

function categorizeError(error: unknown): FailureCategory {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('timeout') || msg.includes('AbortError')) {
    return FailureCategory.TIMEOUT;
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return FailureCategory.RATE_LIMIT;
  }
  return FailureCategory.PARSE_ERROR;
}
```

### Diagnostic Report Generation

**Purpose:** Human-readable report for identifying which models need which fixes

**Report Structure (report.ts):**
```typescript
export interface DiagnosticReport {
  timestamp: string;
  totalModels: number;
  passingModels: number;
  failingModels: number;
  categorizedFailures: Map<FailureCategory, string[]>; // Category -> Model IDs
  recommendations: Recommendation[];
}

export interface Recommendation {
  modelId: string;
  currentConfig: PromptConfig;
  suggestedFixes: Fix[];
  priority: 'high' | 'medium' | 'low';
}

export interface Fix {
  type: 'prompt_variant' | 'response_handler' | 'timeout';
  value: string | number;
  reason: string;
}

export function generateReport(results: DiagnosticResult[]): DiagnosticReport {
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    totalModels: results.length,
    passingModels: results.filter(r => r.failed === 0).length,
    failingModels: results.filter(r => r.failed > 0).length,
    categorizedFailures: new Map(),
    recommendations: [],
  };

  // Group models by failure category
  for (const result of results) {
    for (const failure of result.failures) {
      if (!report.categorizedFailures.has(failure)) {
        report.categorizedFailures.set(failure, []);
      }
      report.categorizedFailures.get(failure)!.push(result.modelId);
    }
  }

  // Generate recommendations
  for (const result of results) {
    if (result.failed > 0) {
      report.recommendations.push(generateRecommendation(result));
    }
  }

  return report;
}

function generateRecommendation(result: DiagnosticResult): Recommendation {
  const fixes: Fix[] = [];
  let priority: 'high' | 'medium' | 'low' = 'medium';

  // High priority: Model fails all tests
  if (result.failed === result.totalTests) {
    priority = 'high';
  }

  // Categorize fixes based on failure patterns
  if (result.failures.includes(FailureCategory.TIMEOUT)) {
    fixes.push({
      type: 'timeout',
      value: 60000, // Increase to 60s
      reason: 'Model times out - needs longer timeout'
    });
  }

  if (result.failures.includes(FailureCategory.THINKING_TAGS)) {
    fixes.push({
      type: 'prompt_variant',
      value: 'THINKING_STRIPPED',
      reason: 'Model outputs thinking tags - needs stripped variant'
    });
    fixes.push({
      type: 'response_handler',
      value: 'STRIP_THINKING_TAGS',
      reason: 'Model outputs thinking tags - needs stripping handler'
    });
  }

  if (result.failures.includes(FailureCategory.NON_ENGLISH)) {
    fixes.push({
      type: 'prompt_variant',
      value: 'ENGLISH_ENFORCED',
      reason: 'Model outputs Chinese - needs English enforcement'
    });
  }

  if (result.failures.includes(FailureCategory.MARKDOWN_WRAPPED)) {
    fixes.push({
      type: 'response_handler',
      value: 'EXTRACT_JSON',
      reason: 'Model wraps JSON in markdown - needs extraction handler'
    });
  }

  return {
    modelId: result.modelId,
    currentConfig: {}, // Would fetch from provider
    suggestedFixes: fixes,
    priority,
  };
}
```

## Integration Points with Existing Components

### 1. Provider Configuration Extension

**Current:** Models have `PromptConfig` with 3 fields
**Extension:** No changes needed - existing fields sufficient

**Why:** Diagnostics identify which variants/handlers to use, not new config types.

### 2. Multi-Strategy Parser Enhancement

**Current:** `parseBatchPredictionEnhanced()` tries 4 strategies
**Extension:** Add logging for which strategy succeeded per model

**Implementation:**
```typescript
// prompt.ts - Add strategy tracking
export interface EnhancedParseResult {
  success: boolean;
  predictions?: Array<{ matchId: string; homeScore: number; awayScore: number }>;
  error?: string;
  strategyUsed?: string; // NEW: Track which strategy worked
}

// In parseBatchPredictionEnhanced()
if (result && result.length > 0) {
  logger.info({
    strategy: strategies[i].name, // "Direct JSON", "Markdown code block", etc.
    totalFound: result.length,
  }, 'Strategy succeeded');

  return {
    success: true,
    predictions: validPredictions,
    strategyUsed: strategies[i].name, // NEW
  };
}
```

**Why:** Helps diagnose which models need which response handlers.

### 3. Error Classification Refinement

**Current:** `classifyErrorType()` returns `ErrorType` enum
**Extension:** Map `ErrorType` to `FailureCategory` for diagnostics

**Implementation:**
```typescript
// diagnostics/validators.ts
export function mapErrorTypeToCategory(errorType: ErrorType): FailureCategory {
  switch (errorType) {
    case ErrorType.TIMEOUT:
      return FailureCategory.TIMEOUT;
    case ErrorType.RATE_LIMIT:
      return FailureCategory.RATE_LIMIT;
    case ErrorType.PARSE_ERROR:
      return FailureCategory.PARSE_ERROR;
    case ErrorType.VALIDATION_ERROR:
      return FailureCategory.SCORE_OUT_OF_RANGE;
    default:
      return FailureCategory.PARSE_ERROR;
  }
}
```

**Why:** Reuses existing error classification logic, adds diagnostic layer on top.

### 4. Fallback Mapping Expansion

**Current:** 3 fallback mappings (Synthetic → Together)
**Extension:** Identify additional fallback candidates from diagnostics

**Process:**
1. Diagnostic report shows models with similar failure patterns
2. If Synthetic model fails but Together equivalent passes, add fallback
3. Prioritize models with highest usage (avoid expanding for rarely-used models)

**Example:**
```typescript
// If diagnostics show:
// - 'deepseek-v3.2-syn' fails with PARSE_ERROR
// - 'deepseek-v3.1' (Together) passes
// Add fallback:
MODEL_FALLBACKS['deepseek-v3.2-syn'] = 'deepseek-v3.1';
```

**Why:** Data-driven expansion based on actual failure patterns, not guesswork.

## Suggested Build Order

### Phase 1: Diagnostic Infrastructure

**Goal:** Run diagnostics on all 42 models, generate failure report

**Tasks:**
1. Create `diagnostics/fixtures.ts` with 5 golden fixtures
2. Create `diagnostics/runner.ts` with `runDiagnostics()` function
3. Create `diagnostics/report.ts` with report generation
4. Create `diagnostics/validators.ts` with categorization logic
5. Run diagnostics, save report to `.planning/diagnostics/REPORT-[date].md`

**Success Criteria:**
- Report shows X passing models, Y failing models
- Failures grouped by category (timeout, parse, thinking tags, etc.)
- Recommendations list specific fixes per model

**Why First:** Cannot fix without knowing what's broken. Diagnostics provide roadmap.

### Phase 2: Fix by Category - Timeouts

**Goal:** Increase timeout for models that consistently timeout

**Tasks:**
1. Identify models with `FailureCategory.TIMEOUT` from report
2. Update `timeoutMs` in provider config (30s → 60s or 90s)
3. Re-run diagnostics for timeout models only (faster iteration)
4. Validate timeout fixes eliminated timeouts

**Success Criteria:**
- Models with timeout fixes pass diagnostic re-run
- No regression in previously-passing models

**Why Second:** Timeouts are fastest to fix (config change only), high impact.

### Phase 3: Fix by Category - Thinking Tags

**Goal:** Strip thinking tags from reasoning models

**Tasks:**
1. Identify models with `FailureCategory.THINKING_TAGS` from report
2. Update `promptVariant` to `THINKING_STRIPPED`
3. Update `responseHandler` to `STRIP_THINKING_TAGS`
4. Re-run diagnostics for thinking-tag models only
5. Validate fixes eliminated thinking tags

**Success Criteria:**
- Models with thinking-tag fixes pass diagnostic re-run
- No thinking tags in raw responses

**Why Third:** Thinking tags break JSON parsing - high priority after timeouts.

### Phase 4: Fix by Category - Language Enforcement

**Goal:** Force English output for models returning Chinese

**Tasks:**
1. Identify models with `FailureCategory.NON_ENGLISH` from report
2. Update `promptVariant` to `ENGLISH_ENFORCED`
3. Re-run diagnostics for language models only
4. Validate fixes eliminated non-English responses

**Success Criteria:**
- Models with language fixes pass diagnostic re-run
- All responses in English (no Chinese characters)

**Why Fourth:** Language enforcement is prompt-only, no handler needed.

### Phase 5: Fix by Category - JSON Extraction

**Goal:** Extract JSON from models wrapping in markdown or explanations

**Tasks:**
1. Identify models with `FailureCategory.MARKDOWN_WRAPPED` from report
2. Update `responseHandler` to `EXTRACT_JSON`
3. Optionally update `promptVariant` to `JSON_STRICT` for prevention
4. Re-run diagnostics for extraction models only
5. Validate fixes eliminated markdown wrapping

**Success Criteria:**
- Models with extraction fixes pass diagnostic re-run
- No markdown blocks in parsed predictions

**Why Fifth:** Extraction is defensive - JSON_STRICT prompt should prevent most cases.

### Phase 6: Fallback Mapping Expansion

**Goal:** Add fallbacks for Synthetic models that still fail after fixes

**Tasks:**
1. Identify models that failed all fixes (Phase 2-5)
2. Check if Together equivalent passes diagnostics
3. Add fallback mapping if equivalent exists
4. Re-run diagnostics with fallback enabled
5. Validate fallback catches remaining failures

**Success Criteria:**
- Fallback models pass diagnostics
- `usedFallback=true` tracked in predictions table

**Why Sixth:** Fallbacks are last resort - only for models that can't be fixed.

### Phase 7: Comprehensive Validation

**Goal:** Final validation of all 42 models with full diagnostic run

**Tasks:**
1. Re-run diagnostics on all 42 models (fresh run)
2. Generate final report with before/after comparison
3. Document remaining failures with severity assessment
4. Create monitoring dashboard for ongoing coverage tracking

**Success Criteria:**
- 95%+ models pass diagnostics (40/42)
- Remaining failures documented with mitigation plan
- Coverage tracking integrated into admin dashboard

**Why Last:** Comprehensive validation ensures no regressions, sets baseline for monitoring.

## Recommended Prompt Variant Strategy

### Current Variants (4)

1. `BASE` - No additional instructions
2. `ENGLISH_ENFORCED` - "Respond ONLY in English"
3. `JSON_STRICT` - "Return ONLY valid JSON, no explanations"
4. `THINKING_STRIPPED` - "Do NOT use thinking tags"

### Should We Add More?

**Analysis from research:**

> "Prompt engineering didn't become 'writing longer prompts' in 2026. It became writing clearer specs."

> "For newer reasoning models, few-shot prompting consistently degrades DeepSeek-R1's performance."

**Recommendation:** No additional variants needed.

**Rationale:**
1. 4 variants cover failure modes identified so far
2. Few-shot examples degrade reasoning model performance
3. Combo variants can be created on-demand (e.g., `ENGLISH_THINKING_STRIPPED`)
4. Multi-strategy parser handles format variations

**When to add new variant:**
- Diagnostics reveal new failure mode not covered by existing variants
- Multiple models fail with same pattern
- Prompt change is more reliable than response handler

## Per-Model Fix Configuration Matrix

### Current Status (Phase 40 Baseline)

| Model | Prompt Variant | Response Handler | Timeout | Status |
|-------|---------------|------------------|---------|--------|
| DeepSeek R1 (Together) | THINKING_STRIPPED | STRIP_THINKING_TAGS | 60s | Configured |
| DeepSeek R1 0528 (Syn) | THINKING_STRIPPED | STRIP_THINKING_TAGS | 60s | Configured |
| Kimi K2 Thinking (Syn) | THINKING_STRIPPED | STRIP_THINKING_TAGS | 60s | Configured |
| Qwen3 235B Thinking (Syn) | THINKING_STRIPPED | STRIP_THINKING_TAGS | 90s | Configured |
| DeepSeek V3.2 (Syn) | JSON_STRICT | EXTRACT_JSON | 45s | Configured |
| Kimi K2.5 (Syn) | BASE | DEFAULT | 60s | Configured |
| GLM 4.6 (Syn) | ENGLISH_ENFORCED | DEFAULT | 60s | Configured |
| GLM 4.7 (Syn) | ENGLISH_ENFORCED | EXTRACT_JSON | 60s | Configured |
| GPT-OSS 120B (Syn) | JSON_STRICT | EXTRACT_JSON | 45s | Configured |
| **All Other Models (33)** | **BASE** | **DEFAULT** | **30s** | **Needs Diagnosis** |

### Diagnostic Goals

**After Phase 1 (Diagnostics):**
- Know which of the 33 unconfigured models pass/fail
- Know failure categories for each failing model
- Have data-driven recommendations for fixes

**After Phase 2-6 (Fixes):**
- All 42 models have appropriate `PromptConfig`
- Failing models have documented fallbacks or mitigation strategies
- Coverage tracking shows 95%+ models producing valid JSON

## Sources

### High Confidence (Existing Codebase)
- `src/lib/llm/providers/base.ts` - Provider architecture, `callAPIWithFallback()`
- `src/lib/llm/prompt-variants.ts` - Existing 4 prompt variants
- `src/lib/llm/response-handlers.ts` - Existing 3 response handlers
- `src/lib/llm/prompt.ts` - Multi-strategy JSON parser (4 strategies)
- `src/lib/queue/workers/predictions.worker.ts` - Production prediction flow
- `.planning/phases/40-model-specific-prompt-selection/40-RESEARCH.md` - Phase 40 architecture

### High Confidence (Web Search - LLM Testing)
- [LLM Testing in 2026: Top Methods and Strategies](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies)
- [Golden Datasets for GenAI Testing](https://www.techment.com/blogs/golden-datasets-for-genai-testing/)
- [Testing for LLM Applications: A Practical Guide](https://langfuse.com/blog/2025-10-21-testing-llm-applications)

### High Confidence (Web Search - JSON Parsing)
- [How To Ensure LLM Output Adheres to a JSON Schema](https://modelmetry.com/blog/how-to-ensure-llm-output-adheres-to-a-json-schema)
- [LLM Output Parsing and Structured Generation Guide](https://tetrate.io/learn/ai/llm-output-parsing-structured-generation)
- [Handling LLM Output Parsing Errors](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/handling-parsing-errors)

### High Confidence (Web Search - Prompt Engineering)
- [Prompt Engineering Best Practices (2026)](https://promptbuilder.cc/blog/prompt-engineering-best-practices-2026)
- [Few-Shot Prompting Guide](https://www.promptingguide.ai/techniques/fewshot)
- [The Ultimate Guide to Prompt Engineering in 2026](https://www.lakera.ai/blog/prompt-engineering-guide)

---

**Metadata:**
- **Research date:** 2026-02-07
- **Valid until:** ~30 days (2026-03-07) - Architecture patterns stable, but model APIs evolve
- **Confidence breakdown:**
  - Integration points: HIGH (based on existing code)
  - Diagnostic infrastructure: HIGH (standard testing patterns)
  - Build order: MEDIUM-HIGH (logical sequence, may need adjustment based on findings)
  - Cost/timeline: MEDIUM (estimates based on similar projects)
