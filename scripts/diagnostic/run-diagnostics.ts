/**
 * Diagnostic Runner Script
 *
 * Tests all 42 LLM models with diverse fixtures, captures raw responses,
 * categorizes failures, and generates actionable diagnostic reports.
 *
 * Fulfills DIAG-01 through DIAG-04 requirements:
 * - DIAG-01: Test each model with golden fixture data
 * - DIAG-02: Categorize failures into 6 categories
 * - DIAG-03: Calculate per-model success rates
 * - DIAG-04: Capture raw responses for debugging
 *
 * Usage: npm run diagnose
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import pLimit from 'p-limit';
import { writeFile, mkdir } from 'fs/promises';
import { ALL_PROVIDERS } from '../../src/lib/llm';
import {
  categorizeFailure,
  type DiagnosticResult,
  type FailureCategory,
} from './categorize-failure';
import {
  DIVERSE_SCENARIOS,
  buildTestPrompt,
  getAllScenarioIds,
} from '../../src/__tests__/fixtures/golden/diverse-scenarios';
import {
  getModelTimeout,
  REASONING_MODEL_IDS,
} from '../../src/__tests__/fixtures/test-data';
import { generateDiagnosticReport } from './generate-report';
import { PredictionOutputSchema } from '../../src/__tests__/schemas/prediction';
import type { LLMProvider } from '../../src/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONCURRENCY_LIMIT = 5; // Same as validate-all-models.ts to avoid rate limits
const DEFAULT_SCENARIO = 'standard'; // Use standard scenario for initial diagnostic
const RAW_RESPONSES_DIR = 'src/__tests__/diagnostic-results/raw-responses';
const REPORTS_DIR = 'src/__tests__/diagnostic-results/reports';

// ============================================================================
// CORE DIAGNOSTIC FUNCTION
// ============================================================================

/**
 * Run diagnostic test on a single model with a specific scenario.
 *
 * Uses predictBatch (not callAPI) to ensure response handlers apply.
 * Races prediction against timeout, validates with schema, categorizes failures.
 *
 * @param provider - LLM provider to test
 * @param scenarioId - Scenario ID from DIVERSE_SCENARIOS
 * @returns DiagnosticResult with all fields populated
 */
