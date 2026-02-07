# Phase 54: Diagnostic Infrastructure - Research

**Researched:** 2026-02-07
**Domain:** Systematic model testing, failure categorization, diagnostic reporting
**Confidence:** HIGH

## Summary

Phase 54 builds systematic diagnostics for the 42 LLM models to identify which models fail and why. The research identifies a test-runner pattern with golden fixtures (from Phase 53) as the standard approach, failure categorization taxonomy based on LLM evaluation research, and diagnostic report generation similar to code coverage tools.

The project already has strong foundations: validation scripts (`validate-all-models.ts`, `validate-synthetic-models.ts`) that test all 42 models with timeout detection, the Vitest test framework with golden fixtures from Phase 53, and comprehensive error classes (`APIError`, `RateLimitError`, `CircuitOpenError`). The gap is: (1) systematic failure categorization beyond simple pass/fail, (2) capturing raw LLM responses for debugging, and (3) generating actionable diagnostic reports with fix recommendations.

Research shows that LLM failures cluster into distinct categories: timeout (extended thinking models), parse errors (malformed JSON), language issues (Chinese text in GLM models), thinking-tag problems (reasoning models), API errors (rate limits, server errors), and empty responses (network failures). Each category has specific detection signatures and targeted fixes.

**Primary recommendation:** Build diagnostic test runner that extends existing validation scripts with failure categorization, raw response capture to filesystem, and diagnostic report generation with per-category fix recommendations.

## Standard Stack

The established libraries/tools for diagnostic testing and failure analysis:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Vitest** | 4.0.18 (installed) | Test runner with fixture support | Already configured, supports parallel test execution, excellent error reporting |
| **Zod** | 4.3.6 (installed) | Schema validation for categorizing parse failures | TypeScript-first, detailed error messages identify exact parse failure reasons |
| **Node.js fs/promises** | Built-in | Capture raw responses to file | Standard library, async/await support, no dependencies |
| **pino** | Installed | Structured logging for diagnostic runs | Already used via `loggers.llm`, structured logs enable post-run analysis |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **p-limit** | 6.2.0 (installed) | Concurrency control for diagnostic runs | Already used in `validate-all-models.ts`, prevents rate limit exhaustion |
| **tsx** | 4.21.0 (installed) | TypeScript execution for scripts | Run diagnostic scripts without compilation |
| **chalk** | - | Terminal colors for diagnostic output | Optional: improve readability of failure reports |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom runner | Vitest test suite | Custom script is simpler for one-time diagnostics, Vitest better for regression tracking |
| File capture | Database storage | Files easier to inspect manually, git-trackable for debugging history |
| Manual categorization | ML-based classification | Manual rules are deterministic and debuggable, sufficient for 6 known categories |

**Installation:** No new packages required. All core libraries already installed.

## Architecture Patterns

### Recommended Diagnostic Structure

```
scripts/
├── diagnostic/
│   ├── run-diagnostics.ts           # Main diagnostic runner
│   ├── categorize-failure.ts        # Failure categorization logic
│   └── generate-report.ts           # Report generation
src/__tests__/
├── fixtures/
│   └── golden/                      # Golden fixtures (from Phase 53)
│       └── diverse-scenarios.json   # NEW: Diverse match scenarios
└── diagnostic-results/              # NEW: Diagnostic output
    ├── raw-responses/
    │   ├── deepseek-r1.json         # Raw LLM response per model
    │   └── [model-id].json
    └── reports/
        └── diagnostic-YYYY-MM-DD.md # Daily diagnostic reports
```

### Pattern 1: Failure Categorization Taxonomy

**What:** Classify each model failure into one of 6 categories based on error signatures.

**When to use:** After every model test run to identify systematic issues vs one-off failures.

**Categories:**
1. **timeout** - Request exceeds model-specific timeout (30s/60s/90s)
2. **parse** - JSON parsing fails (malformed structure, invalid schema)
3. **language** - Non-English output (Chinese text in GLM models)
4. **thinking-tag** - Reasoning tags not properly stripped (<think>, <reasoning>)
5. **api-error** - API-level failures (429 rate limit, 5xx server errors, network errors)
6. **empty-response** - No content returned (empty string, null, undefined)

