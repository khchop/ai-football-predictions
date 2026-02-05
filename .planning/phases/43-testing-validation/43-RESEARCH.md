# Phase 43: Testing & Validation - Research

**Researched:** 2026-02-05
**Domain:** Integration testing, LLM API validation, gradual rollout
**Confidence:** MEDIUM

## Summary

Phase 43 requires comprehensive integration testing for 36+ LLM models with JSON validation, monitoring fallback rates, and safe rollout of previously disabled models. The codebase already has a validation script (`validate-synthetic-models.ts`) that provides a foundation, but lacks a proper test framework and systematic validation across all models (Together AI + Synthetic).

Key challenges:
1. Testing 42 models (29 Together + 13 Synthetic) with external API dependencies
2. Validating non-deterministic LLM outputs (scores vary, but JSON structure must be consistent)
3. Monitoring production fallback rates without overloading APIs
4. Gradually re-enabling 6 disabled models with confidence

The standard approach is using Vitest for integration tests with conditional API mocking (mock in CI, real in validation runs), Zod schema validation for JSON output structure, and canary-style gradual rollout with monitoring dashboards.

**Primary recommendation:** Build Vitest-based integration test suite that validates JSON schema for all 42 models, leverage existing `validate-synthetic-models.ts` patterns, add fallback rate monitoring to existing admin dashboard, and implement phased rollout strategy (test → 1 model → batch of 6).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 1.x (latest) | Test framework | Next-gen testing framework, 10-20x faster than Jest, native ESM support, Vite integration |
| Zod | 4.3.6 | Schema validation | Already in project (package.json), TypeScript-first, runtime validation, LLM response validation |
| Supertest | 7.x (latest) | API testing | HTTP assertions for integration tests, express/Next.js compatibility |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MSW (Mock Service Worker) | 2.x | API mocking | Mock external APIs in CI, deterministic tests |
| dotenv | 17.2.3 | Environment config | Already in project, test environment setup |
| tsx | 4.21.0 | TypeScript execution | Already in project, run validation scripts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest is legacy, slower (important for 42 model tests), worse ESM support |
| Zod | JSON Schema + ajv | Zod already in project, better TypeScript integration |
| MSW | Nock | MSW supports both browser + Node.js, modern API |

**Installation:**
```bash
npm install --save-dev vitest @vitest/ui supertest msw
npm install --save-dev @types/supertest
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── __tests__/
│   ├── integration/
│   │   ├── models/
│   │   │   ├── together.test.ts       # Together AI models (29)
│   │   │   ├── synthetic.test.ts      # Synthetic models (13)
│   │   │   └── fallback.test.ts       # Fallback chain tests
│   │   ├── validation/
│   │   │   ├── json-schema.test.ts    # JSON-04 requirement
│   │   │   └── response-format.test.ts
│   │   └── setup/
│   │       ├── test-helpers.ts
│   │       └── mock-handlers.ts
│   └── fixtures/
│       ├── match-data.ts              # Test match data
│       └── expected-schemas.ts        # Zod schemas
vitest.config.ts                       # Vitest configuration
scripts/
├── validate-synthetic-models.ts       # Existing (reference)
└── validate-all-models.ts             # New comprehensive script
```

### Pattern 1: Conditional API Mocking
**What:** Use real APIs in validation runs, mocks in CI
**When to use:** Testing external LLM APIs with rate limits and costs
**Example:**
```typescript
// Source: Adapted from MSW documentation + Node.js testing best practices
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const USE_REAL_API = process.env.TEST_MODE === 'validation';

const mockHandlers = [
  http.post('https://api.together.xyz/v1/chat/completions', async () => {
    return HttpResponse.json({
      choices: [{ message: { content: '{"predictions":[{"match_id":"test-001","home_score":2,"away_score":1}]}' } }]
    });
  }),
];

export const server = USE_REAL_API ? null : setupServer(...mockHandlers);

// In test setup
if (!USE_REAL_API && server) {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
```

### Pattern 2: Schema-Based Validation (Not Exact Prediction)
**What:** Validate JSON structure, not prediction values
**When to use:** Testing non-deterministic LLM outputs
**Example:**
```typescript
// Source: Zod documentation + LLM testing best practices
import { z } from 'zod';

// Schema for single prediction
const PredictionSchema = z.object({
  match_id: z.string(),
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
});

// Schema for batch response
const BatchPredictionSchema = z.object({
  predictions: z.array(PredictionSchema).min(1),
});

test('model returns valid JSON structure', async () => {
  const result = await provider.predictBatch(prompt, ['test-001']);

  // Don't test exact scores (non-deterministic)
  // DO test structure, types, and ranges
  const parsed = BatchPredictionSchema.safeParse(result.rawResponse);
  expect(parsed.success).toBe(true);

  if (parsed.success) {
    expect(parsed.data.predictions).toHaveLength(1);
    expect(parsed.data.predictions[0].home_score).toBeGreaterThanOrEqual(0);
  }
});
```

