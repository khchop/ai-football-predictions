# Phase 53: Regression Protection - Research

**Researched:** 2026-02-07
**Domain:** Regression testing, schema validation, CI/CD integration
**Confidence:** HIGH

## Summary

Phase 53 establishes regression protection for the 42 LLM models (29 Together.ai + 13 Synthetic) to prevent config changes from breaking currently-working models. The research identifies Vitest snapshot/golden fixture testing as the standard approach, Zod schema validation at the database boundary as the guard against invalid data, and GitHub Actions with required status checks as the enforcement mechanism.

The project already has strong foundations: Vitest test suite with integration tests for all 42 models (`src/__tests__/integration/models/all-models.test.ts`), Zod validation schemas (`src/__tests__/schemas/prediction.ts`), and validation scripts (`validate-all-models.ts`). The gap is: (1) golden fixtures capturing known-good responses for regression detection, (2) runtime Zod validation before database insertion in `predictions.worker.ts`, and (3) CI automation to run tests before merge.

**Primary recommendation:** Extend existing test infrastructure with golden fixtures, add Zod validation guard at `createPredictionsBatch()` call site, configure GitHub Actions workflow with required status checks.

## Standard Stack

The established libraries/tools for regression testing and schema validation in TypeScript projects:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Vitest** | 4.0.18 (installed) | Testing framework with snapshot support | Fast, Vite-native, Jest-compatible. Already configured in project with 60s timeout for LLM APIs |
| **Zod** | 4.3.6 (installed) | Runtime schema validation | TypeScript-first, zero dependencies, excellent error messages. Already used in project tests |
| **GitHub Actions** | Cloud | CI/CD automation | Native GitHub integration, free for public repos, YAML-versioned workflows |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@vitest/ui** | 4.0.18 (installed) | Visual test runner | Local development debugging |
| **tsx** | 4.21.0 (installed) | TypeScript execution | Run scripts without compilation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest is slower, requires more config. Vitest already set up. |
| Zod | Yup, io-ts | Zod has better TypeScript integration and smaller bundle size (v4). Already installed. |
| GitHub Actions | CircleCI, Jenkins | More setup, less GitHub integration. Actions is free and native. |

**Installation:** No new packages needed. All core libraries already installed.

## Architecture Patterns

### Recommended Test Structure

```
src/__tests__/
├── fixtures/
│   ├── test-data.ts              # Existing: shared constants
│   └── golden/                   # NEW: golden response fixtures
│       ├── deepseek-r1.json
│       ├── llama-3-1-405b.json
│       └── [model-id].json       # One fixture per model
├── integration/
│   └── models/
│       ├── all-models.test.ts    # Existing: validation tests
│       └── regression.test.ts    # NEW: golden fixture tests
└── schemas/
    └── prediction.ts             # Existing: Zod schemas
```

### Pattern 1: Golden Fixture Regression Testing

**What:** Capture known-good LLM responses as JSON fixtures, validate new responses match expected structure.

**When to use:** Before config changes (prompts, timeouts, handlers) to detect regressions.

**Example:**
```typescript
// Source: Vitest docs + project context
import { describe, test, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import goldenFixtures from '@/__tests__/fixtures/golden';

describe('Regression: Working Models', () => {
  // Test each model against its golden fixture
  test.each(Object.keys(goldenFixtures))('model %s maintains valid output', async (modelId) => {
    const provider = ALL_PROVIDERS.find(p => p.id === modelId);
    expect(provider).toBeDefined();

    const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

    // Validate structure (not exact scores)
    const prediction = result.predictions.get(TEST_MATCH_ID);
    const validation = PredictionOutputSchema.safeParse({
      match_id: TEST_MATCH_ID,
      home_score: prediction?.homeScore,
      away_score: prediction?.awayScore,
    });

    expect(validation.success).toBe(true);
  });
});
```

### Pattern 2: Runtime Schema Validation at Database Boundary

**What:** Use Zod `safeParse()` to validate prediction structure before database insertion.

**When to use:** Every database write operation to prevent invalid data from reaching Postgres.

**Example:**
```typescript
// Source: Zod docs v4 + project pattern
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';

// In predictions.worker.ts, before createPredictionsBatch()
const newPredictions: NewPrediction[] = [];

for (const prediction of predictions) {
  const validation = PredictionOutputSchema.safeParse({
    match_id: prediction.matchId,
    home_score: prediction.homeScore,
    away_score: prediction.awayScore,
  });

  if (!validation.success) {
    log.error({
      modelId: provider.id,
      matchId: prediction.matchId,
      issues: validation.error.issues,
    }, 'Schema validation failed, skipping prediction');

    await recordModelFailure(provider.id, 'schema_validation_failed');
    continue; // Skip invalid prediction
  }

  newPredictions.push({
    id: uuidv4(),
    matchId: prediction.matchId,
    modelId: provider.id,
    homeScore: validation.data.home_score, // Use validated data
    awayScore: validation.data.away_score,
    status: 'pending',
  });
}

await createPredictionsBatch(newPredictions);
```

### Pattern 3: GitHub Actions CI Integration

**What:** Run regression test suite automatically on pull requests, block merge if tests fail.