**Example:**
```typescript
// Source: LLM evaluation research + project patterns
export enum FailureCategory {
  TIMEOUT = 'timeout',
  PARSE = 'parse',
  LANGUAGE = 'language',
  THINKING_TAG = 'thinking-tag',
  API_ERROR = 'api-error',
  EMPTY_RESPONSE = 'empty-response',
}

export interface CategorizedFailure {
  modelId: string;
  category: FailureCategory;
  error: string;
  rawResponse?: string;
  fix?: string; // Recommended fix
}

export function categorizeFailure(
  modelId: string,
  error: string,
  rawResponse: string
): CategorizedFailure {
  // 1. Check for timeout
  if (error.includes('timeout') || error.includes('Timeout after')) {
    return {
      modelId,
      category: FailureCategory.TIMEOUT,
      error,
      fix: 'Increase model timeout in REASONING_MODEL_IDS or adjust LLM_BATCH_TIMEOUT_MS',
    };
  }

  // 2. Check for API errors
  if (error.includes('429') || error.includes('rate limit')) {
    return {
      modelId,
      category: FailureCategory.API_ERROR,
      error,
      fix: 'Reduce concurrency limit or implement exponential backoff',
    };
  }

  if (error.includes('5xx') || error.includes('API error') || error.includes('network')) {
    return {
      modelId,
      category: FailureCategory.API_ERROR,
      error,
      fix: 'Transient API failure - retry or check service status',
    };
  }

  // 3. Check for empty response
  if (!rawResponse || rawResponse.trim().length === 0) {
    return {
      modelId,
      category: FailureCategory.EMPTY_RESPONSE,
      error: error || 'No content returned from API',
      fix: 'Check API response extraction logic in callAPI() method',
    };
  }

  // 4. Check for language issues (Chinese text)
  if (/[\u3400-\u4DBF\u4E00-\u9FFF]/.test(rawResponse)) {
    return {
      modelId,
      category: FailureCategory.LANGUAGE,
      error: 'Response contains Chinese characters',
      rawResponse: rawResponse.slice(0, 300),
      fix: 'Add English-only instruction to prompt or switch response handler',
    };
  }

  // 5. Check for thinking tags
  if (/<think>|<thinking>|<reasoning>/i.test(rawResponse)) {
    return {
      modelId,
      category: FailureCategory.THINKING_TAG,
      error: 'Thinking tags present in parsed response',
      rawResponse: rawResponse.slice(0, 300),
      fix: 'Apply ResponseHandler.STRIP_THINKING_TAGS in model PromptConfig',
    };
  }

  // 6. Default to parse error
  return {
    modelId,
    category: FailureCategory.PARSE,
    error,
    rawResponse: rawResponse.slice(0, 300),
    fix: 'Inspect raw response, adjust JSON extraction regex in parsePredictionResponse()',
  };
}
```

### Pattern 2: Raw Response Capture for Debugging

**What:** Save raw LLM API responses to filesystem for manual inspection and regression analysis.

**When to use:** Every diagnostic run, both successful and failed responses, to build debugging history.

**Example:**
```typescript
// Source: File system best practices + golden test patterns
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface DiagnosticResult {
  modelId: string;
  success: boolean;
  prediction?: { homeScore: number; awayScore: number };
  error?: string;
  rawResponse: string;
  category?: FailureCategory;
  durationMs: number;
  timestamp: string;
}

export async function captureRawResponse(
  modelId: string,
  result: DiagnosticResult
): Promise<void> {
  const outputDir = path.join(
    process.cwd(),
    'src/__tests__/diagnostic-results/raw-responses'
  );

  // Ensure directory exists
  await mkdir(outputDir, { recursive: true });

  const filename = `${modelId}.json`;
  const filepath = path.join(outputDir, filename);

  // Save full diagnostic result as JSON
  await writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`Captured: ${filename} (${result.rawResponse.length} chars)`);
}

// Usage in diagnostic runner
const result = await testModel(provider);
await captureRawResponse(provider.id, result);
```

### Pattern 3: Diagnostic Report Generation

**What:** Generate markdown report with failure breakdown by category and per-model results.

**When to use:** After each diagnostic run to identify patterns and prioritize fixes.