### Pattern 3: Parameterized Model Tests
**What:** Single test definition, run for all 42 models
**When to use:** Testing consistent behavior across many providers
**Example:**
```typescript
// Source: Vitest documentation + existing validate-synthetic-models.ts
import { describe, test, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';

describe.each(ALL_PROVIDERS)('Model: $id', (provider) => {
  test('returns valid JSON structure', async () => {
    const result = await provider.predictBatch(testPrompt, ['test-001']);

    expect(result.success).toBe(true);
    expect(result.predictions.size).toBeGreaterThan(0);

    const prediction = result.predictions.get('test-001');
    expect(prediction).toBeDefined();
    expect(typeof prediction?.homeScore).toBe('number');
    expect(typeof prediction?.awayScore).toBe('number');
  }, { timeout: 90000 }); // 90s for reasoning models
});
```

### Pattern 4: Gradual Rollout with Monitoring
**What:** Phased re-enablement with success rate tracking
**When to use:** Rolling out previously disabled models
**Example:**
```typescript
// Source: Canary deployment best practices + DORA metrics
interface RolloutPhase {
  phase: number;
  models: string[];
  successThreshold: number; // 0.90 = 90%
  minSamples: number;
}

const rolloutPlan: RolloutPhase[] = [
  { phase: 1, models: ['test-model-1'], successThreshold: 0.90, minSamples: 10 },
  { phase: 2, models: ['disabled-model-1', 'disabled-model-2'], successThreshold: 0.90, minSamples: 20 },
  { phase: 3, models: ['disabled-model-3', 'disabled-model-4', 'disabled-model-5', 'disabled-model-6'], successThreshold: 0.90, minSamples: 50 },
];

async function validatePhase(phase: RolloutPhase): Promise<boolean> {
  const stats = await getModelStats(phase.models);

  for (const model of phase.models) {
    const modelStats = stats.find(s => s.modelId === model);
    if (!modelStats || modelStats.totalPredictions < phase.minSamples) {
      return false; // Not enough samples
    }

    const successRate = modelStats.successfulPredictions / modelStats.totalPredictions;
    if (successRate < phase.successThreshold) {
      return false; // Below threshold
    }
  }

  return true; // All models meet criteria
}
```

### Anti-Patterns to Avoid
- **Testing exact prediction values:** LLM outputs are non-deterministic. Test structure, not content.
- **Serial model testing:** With 42 models, serial execution takes too long. Use parallel execution with concurrency limits.
- **No timeout configuration:** Reasoning models need 90s, others 60s/45s. Default 5s will cause false failures.
- **Hardcoded model lists:** Use `ALL_PROVIDERS` array. New models should auto-include in tests.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API mocking | Custom fetch interceptors | MSW (Mock Service Worker) | Handles all HTTP clients (fetch, axios, node-fetch), request matching, response streaming |
| Test parallelization | Custom Promise.all loops | Vitest built-in parallelization | Handles concurrency limits, timeout isolation, proper error reporting |
| JSON validation | Manual type checking | Zod schemas | Runtime validation, TypeScript integration, detailed error messages |
| Test retry logic | Manual retry loops | Vitest retry configuration | Exponential backoff, flaky test detection, proper reporting |
| Test fixtures | Inline test data | Separate fixture files | Reusability, consistency, easier maintenance |

**Key insight:** Integration testing frameworks have matured significantly. MSW eliminates the need for complex mocking infrastructure, Vitest handles parallelization better than custom code, and Zod provides better validation than manual checks. The existing `validate-synthetic-models.ts` is a good foundation but shouldn't be expanded—migrate its patterns into a proper test framework.

## Common Pitfalls

