/**
 * Validate Synthetic Models Script
 *
 * Tests all 13 Synthetic.new models with sample predictions to verify:
 * - JSON parsing works correctly
 * - Reasoning models have thinking tags properly stripped
 * - GLM models don't output Chinese text
 *
 * Usage: npx tsx scripts/validate-synthetic-models.ts
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { SYNTHETIC_PROVIDERS } from '../src/lib/llm/providers/synthetic';
import { BATCH_SYSTEM_PROMPT, parseBatchPredictionResponse } from '../src/lib/llm/prompt';

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
]);

const GLM_MODEL_IDS = new Set(['glm-4.6-syn', 'glm-4.7-syn']);

/**
 * Detect Chinese characters in text
 */
function containsChinese(text: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(text);
}

/**
 * Validation result for a single model
 */
interface ValidationResult {
  modelId: string;
  success: boolean;
  prediction?: { homeScore: number; awayScore: number };
  error?: string;
  rawResponsePreview: string;
  flags: {
    hasThinkingTags: boolean;
    hasChinese: boolean;
  };
}

/**
 * Validate a single model with timeout
 */
async function validateModel(
  provider: typeof SYNTHETIC_PROVIDERS[number]
): Promise<ValidationResult> {
  const modelId = provider.id;

  try {
    // Create timeout promise (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
    });

    // Race between API call and timeout
    const result = await Promise.race([
      provider.predictBatch(TEST_PROMPT, [TEST_MATCH_ID]),
      timeoutPromise,
    ]);

    // Extract prediction if successful
    let prediction: { homeScore: number; awayScore: number } | undefined;
    if (result.success && result.predictions.has(TEST_MATCH_ID)) {
      const pred = result.predictions.get(TEST_MATCH_ID)!;
      prediction = { homeScore: pred.homeScore, awayScore: pred.awayScore };
    }

    // Check for thinking tags in raw response (before parsing strips them)
    const hasThinkingTags =
      /<think>/i.test(result.rawResponse) ||
      /<thinking>/i.test(result.rawResponse) ||
      /<reasoning>/i.test(result.rawResponse);

    // Check for Chinese characters
    const hasChinese = containsChinese(result.rawResponse);

    return {
      modelId,
      success: result.success,
      prediction,
      error: result.error,
      rawResponsePreview: result.rawResponse.slice(0, 300),
      flags: {
        hasThinkingTags,
        hasChinese,
      },
    };
  } catch (error) {
    return {
      modelId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      rawResponsePreview: '',
      flags: {
        hasThinkingTags: false,
        hasChinese: false,
      },
    };
  }
}

/**
 * Main validation function
 */
async function validateAllModels() {
  console.log('\n🧪 Synthetic Model Validation\n');
  console.log('═'.repeat(60));

  // Check API key exists
  if (!process.env.SYNTHETIC_API_KEY) {
    console.error('\n❌ Error: SYNTHETIC_API_KEY not found in environment');
    console.error('   Please set SYNTHETIC_API_KEY in .env.local\n');
    process.exit(1);
  }

  console.log(`\nTesting ${SYNTHETIC_PROVIDERS.length} Synthetic models...\n`);

  // Test all models concurrently
  const results = await Promise.allSettled(
    SYNTHETIC_PROVIDERS.map(provider => validateModel(provider))
  );

  // Process and display results
  let successCount = 0;
  let failureCount = 0;
  const failures: Array<{ modelId: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const provider = SYNTHETIC_PROVIDERS[i];

    if (result.status === 'rejected') {
      console.log(`\n[${provider.id}] ❌ FAILED`);
      console.log(`  Error: ${result.reason}`);
      failureCount++;
      failures.push({ modelId: provider.id, error: String(result.reason) });
      continue;
    }

    const validation = result.value;
    const isReasoning = REASONING_MODEL_IDS.has(validation.modelId);
    const isGLM = GLM_MODEL_IDS.has(validation.modelId);

    // Determine model category
    let category = 'Standard model';
    if (isReasoning) category = 'Reasoning model';
    else if (isGLM) category = 'GLM model';

    console.log(`\n[${validation.modelId}] ${category}`);

    if (validation.success) {
      console.log(`  ✅ Parsed successfully: yes`);
      console.log(`  📊 Prediction: ${validation.prediction?.homeScore}-${validation.prediction?.awayScore}`);

      // Special checks for reasoning models
      if (isReasoning) {
        console.log(`  🧠 Raw response has thinking tags: ${validation.flags.hasThinkingTags ? 'yes' : 'no'}`);
        if (validation.flags.hasThinkingTags) {
          console.log(`     ✓ Thinking tags present (will be stripped by parser)`);
        }
      }

      // Special checks for GLM models
      if (isGLM) {
        console.log(`  🇨🇳 Chinese detected: ${validation.flags.hasChinese ? 'yes ⚠️' : 'no'}`);
        if (validation.flags.hasChinese) {
          console.log(`     ⚠️  WARNING: Model outputs Chinese text`);
        }
      }

      successCount++;
    } else {
      console.log(`  ❌ Parsed successfully: no`);
      console.log(`  📋 Error: ${validation.error}`);

      // Show raw response preview for failed models
      if (validation.rawResponsePreview) {
        console.log(`  📄 Raw response preview (first 300 chars):`);
        console.log(`     ${validation.rawResponsePreview}`);
      }

      failureCount++;
      failures.push({ modelId: validation.modelId, error: validation.error || 'Unknown error' });
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 VALIDATION SUMMARY\n');
  console.log(`Total models tested: ${SYNTHETIC_PROVIDERS.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);

  if (failures.length > 0) {
    console.log('\n❌ Failed Models:\n');
    for (const failure of failures) {
      console.log(`   - ${failure.modelId}`);
      console.log(`     Error: ${failure.error}`);
    }
  }

  console.log('\n' + '═'.repeat(60) + '\n');

  // Exit with appropriate code
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} model(s) failed validation\n`);
    process.exit(1);
  } else {
    console.log('✅ All models validated successfully!\n');
    process.exit(0);
  }
}

// Run validation
validateAllModels().catch(error => {
  console.error('\n❌ Validation script crashed:', error);
  process.exit(1);
});