**Example:**
```typescript
// Source: Test reporting patterns + diagnostic coverage research
export interface DiagnosticReport {
  timestamp: string;
  totalModels: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failuresByCategory: Record<FailureCategory, CategorizedFailure[]>;
  perModelResults: DiagnosticResult[];
}

export function generateDiagnosticReport(
  results: DiagnosticResult[]
): string {
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    totalModels: results.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    successRate: results.filter(r => r.success).length / results.length,
    failuresByCategory: groupByCategory(results.filter(r => !r.success)),
    perModelResults: results,
  };

  // Generate markdown report
  let md = `# Diagnostic Report - ${new Date().toLocaleDateString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Models:** ${report.totalModels}\n`;
  md += `- **Success Rate:** ${(report.successRate * 100).toFixed(1)}%\n`;
  md += `- **Passed:** ${report.successCount}\n`;
  md += `- **Failed:** ${report.failureCount}\n\n`;

  // Failure breakdown by category
  md += `## Failure Breakdown by Category\n\n`;
  for (const [category, failures] of Object.entries(report.failuresByCategory)) {
    if (failures.length === 0) continue;

    md += `### ${category} (${failures.length} models)\n\n`;

    // List affected models
    md += `**Affected models:** ${failures.map(f => f.modelId).join(', ')}\n\n`;

    // Recommended fix
    const fix = failures[0].fix || 'No automatic fix available';
    md += `**Recommended fix:** ${fix}\n\n`;

    // Sample errors
    md += `**Sample errors:**\n`;
    for (const failure of failures.slice(0, 3)) {
      md += `- \`${failure.modelId}\`: ${failure.error}\n`;
    }
    md += `\n`;
  }

  // Per-model results table
  md += `## Per-Model Results\n\n`;
  md += `| Model | Status | Duration | Category | Error |\n`;
  md += `|-------|--------|----------|----------|-------|\n`;

  for (const result of report.perModelResults) {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.durationMs}ms`;
    const category = result.category || '-';
    const error = result.error?.slice(0, 50) || '-';

    md += `| ${result.modelId} | ${status} | ${duration} | ${category} | ${error} |\n`;
  }

  return md;
}
```

### Pattern 4: Diverse Test Fixture Design

**What:** Create golden fixtures representing diverse match scenarios to test edge cases.

**When to use:** Before diagnostic runs to ensure comprehensive coverage of model capabilities.

**Scenarios to include:**
- **Standard prediction:** Mid-table teams, no clear favorite
- **High-scoring match:** Expected goals > 3
- **Low-scoring match:** Expected goals < 1
- **Upset scenario:** Away team ranked higher than home
- **Derby/rivalry:** Teams with historical draw patterns
- **Top vs bottom:** Clear favorite scenario

**Example:**
```typescript
// Source: Golden dataset design research + football domain knowledge
export const DIVERSE_SCENARIOS = {
  'standard': {
    match_id: 'scenario-01-standard',
    home_team: 'Everton',
    away_team: 'Crystal Palace',
    competition: 'Premier League',
    description: 'Mid-table clash, no clear favorite',
  },
  'high-scoring': {
    match_id: 'scenario-02-high-scoring',
    home_team: 'Bayern Munich',
    away_team: 'Bochum',
    competition: 'Bundesliga',
    description: 'Top team vs struggling defense, expected 4+ goals',
  },
  'low-scoring': {
    match_id: 'scenario-03-low-scoring',
    home_team: 'Atletico Madrid',
    away_team: 'Getafe',
    competition: 'La Liga',
    description: 'Defensive teams, expected 0-1 goals',
  },
  'upset-potential': {
    match_id: 'scenario-04-upset',
    home_team: 'Luton Town',
    away_team: 'Arsenal',
    competition: 'Premier League',
    description: 'Bottom vs top, away win likely',
  },
  'derby': {
    match_id: 'scenario-05-derby',
    home_team: 'Manchester United',
    away_team: 'Liverpool',
    competition: 'Premier League',
    description: 'High-stakes rivalry, draws common',
  },
};

export function buildTestPrompt(scenarioId: string): string {
  const scenario = DIVERSE_SCENARIOS[scenarioId];
  return `Provide a prediction for 1 test match.
