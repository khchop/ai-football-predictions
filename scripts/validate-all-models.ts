/**
 * Validate All Models Script
 *
 * Tests all 42 LLM models (29 Together + 13 Synthetic) with sample predictions to verify:
 * - JSON parsing works correctly
 * - All models return valid prediction structure
 * - Previously disabled models (Phase 40-41 rehabilitated) achieve >90% success rate
 *
 * Usage: npm run validate:models
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import pLimit from 'p-limit';
import { ALL_PROVIDERS, TOGETHER_PROVIDERS, SYNTHETIC_PROVIDERS } from '../src/lib/llm';
import { PredictionOutputSchema } from '../src/__tests__/schemas/prediction';
import type { LLMProvider } from '../src/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Test prompt constants
const TEST_MATCH_ID = 'test-validation-001';
const TEST_PROMPT = `Provide a prediction for 1 test match.
Match ID: ${TEST_MATCH_ID}
Home Team: Manchester United
Away Team: Liverpool
Competition: Premier League
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;

// Model classification constants
const REASONING_MODEL_IDS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
  'deepseek-r1',
]);

/**
 * PREVIOUSLY DISABLED MODELS
 *
 * These 6 models were previously disabled but re-enabled during Phases 40-41
 * with model-specific prompts and fallback chains. They require explicit
 * validation to confirm >90% success rate.
 */
const PREVIOUSLY_DISABLED_MODELS = [
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'kimi-k2.5-syn',
  'glm-4.6-syn',
  'glm-4.7-syn',
  'qwen3-235b-thinking-syn',
] as const;

// Concurrency limit to avoid rate limiting
const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

// ============================================================================
// TYPES
// ============================================================================

