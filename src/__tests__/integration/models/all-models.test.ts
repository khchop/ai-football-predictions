/**
 * All Models JSON Validation Integration Tests (JSON-04)
 *
 * Tests that all 38 OpenRouter LLM models return valid JSON
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
const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
const shouldSkip = !hasOpenRouterKey;

describe.skipIf(shouldSkip)('JSON-04: All Models JSON Validation', () => {
  beforeAll(() => {
    console.log(`\nTesting ${ALL_PROVIDERS.length} models`);
    console.log(`OpenRouter API: ${hasOpenRouterKey ? 'available' : 'missing'}`);
    console.log('');
  });

  // Group: OpenRouter Models
  describe.skipIf(!hasOpenRouterKey)('OpenRouter Models', () => {
    describe.each(ALL_PROVIDERS)('$id', (provider) => {
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

  // Summary test to verify model count
  test('validates expected model count', () => {
    expect(ALL_PROVIDERS.length).toBe(23);
  });
});