async function runDiagnostic(
  provider: LLMProvider,
  scenarioId: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  const prompt = buildTestPrompt(scenarioId);
  const matchId = `diag-${scenarioId}`;
  const timeout = getModelTimeout(provider.id);
  const providerType = provider.id.endsWith('-syn') ? 'synthetic' : 'together';

  try {
    // Race between API call and timeout
    const result = await Promise.race([
      provider.predictBatch(prompt, [matchId]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    const durationMs = Date.now() - start;

    // Success case: validate with schema
    if (result.success && result.predictions.has(matchId)) {
      const pred = result.predictions.get(matchId)!;

      // Validate with Zod schema
      const validation = PredictionOutputSchema.safeParse({
        match_id: matchId,
        home_score: pred.homeScore,
        away_score: pred.awayScore,
      });

      if (!validation.success) {
        // Validation failure: categorize
        const errorMsg = `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`;
        const categorized = categorizeFailure(provider.id, errorMsg, JSON.stringify(pred));

        return {
          modelId: provider.id,
          provider: providerType,
          success: false,
          error: errorMsg,
          rawResponse: JSON.stringify(pred),
          category: categorized.category,
          durationMs,
          timestamp: new Date().toISOString(),
          scenarioId,
        };
      }

      // Success with valid schema
      return {
        modelId: provider.id,
        provider: providerType,
        success: true,
        prediction: { homeScore: pred.homeScore, awayScore: pred.awayScore },
        rawResponse: JSON.stringify(pred),
        durationMs,
        timestamp: new Date().toISOString(),
        scenarioId,
      };
    }

    // predictBatch returned but without prediction - treat as failure
    const errorMsg = result.error || 'No prediction returned';
    const categorized = categorizeFailure(provider.id, errorMsg, '');

    return {
      modelId: provider.id,
      provider: providerType,
      success: false,
      error: errorMsg,
      rawResponse: '',
      category: categorized.category,
      durationMs,
      timestamp: new Date().toISOString(),
      scenarioId,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const categorized = categorizeFailure(provider.id, errorMsg, '');

    return {
      modelId: provider.id,
      provider: providerType,
      success: false,
      error: errorMsg,
      rawResponse: '',
      category: categorized.category,
      durationMs,
      timestamp: new Date().toISOString(),
      scenarioId,
    };
  }
}

// ============================================================================
// RAW RESPONSE CAPTURE
// ============================================================================

/**
 * Capture raw response to filesystem for debugging.
 *
 * Writes full DiagnosticResult as formatted JSON to:
 * src/__tests__/diagnostic-results/raw-responses/{modelId}.json
 *
 * @param result - DiagnosticResult to capture
 */
async function captureRawResponse(result: DiagnosticResult): Promise<void> {
  try {
    // Create directory recursively if needed
    await mkdir(RAW_RESPONSES_DIR, { recursive: true });

    // Write formatted JSON
    const filePath = path.join(RAW_RESPONSES_DIR, `${result.modelId}.json`);
    await writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');

    // Log capture confirmation (only on success to avoid console spam)
    if (result.success) {
      console.log(`  (captured to ${filePath})`);
    }
  } catch (error) {
    console.error(`  Failed to capture raw response for ${result.modelId}:`, error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n=== LLM Diagnostic Runner ===\n');

  // Check API keys
  const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
  const hasSyntheticKey = !!process.env.SYNTHETIC_API_KEY;

  console.log(`Together API: ${hasTogetherKey ? 'configured' : 'MISSING'}`);
  console.log(`Synthetic API: ${hasSyntheticKey ? 'configured' : 'MISSING'}\n`);

  if (!hasTogetherKey && !hasSyntheticKey) {
    console.warn('WARNING: No API keys configured. Set TOGETHER_API_KEY and/or SYNTHETIC_API_KEY in .env.local');
    console.log('Continuing with available models only...\n');
  }

  // Filter providers based on available API keys
  const providersToTest = ALL_PROVIDERS.filter(p => {
    if (p.id.endsWith('-syn')) {
      return hasSyntheticKey;
    }
    return hasTogetherKey;
  });

  if (providersToTest.length === 0) {
    console.error('ERROR: No models available to test (missing API keys)');
    process.exit(1);
  }

  console.log(`Testing ${providersToTest.length} models`);
  console.log(`Scenario: ${DEFAULT_SCENARIO} (${DIVERSE_SCENARIOS[DEFAULT_SCENARIO].description})`);
  console.log(`Concurrency: ${CONCURRENCY_LIMIT}`);
  console.log('');
  console.log('-'.repeat(80));

  // Run diagnostic with concurrency control
  const limit = pLimit(CONCURRENCY_LIMIT);
  const results: DiagnosticResult[] = await Promise.all(
    providersToTest.map(p =>
      limit(async () => {
        const emoji = p.id.endsWith('-syn') ? '[SYN]' : '[TOG]';
        process.stdout.write(`${emoji} Testing ${p.id}...`);

        const result = await runDiagnostic(p, DEFAULT_SCENARIO);

        // Capture raw response to filesystem
        await captureRawResponse(result);

        const status = result.success ? 'PASS' : `FAIL(${result.category})`;
        const details = result.success
          ? `${result.prediction?.homeScore}-${result.prediction?.awayScore} (${result.durationMs}ms)`
          : `${result.error?.slice(0, 50)}...`;
        console.log(` ${status} - ${details}`);

        return result;
      })
    )
  );

  // ============================================================================
  // CALCULATE STATISTICS
  // ============================================================================

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const successRate = (successful.length / results.length) * 100;

  // Group failures by category
  const failuresByCategory: Record<string, number> = {};
  for (const result of failed) {
    if (result.category) {
      failuresByCategory[result.category] = (failuresByCategory[result.category] || 0) + 1;
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log('\n=== DIAGNOSTIC SUMMARY ===\n');
  console.log(`Total tested: ${results.length}`);
  console.log(`Successful: ${successful.length}/${results.length} (${successRate.toFixed(1)}%)`);
  console.log(`Failed: ${failed.length}/${results.length}\n`);

  if (failed.length > 0) {
    console.log('Failure breakdown by category:');
    for (const [category, count] of Object.entries(failuresByCategory)) {
      console.log(`  - ${category}: ${count} models`);
    }
    console.log('');
  }

  // ============================================================================
  // GENERATE MARKDOWN REPORT
  // ============================================================================

  console.log('Generating diagnostic report...');

  const report = generateDiagnosticReport(results);

  // Save report to filesystem with date in filename
  const reportDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `diagnostic-${reportDate}.md`);
  await writeFile(reportPath, report, 'utf-8');

  console.log(`Report saved to: ${reportPath}`);
  console.log(`Raw responses saved to: ${RAW_RESPONSES_DIR}/\n`);

  console.log('-'.repeat(80) + '\n');

  // Exit code 0 always (diagnostic, not gating)
  process.exit(0);
}

// Run diagnostic
main().catch(error => {
  console.error('\nDiagnostic script crashed:', error);
  process.exit(1);
});