interface ValidationResult {
  modelId: string;
  provider: 'together' | 'synthetic';
  success: boolean;
  prediction?: { homeScore: number; awayScore: number };
  error?: string;
  durationMs: number;
  wasPreviouslyDisabled: boolean;
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

/**
 * Validate a single model with timeout
 */
async function validateModel(provider: LLMProvider): Promise<ValidationResult> {
  const start = Date.now();
  const isReasoning = REASONING_MODEL_IDS.has(provider.id);
  const timeout = isReasoning ? 90000 : 60000;
  const wasPreviouslyDisabled = (PREVIOUSLY_DISABLED_MODELS as readonly string[]).includes(
    provider.id
  );
  const providerType = provider.id.endsWith('-syn') ? 'synthetic' : 'together';

  try {
    // Race between API call and timeout
    const result = await Promise.race([
      provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    // Extract prediction if successful
    let prediction: { homeScore: number; awayScore: number } | undefined;
    if (result.success && result.predictions.has(TEST_MATCH_ID)) {
      const pred = result.predictions.get(TEST_MATCH_ID)!;
      prediction = { homeScore: pred.homeScore, awayScore: pred.awayScore };

      // Validate with Zod schema
      const validation = PredictionOutputSchema.safeParse({
        match_id: TEST_MATCH_ID,
        home_score: pred.homeScore,
        away_score: pred.awayScore,
      });

      if (!validation.success) {
        return {
          modelId: provider.id,
          provider: providerType,
          success: false,
          error: `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`,
          durationMs: Date.now() - start,
          wasPreviouslyDisabled,
        };
      }
    }

    return {
      modelId: provider.id,
      provider: providerType,
      success: result.success,
      prediction,
      error: result.error,
      durationMs: Date.now() - start,
      wasPreviouslyDisabled,
    };
  } catch (error) {
    return {
      modelId: provider.id,
      provider: providerType,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - start,
      wasPreviouslyDisabled,
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n=== All Models Validation ===\n');
  console.log(`Testing ${ALL_PROVIDERS.length} models (${TOGETHER_PROVIDERS.length} Together + ${SYNTHETIC_PROVIDERS.length} Synthetic)\n`);

  // Check API keys
  const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
  const hasSyntheticKey = !!process.env.SYNTHETIC_API_KEY;

  console.log(`Together API: ${hasTogetherKey ? 'configured' : 'MISSING'}`);
  console.log(`Synthetic API: ${hasSyntheticKey ? 'configured' : 'MISSING'}`);
  console.log(`Concurrency limit: ${CONCURRENCY_LIMIT}`);
  console.log(`Previously disabled models: ${PREVIOUSLY_DISABLED_MODELS.length}`);
  console.log('');

  if (!hasTogetherKey && !hasSyntheticKey) {
    console.error('ERROR: No API keys configured. Set TOGETHER_API_KEY and/or SYNTHETIC_API_KEY in .env.local');
    process.exit(1);
  }

  // Filter providers based on available API keys
  const providersToTest = ALL_PROVIDERS.filter(p => {
    if (p.id.endsWith('-syn')) {
      return hasSyntheticKey;
    }
    return hasTogetherKey;
  });

  console.log(`Testing ${providersToTest.length} models with available API keys...\n`);
  console.log('-'.repeat(60));

  // Run validation with concurrency control
  const results = await Promise.all(
    providersToTest.map(p => limit(() => {
      const emoji = p.id.endsWith('-syn') ? '[SYN]' : '[TOG]';
      process.stdout.write(`${emoji} Testing ${p.id}...`);
      return validateModel(p).then(result => {
        const status = result.success ? 'PASS' : 'FAIL';
        const details = result.success
          ? `${result.prediction?.homeScore}-${result.prediction?.awayScore} (${result.durationMs}ms)`
          : result.error;
        console.log(` ${status} - ${details}`);
        return result;
      });
    }))
  );

  // Print overall results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const overallSuccessRate = successful.length / results.length;

  console.log('\n' + '-'.repeat(60));
  console.log('\n=== OVERALL RESULTS ===\n');
  console.log(`Total tested: ${results.length}`);
  console.log(`Successful: ${successful.length}/${results.length} (${(overallSuccessRate * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log('\nFailed models:');
    for (const f of failed) {
      const pdTag = f.wasPreviouslyDisabled ? ' [REHABILITATED]' : '';
      console.log(`  - ${f.modelId}${pdTag}: ${f.error}`);
    }
  }

  // ============================================================================
  // PREVIOUSLY DISABLED MODELS REPORTING
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('\n=== PREVIOUSLY DISABLED MODELS (Phase 40-41 Rehabilitated) ===\n');

  const previouslyDisabledResults = results.filter(r => r.wasPreviouslyDisabled);

  if (previouslyDisabledResults.length === 0) {
    console.log('No previously disabled models were tested (Synthetic API key may be missing)');
  } else {
    const pdSuccessful = previouslyDisabledResults.filter(r => r.success);
    const pdFailed = previouslyDisabledResults.filter(r => !r.success);
    const pdSuccessRate = pdSuccessful.length / previouslyDisabledResults.length;

    console.log('Models validated:');
    for (const result of previouslyDisabledResults) {
      const status = result.success ? 'PASS' : 'FAIL';
      const details = result.success
        ? `${result.prediction?.homeScore}-${result.prediction?.awayScore} (${result.durationMs}ms)`
        : result.error;
      console.log(`  ${status} ${result.modelId}: ${details}`);
    }

    console.log(`\nPreviously disabled success rate: ${pdSuccessful.length}/${previouslyDisabledResults.length} (${(pdSuccessRate * 100).toFixed(1)}%)`);

    if (pdSuccessRate < 0.90) {
      console.log(`\n!!! CRITICAL: Previously disabled models below 90% threshold !!!`);
      console.log(`Failed models from this group:`);
      for (const f of pdFailed) {
        console.log(`  - ${f.modelId}: ${f.error}`);
      }
    } else {
      console.log(`\nPreviously disabled models PASSED >90% threshold`);
    }
  }

  // ============================================================================
  // FINAL VERDICT
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('\n=== FINAL VERDICT ===\n');

  let exitCode = 0;

  // Check overall success rate
  if (overallSuccessRate < 0.90) {
    console.log(`FAIL: Overall success rate ${(overallSuccessRate * 100).toFixed(1)}% < 90%`);
    exitCode = 1;
  } else {
    console.log(`PASS: Overall success rate ${(overallSuccessRate * 100).toFixed(1)}%`);
  }

  // Check previously disabled models (only if they were tested)
  if (previouslyDisabledResults.length > 0) {
    const pdSuccessRate = previouslyDisabledResults.filter(r => r.success).length / previouslyDisabledResults.length;

    if (pdSuccessRate < 0.90) {
      console.log(`FAIL: Previously disabled models ${(pdSuccessRate * 100).toFixed(1)}% < 90%`);
      exitCode = 1;
    } else {
      console.log(`PASS: Previously disabled models ${(pdSuccessRate * 100).toFixed(1)}%`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(exitCode);
}

// Run validation
main().catch(error => {
  console.error('\nValidation script crashed:', error);
  process.exit(1);
});