Match ID: ${scenario.match_id}
Home Team: ${scenario.home_team}
Away Team: ${scenario.away_team}
Competition: ${scenario.competition}
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;
}
```

### Anti-Patterns to Avoid

- **Testing in production order:** Don't test models in same sequence they run in production (masks concurrency issues). Randomize test order.
- **Ignoring successful responses:** Don't only capture failures. Successful responses establish baseline for regression detection.
- **Generic error messages:** Don't report "test failed" without category. Always categorize for actionable fixes.
- **No raw response capture:** Don't rely on parsed error messages. Raw responses reveal root causes parsing can't detect.
- **One-size-fits-all timeouts:** Don't use same timeout for all models. Reasoning models need 90s, standard models 60s.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Failure classification | Manual if/else chains | Error class hierarchy + pattern matching | APIError, RateLimitError, CircuitOpenError already exist |
| Concurrency control | Custom queue | p-limit library | Already used in validate-all-models.ts, battle-tested |
| JSON schema validation | Custom validators | Zod PredictionOutputSchema | Already defined, provides detailed error messages |
| Test fixtures | Inline test data | Golden fixtures from Phase 53 | Reusable, git-trackable, regression-testable |
| Report formatting | String concatenation | Template literals with markdown | Readable, maintainable, GitHub-native format |

**Key insight:** The project already has 80% of needed infrastructure. Diagnostic runner is orchestration of existing components.

## Common Pitfalls

### Pitfall 1: Timeout Miscategorization

**What goes wrong:** Short timeouts cause reasoning models to fail, misdiagnosed as model bugs.

**Why it happens:** Deepseek R1, Kimi K2 Thinking, Qwen3 Thinking models have extended "thinking" phases that need 90s timeouts. Standard 60s timeout treats them as failures.

**How to avoid:** Use `REASONING_MODEL_IDS` set to identify models needing extended timeouts. `validate-all-models.ts` already implements this pattern correctly.

**Warning signs:** Model succeeds in manual testing but fails in diagnostics with timeout error.

### Pitfall 2: Rate Limit Cascade Failures

**What goes wrong:** Testing all 42 models concurrently exhausts API rate limits, causing false failures.

**Why it happens:** Together.ai and Synthetic.new APIs have rate limits (requests/minute). Parallel test execution hits limits quickly.

**How to avoid:** Use `p-limit` with `CONCURRENCY_LIMIT = 5` (already implemented in `validate-all-models.ts`). Monitor rate limit headers and implement exponential backoff.

**Warning signs:** First 5-10 models pass, then sudden cluster of 429 errors.

### Pitfall 3: Parse Error Masking Root Cause

**What goes wrong:** Categorize failure as "parse error" when root cause is thinking tags or language issues.

**Why it happens:** Categorization checks parse failure first without inspecting raw response.

**How to avoid:** Always check raw response content BEFORE classifying as parse error. Order matters: timeout → API error → empty response → language → thinking tags → parse.

**Warning signs:** Fix JSON parser but model still fails with new error.

### Pitfall 4: No Baseline for Comparison

**What goes wrong:** Can't tell if failure is new regression or existing issue.

**Why it happens:** No historical diagnostic results saved. Each run is isolated.

**How to avoid:** Save diagnostic reports to `diagnostic-results/reports/` directory with timestamps. Git-track reports to see trends over time.

**Warning signs:** "Did this model work before?" questions can't be answered.

### Pitfall 5: Ignoring Response Handler Configuration

**What goes wrong:** Model failure diagnosed as "thinking tags present" but model already configured with `STRIP_THINKING_TAGS` handler.

**Why it happens:** Diagnostic test bypasses model's `PromptConfig` and calls `callAPI()` directly.

**How to avoid:** Use model's `predictBatch()` method (not `callAPI()`) to ensure response handlers apply. Existing validation scripts already do this correctly.

**Warning signs:** Model works in production but fails in diagnostics with handler-related errors.

## Code Examples

Verified patterns from official sources and project codebase:

### Diagnostic Runner with Categorization

```typescript
// Source: validate-all-models.ts + failure categorization research
import pLimit from 'p-limit';
import { ALL_PROVIDERS } from '@/lib/llm';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import { categorizeFailure, captureRawResponse, generateDiagnosticReport } from './diagnostic';

const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

interface DiagnosticResult {
  modelId: string;
  success: boolean;
  prediction?: { homeScore: number; awayScore: number };
  error?: string;
  rawResponse: string;
  category?: FailureCategory;
  durationMs: number;
  timestamp: string;
}

