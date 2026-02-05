/**
 * All Models JSON Validation Integration Tests (JSON-04)
 *
 * Tests that all 42 LLM models (29 Together + 13 Synthetic) return valid JSON
 * structure for predictions. Validates structure, not exact values.
 *
 * Usage: npm run test -- --run src/__tests__/integration/models/all-models.test.ts
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { ALL_PROVIDERS } from '@/lib/llm';
import { PredictionOutputSchema } from '@/__tests__/schemas/prediction';
import {
  TEST_MATCH_ID,
  TEST_PROMPT,
  REASONING_MODEL_IDS,
  REASONING_MODEL_TIMEOUT,
  STANDARD_MODEL_TIMEOUT,
} from '@/__tests__/fixtures/test-data';

// API key detection for conditional test execution
const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
const hasSyntheticKey = !!process.env.SYNTHETIC_API_KEY;
const shouldSkip = !hasTogetherKey && !hasSyntheticKey;

// Previously disabled models (re-enabled during Phases 40-41)
// These require explicit validation to confirm successful rehabilitation
const PREVIOUSLY_DISABLED_MODELS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'kimi-k2.5-syn',
  'glm-4.6-syn',
  'glm-4.7-syn',
  'qwen3-235b-thinking-syn',
]);

describe.skipIf(shouldSkip)('JSON-04: All Models JSON Validation', () => {
  beforeAll(() => {
    console.log(`\nTesting ${ALL_PROVIDERS.length} models`);
    console.log(`Together API: ${hasTogetherKey ? 'available' : 'missing'}`);
    console.log(`Synthetic API: ${hasSyntheticKey ? 'available' : 'missing'}`);
    console.log(`Previously disabled models: ${PREVIOUSLY_DISABLED_MODELS.size}`);
    console.log('');
  });

  // Group: Together AI Models (if key available)
  describe.skipIf(!hasTogetherKey)('Together AI Models', () => {
    const togetherProviders = ALL_PROVIDERS.filter(p => !p.id.endsWith('-syn'));

    describe.each(togetherProviders)('$id', (provider) => {
      const isReasoning = REASONING_MODEL_IDS.has(provider.id);
      const timeout = isReasoning ? REASONING_MODEL_TIMEOUT : STANDARD_MODEL_TIMEOUT;

      test(
        'returns valid JSON structure',
        { timeout, retry: 1 },
        async () => {
          const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

          // Assert basic success
          expect(result.success).toBe(true);
          expect(result.predictions.size).toBeGreaterThan(0);

          // Get prediction
          const prediction = result.predictions.get(TEST_MATCH_ID);
          expect(prediction).toBeDefined();

          if (prediction) {
            // Validate structure with Zod (not exact values)
            const validation = PredictionOutputSchema.safeParse({
              match_id: TEST_MATCH_ID,
              home_score: prediction.homeScore,
              away_score: prediction.awayScore,
            });

            if (!validation.success) {
              console.error(
                `Validation failed for ${provider.id}:`,
                validation.error.issues
              );
            }

            expect(validation.success).toBe(true);
          }
        }
      );
    });
  });

  // Group: Synthetic Models (if key available)
  describe.skipIf(!hasSyntheticKey)('Synthetic Models', () => {
    const syntheticProviders = ALL_PROVIDERS.filter(p => p.id.endsWith('-syn'));

    describe.each(syntheticProviders)('$id', (provider) => {
      const isReasoning = REASONING_MODEL_IDS.has(provider.id);
      const isPreviouslyDisabled = PREVIOUSLY_DISABLED_MODELS.has(provider.id);
      const timeout = isReasoning ? REASONING_MODEL_TIMEOUT : STANDARD_MODEL_TIMEOUT;

      test(
        `returns valid JSON structure${isPreviouslyDisabled ? ' [REHABILITATED]' : ''}`,
        { timeout, retry: 1 },
        async () => {
          const result = await provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]);

          // Assert basic success
          expect(result.success).toBe(true);
          expect(result.predictions.size).toBeGreaterThan(0);

          // Get prediction
          const prediction = result.predictions.get(TEST_MATCH_ID);
          expect(prediction).toBeDefined();

          if (prediction) {
            // Validate structure with Zod (not exact values)
            const validation = PredictionOutputSchema.safeParse({
              match_id: TEST_MATCH_ID,
              home_score: prediction.homeScore,
              away_score: prediction.awayScore,
            });

            if (!validation.success) {
              console.error(
                `Validation failed for ${provider.id}:`,
                validation.error.issues
              );
            }

            expect(validation.success).toBe(true);

            // Additional logging for previously disabled models
            if (isPreviouslyDisabled) {
              console.log(
                `  [REHABILITATED] ${provider.id}: ${prediction.homeScore}-${prediction.awayScore}`
              );
            }
          }
        }
      );
    });
  });

  // Summary test to verify model count
  test('validates expected model count', () => {
    expect(ALL_PROVIDERS.length).toBe(42);

    const togetherCount = ALL_PROVIDERS.filter(p => !p.id.endsWith('-syn')).length;
    const syntheticCount = ALL_PROVIDERS.filter(p => p.id.endsWith('-syn')).length;

    expect(togetherCount).toBe(29);
    expect(syntheticCount).toBe(13);
  });
});