**When to use:** Before merging any change to LLM config, prompts, or response handlers.

**Example:**
```yaml
# Source: GitHub Actions docs + Vitest integration patterns
# .github/workflows/regression-tests.yml
name: Regression Tests

on:
  pull_request:
    paths:
      - 'src/lib/llm/**'
      - 'src/lib/queue/workers/predictions.worker.ts'
      - 'src/__tests__/**'

jobs:
  regression:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run regression tests
        run: npm run test:regression
        env:
          TOGETHER_API_KEY: ${{ secrets.TOGETHER_API_KEY }}
          SYNTHETIC_API_KEY: ${{ secrets.SYNTHETIC_API_KEY }}

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
```

### Anti-Patterns to Avoid

- **Brittle exact-match testing:** Don't compare exact scores (LLM outputs are non-deterministic). Validate structure only.
- **No schema validation:** Don't assume LLM outputs are always valid. Always validate before database save.
- **Manual test runs:** Don't rely on developers remembering to run tests. Automate in CI.
- **Flaky timeouts:** Don't use single timeout for all models. Use model-specific timeouts (already implemented in `test-data.ts`).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Custom validation functions | Zod schemas | Type inference, detailed error messages, composability |
| Snapshot testing | Manual JSON comparison | Vitest snapshots | Auto-update, diff visualization, `toMatchSnapshot()` |
| CI test automation | Manual deployment scripts | GitHub Actions | Native integration, free, declarative YAML |
| Test fixtures | Inline test data | External JSON files | Reusability, git-trackable, easy updates |

**Key insight:** The project already has the right tools installed. Don't introduce new dependencies or custom solutions.

## Common Pitfalls

### Pitfall 1: Non-Deterministic Test Failures

**What goes wrong:** LLM outputs vary between runs. Exact score assertions fail randomly.

**Why it happens:** LLMs are probabilistic. Even with `temperature: 0.5`, outputs vary.

**How to avoid:** Validate structure/schema only, not exact values. Use Zod to check `home_score` and `away_score` are numbers 0-20, not specific values.

**Warning signs:** Tests pass locally but fail in CI. Intermittent failures on same model.

### Pitfall 2: Missing Schema Validation at Database Boundary

**What goes wrong:** Invalid JSON from LLM parsing bugs reaches database, causing constraint violations or corrupt data.

**Why it happens:** Only relying on test-time validation. No runtime guards in production code paths.

**How to avoid:** Add `safeParse()` validation in `predictions.worker.ts` before `createPredictionsBatch()`. Treat validation failures as model errors, record in metrics.

**Warning signs:** Database errors like "null value in column home_score violates not-null constraint."

### Pitfall 3: Tests Don't Run Before Config Changes

**What goes wrong:** Prompt updates break working models, discovered in production after deployment.

**Why it happens:** No CI enforcement. Developers forget to run tests locally.

**How to avoid:** GitHub Actions workflow with required status checks. Configure branch protection to block merge if regression tests fail.

**Warning signs:** Production incidents after "simple prompt tweaks."

### Pitfall 4: Shared Test State Between Models

**What goes wrong:** Test for model A pollutes state, causing model B test to fail.

**Why it happens:** Tests share mutable fixtures or global state.

**How to avoid:** Each test creates its own fixtures. Use Vitest's test isolation (already configured). Model tests run independently with `test.each()`.

**Warning signs:** Tests pass when run individually but fail when run as suite.

## Code Examples

Verified patterns from official sources and project codebase:

### Creating Golden Fixtures

```typescript
// Source: Project pattern + golden master testing best practices
// scripts/generate-golden-fixtures.ts
import { writeFileSync } from 'fs';
import { ALL_PROVIDERS } from '@/lib/llm';
import { TEST_PROMPT, TEST_MATCH_ID } from '@/__tests__/fixtures/test-data';

async function generateGoldenFixtures() {
  const fixtures: Record<string, any> = {};

  for (const provider of ALL_PROVIDERS) {
    try {
      const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);
      const prediction = result.predictions.get(TEST_MATCH_ID);

      if (result.success && prediction) {
        fixtures[provider.id] = {
          modelId: provider.id,
          rawResponse: result.rawResponse,
          parsed: {
            match_id: TEST_MATCH_ID,
            home_score: prediction.homeScore,
            away_score: prediction.awayScore,
          },
          success: true,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error(`Failed to generate fixture for ${provider.id}:`, error);
    }
  }

  writeFileSync(
    'src/__tests__/fixtures/golden/all-models.json',
    JSON.stringify(fixtures, null, 2)
  );
}
```

### Schema Validation Before Database Save

```typescript
// Source: Zod docs + project context
// In predictions.worker.ts
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import { z } from 'zod';

// Before createPredictionsBatch() call
const validatedPredictions: NewPrediction[] = [];

for (const pred of predictions) {
  const validation = PredictionOutputSchema.safeParse({
    match_id: pred.matchId,
    home_score: pred.homeScore,
    away_score: pred.awayScore,
  });

  if (!validation.success) {
    log.error({
      modelId: pred.modelId,
      issues: validation.error.issues,
    }, 'Prediction failed schema validation');

    await recordModelFailure(pred.modelId, 'schema_validation_failed');
    continue; // Skip invalid prediction
  }

  validatedPredictions.push({
    id: uuidv4(),
    matchId: pred.matchId,
    modelId: pred.modelId,
    homeScore: validation.data.home_score,
    awayScore: validation.data.away_score,
    status: 'pending',
  });
}

if (validatedPredictions.length > 0) {
  await createPredictionsBatch(validatedPredictions);
}
```