### Pitfall 1: Rate Limiting During Test Runs
**What goes wrong:** Running 42 concurrent API calls triggers rate limits, causing test failures that aren't real bugs
**Why it happens:** LLM APIs have strict rate limits (e.g., Together AI: 600 req/min free tier, Synthetic: varies)
**How to avoid:**
- Use concurrency control: `p-limit` library (already in project) or Vitest's `--max-concurrency` flag
- Run critical tests in CI with mocks, validation runs (real APIs) manually/nightly
- Batch models by provider (test 29 Together models together, then 13 Synthetic)
**Warning signs:** 429 status codes, intermittent failures that pass on retry, all tests failing simultaneously

### Pitfall 2: Timeout Configuration Mismatch
**What goes wrong:** Tests fail with timeout errors for reasoning models that need 90s to respond
**Why it happens:** Default test timeout (5s) is too short for LLM APIs, especially thinking models
**How to avoid:**
- Set per-test timeouts: `{ timeout: 90000 }` for reasoning models, 60000 for others
- Configure global timeout in vitest.config.ts: `testTimeout: 60000`
- Use model-specific timeout: read from `promptConfig.timeoutMs` property
**Warning signs:** Tests fail with "Exceeded timeout" but model returns valid response when run manually

### Pitfall 3: False Negatives from Non-Determinism
**What goes wrong:** Test expects score "2-1" but model returns "1-2", test fails even though JSON is valid
**Why it happens:** LLM outputs vary between runs, testing exact values causes false negatives
**How to avoid:**
- Test JSON schema structure, not prediction values
- Use Zod range validators: `z.number().min(0).max(20)` instead of exact equality
- Focus on parsing success: `result.success === true` and `predictions.size > 0`
**Warning signs:** Tests pass/fail randomly, same model returns different scores on retry

### Pitfall 4: Insufficient Monitoring After Rollout
**What goes wrong:** Model is re-enabled, starts failing in production, takes hours to detect
**Why it happens:** No real-time monitoring of fallback rates or parse failures
**How to avoid:**
- Add fallback rate dashboard (already have `/api/admin/fallback-stats`)
- Monitor parse failure rate: `(failed predictions / total predictions) < 5%`
- Set up alerts: Slack/email when fallback rate exceeds threshold
- Use DORA Change Failure Rate: track deployments that require rollback
**Warning signs:** User reports of missing predictions, increasing fallback costs, single model dominating fallback stats

### Pitfall 5: Ignoring Provider-Specific Response Formats
**What goes wrong:** Test passes for Together AI models but fails for Synthetic models with same logic
**Why it happens:** Different providers return content in different fields (content vs reasoning vs reasoning_details)
**How to avoid:**
- Leverage existing extraction logic in `base.ts` (lines 318-348)
- Don't assume single response format
- Test both providers separately first: `together.test.ts` and `synthetic.test.ts`
**Warning signs:** Tests pass for one provider, fail for another, raw response contains valid data but extraction fails

## Code Examples

Verified patterns from official sources:

### Vitest Configuration for Integration Tests
```typescript
// vitest.config.ts
// Source: Vitest documentation
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60s default (reasoning models override per-test)
    hookTimeout: 10000,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/__tests__/**'],
    },
    maxConcurrency: 5, // Limit concurrent API calls to avoid rate limits
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Integration Test for All Models (JSON-04)
```typescript
// src/__tests__/integration/models/all-models.test.ts
// Source: Adapted from validate-synthetic-models.ts + Vitest patterns
import { describe, test, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { z } from 'zod';

// Zod schema for validation
const PredictionOutputSchema = z.object({
  match_id: z.string(),
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
});

// Test data
const TEST_MATCH_ID = 'test-validation-001';
const TEST_PROMPT = `Provide a prediction for 1 test match.
Match ID: ${TEST_MATCH_ID}
Home Team: Manchester United
Away Team: Liverpool
Competition: Premier League
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;

// Conditional execution based on environment
const shouldSkip = !process.env.TOGETHER_API_KEY || !process.env.SYNTHETIC_API_KEY;

describe.skipIf(shouldSkip)('JSON-04: All Models JSON Validation', () => {
  describe.each(ALL_PROVIDERS)('Model: $id ($name)', (provider) => {
    test('returns valid JSON structure', async () => {
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

      // Assert prediction succeeded
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.predictions.size).toBeGreaterThan(0);

      // Get prediction for test match
      const prediction = result.predictions.get(TEST_MATCH_ID);
      expect(prediction).toBeDefined();

      if (prediction) {
        // Validate structure with Zod
        const validationResult = PredictionOutputSchema.safeParse({
          match_id: TEST_MATCH_ID,
          home_score: prediction.homeScore,
          away_score: prediction.awayScore,
        });

        expect(validationResult.success).toBe(true);

        if (!validationResult.success) {
          console.error(`Validation failed for ${provider.id}:`, validationResult.error.issues);
        }
      }
    }, {
      timeout: provider.id.includes('thinking') || provider.id.includes('r1') ? 90000 : 60000,
      retry: 1, // Retry once for transient failures
    });
  });
});
```

### Fallback Rate Monitoring Query
```typescript
// src/lib/db/queries/fallback-stats.ts
// Source: Existing admin dashboard patterns + DORA metrics
import { getDb, predictions } from '@/lib/db';
import { eq, sql, and, gte } from 'drizzle-orm';

export interface FallbackStats {
  modelId: string;
  totalPredictions: number;
  fallbackCount: number;
  fallbackRate: number;
  avgProcessingTime: number;
}

export async function getFallbackStats(days: number = 7): Promise<FallbackStats[]> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const results = await db
    .select({
      modelId: predictions.modelId,
      totalPredictions: sql<number>`COUNT(*)::int`,
      fallbackCount: sql<number>`SUM(CASE WHEN ${predictions.usedFallback} = true THEN 1 ELSE 0 END)::int`,
      avgProcessingTime: sql<number>`AVG(${predictions.processingTimeMs})::int`,
    })
    .from(predictions)
    .where(gte(predictions.createdAt, cutoffDate))
    .groupBy(predictions.modelId);

  return results.map(r => ({
    modelId: r.modelId,
    totalPredictions: r.totalPredictions,
    fallbackCount: r.fallbackCount,
    fallbackRate: r.totalPredictions > 0 ? r.fallbackCount / r.totalPredictions : 0,
    avgProcessingTime: r.avgProcessingTime,
  }));
}

export async function getGlobalFallbackRate(days: number = 7): Promise<number> {
  const stats = await getFallbackStats(days);
  const totals = stats.reduce((acc, s) => {
    acc.total += s.totalPredictions;
    acc.fallback += s.fallbackCount;
    return acc;
  }, { total: 0, fallback: 0 });

  return totals.total > 0 ? totals.fallback / totals.total : 0;
}
```

### Gradual Rollout Script
```typescript
// scripts/rollout-disabled-models.ts
// Source: Canary deployment patterns + existing sync-models.ts
import { getDb, models } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getFallbackStats } from '@/lib/db/queries/fallback-stats';

const DISABLED_MODELS = [
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'glm-4.6-syn',
  'glm-4.7-syn',
  'qwen3-235b-thinking-syn',
  'gpt-oss-120b-syn',
];

const ROLLOUT_PHASES = [
  { phase: 1, models: ['deepseek-r1-0528-syn'], minSamples: 10, successThreshold: 0.90 },
  { phase: 2, models: ['kimi-k2-thinking-syn', 'qwen3-235b-thinking-syn'], minSamples: 20, successThreshold: 0.90 },
  { phase: 3, models: ['glm-4.6-syn', 'glm-4.7-syn', 'gpt-oss-120b-syn'], minSamples: 50, successThreshold: 0.90 },
];

async function enableModel(modelId: string): Promise<void> {
  const db = getDb();
  await db.update(models)
    .set({ active: true })
    .where(eq(models.id, modelId));
  console.log(`✓ Enabled model: ${modelId}`);
}

async function validatePhase(phaseModels: string[], minSamples: number, threshold: number): Promise<boolean> {
  const stats = await getFallbackStats(7);

  for (const modelId of phaseModels) {
    const modelStats = stats.find(s => s.modelId === modelId);

    if (!modelStats || modelStats.totalPredictions < minSamples) {
      console.log(`⏳ ${modelId}: Insufficient samples (${modelStats?.totalPredictions || 0}/${minSamples})`);
      return false;
    }

    const successRate = 1 - modelStats.fallbackRate;
    if (successRate < threshold) {
      console.log(`❌ ${modelId}: Success rate ${(successRate * 100).toFixed(1)}% < ${(threshold * 100)}%`);
      return false;
    }

    console.log(`✓ ${modelId}: Success rate ${(successRate * 100).toFixed(1)}% (${modelStats.totalPredictions} samples)`);
  }

  return true;
}

async function rollout() {
  console.log('Starting gradual rollout of disabled models...\n');

  for (const phase of ROLLOUT_PHASES) {
    console.log(`Phase ${phase.phase}: Enabling ${phase.models.join(', ')}`);

    for (const modelId of phase.models) {
      await enableModel(modelId);
    }

    console.log(`\nWaiting for ${phase.minSamples} samples per model...`);
    console.log('Run predictions, then check with: npm run validate:rollout\n');

    // In production, this would be a cron job or monitoring alert
    // For now, manual validation
    return;
  }
}

rollout().catch(console.error);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest | 2023-2024 | 10-20x faster test execution, native ESM support, smaller bundle |
| Manual JSON parsing | Zod validation | 2022-present | Runtime type safety, better error messages, TypeScript integration |
| Nock (HTTP mocking) | MSW (Mock Service Worker) | 2024-present | Works in browser + Node.js, modern API, better request matching |
| Big bang deployments | Gradual/canary rollouts | 2020-present | Lower risk, faster rollback, production validation |
| MTTR (Mean Time To Recover) | Failed Deployment Recovery Time | 2023 | Focuses on change-caused failures, not infrastructure |

**Deprecated/outdated:**
- Jest (still maintained but slower than Vitest for large test suites)
- Supertest alone (pair with MSW for better mocking)
- Manual retry logic (Vitest has built-in retry with `{ retry: N }`)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Concurrency for 42 Models**
   - What we know: Rate limits exist (Together: 600/min free, Synthetic: unknown), serial testing takes too long
   - What's unclear: Exact rate limits for Synthetic.new, optimal batch size
   - Recommendation: Start with `maxConcurrency: 5`, monitor for 429 errors, adjust up/down

2. **Cost of Validation Runs**
   - What we know: 42 models × $0.0001-0.005 per call = $0.004-0.21 per full validation
   - What's unclear: How often to run validation (daily? weekly? per deployment?)
   - Recommendation: Run with mocks in CI (free), real APIs weekly + before major releases

3. **Fallback Rate Threshold**
   - What we know: Requirement says <5% fallback rate
   - What's unclear: Is this per-model or global? Does it include models with no fallback configured?
   - Recommendation: Track both per-model and global. Alert if global >5% OR any single model >20%

4. **Disabled Model Recovery Strategy**
   - What we know: 6 models were disabled (now re-enabled with prompt fixes)
   - What's unclear: Were they disabled manually or auto-disabled by failure rate? Should they stay disabled until validation passes?
   - Recommendation: Check `models.active` column in database. If false, validate in tests before re-enabling

## Sources

### Primary (HIGH confidence)
- [Vitest Documentation - Getting Started](https://vitest.dev/guide/)
- [Zod Documentation - Intro](https://zod.dev/)
- [MSW Documentation](https://mswjs.io/)

### Secondary (MEDIUM confidence)
- [Node.js Integration Testing Best Practices (GitHub)](https://github.com/goldbergyoni/nodejs-testing-best-practices) - Comprehensive guide, April 2025
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)
- [How to Mock External APIs in Node.js Tests](https://oneuptime.com/blog/post/2026-01-06-nodejs-mock-external-apis-tests/view)
- [LLM Testing in 2026: Top Methods and Strategies](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies)
- [How to validate LLM responses continuously in real time](https://www.guardrailsai.com/blog/validate-llm-responses-real-time)
- [Canary Deployment Strategy - Google Cloud](https://docs.cloud.google.com/deploy/docs/deployment-strategies/canary)
- [Complete Guide to Change Failure Rate [2026 Edition]](https://axify.io/blog/change-failure-rate-explained)
- [DORA Metrics - Four Keys](https://dora.dev/guides/dora-metrics-four-keys/)

### Tertiary (LOW confidence - from codebase inspection)
- Existing `scripts/validate-synthetic-models.ts` - validates 13 Synthetic models
- Existing `src/lib/llm/providers/base.ts` - response extraction logic (lines 318-348)
- Existing `src/app/api/admin/fallback-stats/route.ts` - fallback monitoring foundation
- Zod 4.3.6 already installed (package.json line 64)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest, Zod, MSW are industry standard (verified with official docs)
- Architecture: MEDIUM - Patterns adapted from docs + existing codebase, but untested in this specific context
- Pitfalls: MEDIUM - Based on common patterns from LLM testing articles + rate limiting knowledge, but Synthetic.new specifics unknown
- Rollout strategy: MEDIUM - Canary patterns well-documented, but specific thresholds (90%, <5%) need validation
- Cost estimates: LOW - Approximate based on typical LLM pricing, actual costs depend on model usage

**Research date:** 2026-02-05
**Valid until:** 30 days (stable tooling, but LLM API patterns evolve quickly)