async function runDiagnostic(provider: LLMProvider): Promise<DiagnosticResult> {
  const start = Date.now();
  const timeout = getModelTimeout(provider.id);

  try {
    // Test with standard scenario
    const result = await Promise.race([
      provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    // Validate with Zod
    const prediction = result.predictions.get(TEST_MATCH_ID);
    if (prediction) {
      const validation = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: prediction.homeScore,
        away_score: prediction.awayScore,
      });

      if (!validation.success) {
        const categorized = categorizeFailure(
          provider.id,
          `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`,
          result.rawResponse
        );

        return {
          modelId: provider.id,
          success: false,
          error: categorized.error,
          rawResponse: result.rawResponse,
          category: categorized.category,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      modelId: provider.id,
      success: result.success,
      prediction,
      error: result.error,
      rawResponse: result.rawResponse,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const categorized = categorizeFailure(provider.id, errorMessage, '');

    return {
      modelId: provider.id,
      success: false,
      error: categorized.error,
      rawResponse: '',
      category: categorized.category,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

async function main() {
  console.log(`\nRunning diagnostics on ${ALL_PROVIDERS.length} models...\n`);

  // Run with concurrency control
  const results = await Promise.all(
    ALL_PROVIDERS.map(p => limit(async () => {
      const result = await runDiagnostic(p);

      // Capture raw response
      await captureRawResponse(p.id, result);

      // Log progress
      const status = result.success ? 'PASS' : `FAIL (${result.category})`;
      console.log(`[${p.id}] ${status}`);

      return result;
    }))
  );

  // Generate and save report
  const reportMarkdown = generateDiagnosticReport(results);
  const reportPath = path.join(
    process.cwd(),
    'src/__tests__/diagnostic-results/reports',
    `diagnostic-${new Date().toISOString().split('T')[0]}.md`
  );

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, reportMarkdown, 'utf-8');

  console.log(`\nDiagnostic report saved: ${reportPath}`);

  // Print summary
  const successCount = results.filter(r => r.success).length;
  console.log(`\nSuccess rate: ${successCount}/${results.length} (${(successCount / results.length * 100).toFixed(1)}%)`);
}
```

### Failure Categorization with Fix Recommendations

```typescript
// Source: LLM evaluation research + project error patterns
export enum FailureCategory {
  TIMEOUT = 'timeout',
  PARSE = 'parse',
  LANGUAGE = 'language',
  THINKING_TAG = 'thinking-tag',
  API_ERROR = 'api-error',
  EMPTY_RESPONSE = 'empty-response',
}

const FIX_RECOMMENDATIONS: Record<FailureCategory, string> = {
  [FailureCategory.TIMEOUT]:
    'Add model to REASONING_MODEL_IDS set for 90s timeout, or increase LLM_BATCH_TIMEOUT_MS',
  [FailureCategory.PARSE]:
    'Inspect raw response, adjust JSON extraction regex in parsePredictionResponse()',
  [FailureCategory.LANGUAGE]:
    'Add English-only instruction to prompt variant or switch to different model',
  [FailureCategory.THINKING_TAG]:
    'Set responseHandler: ResponseHandler.STRIP_THINKING_TAGS in model PromptConfig',
  [FailureCategory.API_ERROR]:
    'Check API service status, reduce concurrency, or implement circuit breaker',
  [FailureCategory.EMPTY_RESPONSE]:
    'Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)',
};

export function categorizeFailure(
  modelId: string,
  error: string,
  rawResponse: string
): CategorizedFailure {
  let category: FailureCategory;

  // Decision tree: check in order of specificity
  if (error.includes('timeout') || error.includes('Timeout after')) {
    category = FailureCategory.TIMEOUT;
  } else if (error.includes('429') || error.includes('rate limit') ||
             error.includes('5xx') || error.includes('API error') ||
             error.includes('network')) {
    category = FailureCategory.API_ERROR;
  } else if (!rawResponse || rawResponse.trim().length === 0) {
    category = FailureCategory.EMPTY_RESPONSE;
  } else if (/[\u3400-\u4DBF\u4E00-\u9FFF]/.test(rawResponse)) {
    category = FailureCategory.LANGUAGE;
  } else if (/<think>|<thinking>|<reasoning>/i.test(rawResponse)) {
    category = FailureCategory.THINKING_TAG;
  } else {
    category = FailureCategory.PARSE;
  }

  return {
    modelId,
    category,
    error,
    rawResponse: rawResponse.slice(0, 300),
    fix: FIX_RECOMMENDATIONS[category],
  };
}
```

### Diagnostic Report Generation

```typescript
// Source: Test reporting patterns + markdown generation
export function generateDiagnosticReport(results: DiagnosticResult[]): string {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const successRate = successCount / results.length;

  // Group failures by category
  const failuresByCategory: Record<FailureCategory, CategorizedFailure[]> = {
    [FailureCategory.TIMEOUT]: [],
    [FailureCategory.PARSE]: [],
    [FailureCategory.LANGUAGE]: [],
    [FailureCategory.THINKING_TAG]: [],
    [FailureCategory.API_ERROR]: [],
    [FailureCategory.EMPTY_RESPONSE]: [],
  };

  for (const result of results.filter(r => !r.success && r.category)) {
    const categorized = {
      modelId: result.modelId,
      category: result.category!,
      error: result.error || 'Unknown error',
      rawResponse: result.rawResponse.slice(0, 300),
      fix: FIX_RECOMMENDATIONS[result.category!],
    };
    failuresByCategory[result.category!].push(categorized);
  }

  let md = `# Diagnostic Report - ${new Date().toLocaleDateString()}\n\n`;

  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Total Models:** ${results.length}\n`;
  md += `**Success Rate:** ${(successRate * 100).toFixed(1)}% (${successCount}/${results.length})\n\n`;

  // Executive summary
  md += `## Summary\n\n`;
  md += `- ✅ **Passed:** ${successCount} models\n`;
  md += `- ❌ **Failed:** ${failureCount} models\n\n`;

  if (failureCount > 0) {
    md += `**Failure distribution:**\n`;
    for (const [category, failures] of Object.entries(failuresByCategory)) {
      if (failures.length > 0) {
        md += `- ${category}: ${failures.length} models\n`;
      }
    }
    md += `\n`;
  }

  // Category-specific fixes
  if (failureCount > 0) {
    md += `## Failure Breakdown by Category\n\n`;

    for (const [category, failures] of Object.entries(failuresByCategory)) {
      if (failures.length === 0) continue;

      md += `### ${category.toUpperCase()} (${failures.length} models)\n\n`;
      md += `**Affected models:** ${failures.map(f => `\`${f.modelId}\``).join(', ')}\n\n`;
      md += `**Recommended fix:**\n`;
      md += `\`\`\`\n${failures[0].fix}\n\`\`\`\n\n`;

      md += `**Sample errors:**\n`;
      for (const failure of failures.slice(0, 3)) {
        md += `- \`${failure.modelId}\`: ${failure.error}\n`;
      }
      md += `\n`;
    }
  }

  // Per-model results
  md += `## Per-Model Results\n\n`;
  md += `| Model | Status | Duration | Category | Error |\n`;
  md += `|-------|--------|----------|----------|-------|\n`;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.durationMs}ms`;
    const category = result.category || '-';
    const error = result.error ? result.error.slice(0, 40) + '...' : '-';

    md += `| \`${result.modelId}\` | ${status} | ${duration} | ${category} | ${error} |\n`;
  }

  md += `\n---\n\n`;
  md += `**Raw responses saved to:** \`src/__tests__/diagnostic-results/raw-responses/\`\n`;

  return md;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual model testing | Automated diagnostic runner | 2024-2026 | Systematic failure detection replaces guesswork |
| Generic "test failed" errors | Categorized failures with fix recommendations | 2026 | Actionable diagnostics enable targeted fixes |
| Lost raw responses | File-based response capture | 2026 | Debugging history enables regression analysis |
| Pass/fail binary | Success rate per category | 2026 | Identify patterns (e.g., all timeouts vs all parse errors) |
| Validation scripts without reports | Diagnostic reports with trends | 2026 | Track improvements over time |

**Deprecated/outdated:**
- **Manual testing:** Clicking through 42 models to find failures
- **No failure history:** Can't compare today's failures to yesterday's
- **Binary metrics:** Only tracking "working" vs "broken" without understanding why
- **Inline error analysis:** Reading console logs instead of structured reports

## Current Project State

### Strengths

1. **Validation scripts exist:** `validate-all-models.ts` and `validate-synthetic-models.ts` test all 42 models
2. **Concurrency control:** `p-limit` with `CONCURRENCY_LIMIT = 5` prevents rate limit issues
3. **Model classification:** `REASONING_MODEL_IDS` identifies models needing extended timeouts
4. **Error classes:** `APIError`, `RateLimitError`, `CircuitOpenError` provide structured errors
5. **Response handlers:** `STRIP_THINKING_TAGS`, `EXTRACT_JSON` handle common issues
6. **Zod validation:** `PredictionOutputSchema` validates structure

### Gaps

1. **No failure categorization:** Scripts report pass/fail but don't classify error types
2. **No raw response capture:** Can't inspect actual LLM output for debugging
3. **No diagnostic reports:** Results printed to console, not saved for analysis
4. **No diverse fixtures:** Only tests one scenario (Man Utd vs Liverpool)
5. **No historical tracking:** Each run is isolated, can't detect regressions

## Implementation Strategy

### Phase 1: Golden Fixtures with Diverse Scenarios (DIAG-01)

- Create `src/__tests__/fixtures/golden/diverse-scenarios.json`
- Define 5-6 scenarios covering standard, high-scoring, low-scoring, upset, derby matches
- Update diagnostic runner to test each model against all scenarios
- Validates: Models handle different match contexts (not just mid-table clashes)

### Phase 2: Diagnostic Runner with Categorization (DIAG-02)

- Create `scripts/diagnostic/run-diagnostics.ts` based on `validate-all-models.ts`
- Implement `categorizeFailure()` function with 6-category taxonomy
- Add timeout detection, API error detection, language detection, thinking-tag detection
- Categorize parse errors as fallback category
- Validates: Each failure has category and fix recommendation

### Phase 3: Raw Response Capture (DIAG-04)

- Create `src/__tests__/diagnostic-results/raw-responses/` directory
- Implement `captureRawResponse()` to save each model's response as JSON
- Include timestamp, success status, error, category in saved file
- Validates: Can inspect actual LLM output for debugging

### Phase 4: Report Generation (DIAG-03)

- Implement `generateDiagnosticReport()` to create markdown report
- Group failures by category with affected models list
- Include per-category fix recommendations
- Calculate per-model success rate across all scenarios
- Save report to `src/__tests__/diagnostic-results/reports/`
- Validates: Actionable report shows what to fix first

## Open Questions

None. All requirements are clear and implementation path is well-defined. Existing validation scripts provide proven patterns to extend.

## Sources

### Primary (HIGH confidence)

- **Project Codebase:** `validate-all-models.ts`, `validate-synthetic-models.ts`, `api-client.ts`, `response-handlers.ts`
- **Zod Documentation:** Schema validation with `safeParse()` for error categorization
- **Node.js fs/promises:** [File system operations](https://nodejs.org/api/fs.html#promises-api)
- **Vitest Documentation:** Test fixtures and golden file patterns

### Secondary (MEDIUM confidence)

- [L4: Diagnosing Large-scale LLM Training Failures via Automated Log Analysis](https://arxiv.org/pdf/2503.20263) - Failure categorization taxonomy
- [A Field Guide to LLM Failure Modes](https://medium.com/@adnanmasood/a-field-guide-to-llm-failure-modes-5ffaeeb08e80) - Common LLM failure patterns
- [The best LLM evaluation tools of 2026](https://medium.com/online-inference/the-best-llm-evaluation-tools-of-2026-40fd9b654dce) - Evaluation frameworks and best practices
- [Golden Datasets for GenAI Testing](https://www.techment.com/blogs/golden-datasets-for-genai-testing/) - Diverse test scenario design
- [Software testing best practices for 2026](https://www.n-ix.com/software-testing-best-practices/) - Risk-focused testing approaches
- [What is a Golden Test Set?](https://www.sprinklr.com/help/articles/set-up-nlu-based-intents/what-is-a-golden-test-set/64804933723d925979db84e4) - Golden fixture methodology
- [How to Monitor API Dependencies in 2026](https://dev.to/shibley/how-to-monitor-api-dependencies-in-2026-complete-guide-41m0) - API debugging techniques

### Tertiary (LOW confidence)

- [Categorization of failures based on issue roots](https://reportportal.io/docs/features/CategorisationOfFailures/) - Automated categorization patterns
- [Effective Error Handling Strategies in Automated Tests](https://testrigor.com/blog/error-handling-strategies-in-automated-tests/) - Test error handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed (Vitest, Zod, fs/promises, pino)
- Architecture: HIGH - Patterns verified in existing validation scripts (`validate-all-models.ts`)
- Failure categorization: HIGH - Based on actual project error classes and LLM research
- Golden fixtures: MEDIUM - WebSearch-sourced test design patterns, verified with project context

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable tooling and patterns)