### Regression Test with Vitest

```typescript
// Source: Vitest docs + project all-models.test.ts
import { describe, test, expect } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import { TEST_PROMPT, TEST_MATCH_ID, getModelTimeout } from '@/__tests__/fixtures/test-data';

describe('REGR-01: Working Models Maintain Valid Output', () => {
  test.each(ALL_PROVIDERS)('$id returns valid JSON structure', async (provider) => {
    const timeout = getModelTimeout(provider.id);

    const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

    expect(result.success).toBe(true);

    const prediction = result.predictions.get(TEST_MATCH_ID);
    expect(prediction).toBeDefined();

    const validation = PredictionOutputSchema.safeParse({
      match_id: TEST_MATCH_ID,
      home_score: prediction!.homeScore,
      away_score: prediction!.awayScore,
    });

    expect(validation.success).toBe(true);
  }, { timeout });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual testing before config changes | Automated regression tests in CI | 2024-2025 | Catch regressions before production |
| Parse errors crash worker | Schema validation with graceful degradation | 2025-2026 | Failed model doesn't block others |
| Trust LLM output structure | Runtime validation with Zod | 2025-2026 | Database integrity protection |
| Jest snapshots | Vitest snapshots | 2023-2024 | Faster test runs, better DX |

**Deprecated/outdated:**
- **Jest for new projects:** Vitest is now standard for Vite/Next.js projects (faster, better ESM support)
- **Manual fixture updates:** Golden fixtures should be versioned and automated
- **No CI testing:** Required status checks are now GitHub free tier standard

## Current Project State

### Strengths

1. **Test infrastructure exists:** Vitest configured with 60s timeout, `all-models.test.ts` validates all 42 models
2. **Zod schemas defined:** `PredictionOutputSchema` already validates structure in tests
3. **Model classification:** `REASONING_MODEL_IDS` set identifies models needing extended timeouts
4. **Validation scripts:** `validate-all-models.ts` and `validate-synthetic-models.ts` exist

### Gaps

1. **No golden fixtures:** No baseline snapshots of known-good responses
2. **No runtime validation:** `predictions.worker.ts` doesn't validate with Zod before database save
3. **No CI automation:** No GitHub Actions workflow, tests don't run automatically
4. **No merge protection:** Branch protection rules don't require passing tests

## Implementation Strategy

### Phase 1: Golden Fixtures (REGR-01)

- Create `src/__tests__/fixtures/golden/` directory
- Generate baseline fixtures for all 42 working models
- Add regression test suite that compares new outputs against fixtures (structure only)

### Phase 2: Runtime Validation (REGR-02)

- Import `PredictionOutputSchema` in `predictions.worker.ts`
- Add `safeParse()` validation before `createPredictionsBatch()` call
- Record validation failures as model errors with `recordModelFailure()`

### Phase 3: CI Automation (REGR-03)

- Create `.github/workflows/regression-tests.yml`
- Configure to run on PR changes to `src/lib/llm/**`
- Add required status check in GitHub branch protection rules
- Add `test:regression` script to `package.json`

## Open Questions

None. All requirements are clear and implementation path is well-defined.

## Sources

### Primary (HIGH confidence)

- **Vitest Documentation:** [/websites/main_vitest_dev](https://main.vitest.dev) - Fixtures, snapshot testing, CI integration
- **Zod Documentation:** [/colinhacks/zod](https://github.com/colinhacks/zod) - Schema validation, safeParse, error handling
- **GitHub Actions Docs:** [Managing branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- **Project Codebase:** Existing test infrastructure (`vitest.config.ts`, `all-models.test.ts`, `prediction.ts`)

### Secondary (MEDIUM confidence)

- [Regression Testing Guide 2026](https://cloudqa.io/regression-testing-in-software-development/) - Best practices, test prioritization
- [Automated Regression Testing Best Practices 2026](https://luxequality.com/blog/automated-regression-testing/) - CI/CD integration patterns
- [Vitest Code Coverage with GitHub Actions](https://medium.com/@alvarado.david/vitest-code-coverage-with-github-actions-report-compare-and-block-prs-on-low-coverage-67fceaa79a47) - Blocking PRs on failures
- [Golden Master Testing](https://www.sitepoint.com/golden-master-testing-refactor-complicated-views/) - Characterization test pattern
- [API Snapshot Testing](https://kreya.app/blog/api-snapshot-testing/) - Golden master for API responses

### Tertiary (LOW confidence)

None applicable.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and configured
- Architecture: HIGH - Patterns verified in official docs and existing codebase
- Pitfalls: HIGH - Based on project memory (circular deps, connection() errors) and industry best practices

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable tooling)
