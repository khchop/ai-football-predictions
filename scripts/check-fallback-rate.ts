/**
 * Check Fallback Rate Script
 *
 * Validates production fallback rates from the predictions table.
 * Confirms:
 * - Global fallback rate remains <5% (requirement)
 * - Models with fallback configured have >90% success rate
 *
 * Usage: npm run check:fallback
 * Exit code: 0 = validation passed, 1 = validation failed
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { MODEL_FALLBACKS } from '../src/lib/llm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FALLBACK_THRESHOLD = 0.05; // 5% - maximum acceptable fallback rate
const SUCCESS_THRESHOLD = 0.90; // 90% - minimum success rate for models with fallbacks
const MIN_SAMPLES = 10; // Minimum predictions to evaluate a model
const DAYS_TO_CHECK = 7; // Look back period

// ============================================================================
// TYPES
// ============================================================================

interface FallbackCheck {
  modelId: string;
  totalPredictions: number;
  fallbackCount: number;
  fallbackRate: number;
  successRate: number;
}

// ============================================================================
// DATABASE QUERY
// ============================================================================

/**
 * Get fallback statistics from predictions table
 * Note: Schema uses snake_case column names (model_id, created_at, used_fallback)
 */
async function getFallbackStats(days: number = 7): Promise<FallbackCheck[]> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffIso = cutoffDate.toISOString();

  // Use raw SQL with proper column names (snake_case in database)
  const result = await db.execute<{
    model_id: string;
    total_predictions: string;
    fallback_count: string;
  }>(sql`
    SELECT
      model_id,
      COUNT(*)::text as total_predictions,
      SUM(CASE WHEN used_fallback = true THEN 1 ELSE 0 END)::text as fallback_count
    FROM predictions
    WHERE created_at >= ${cutoffIso}::timestamptz
    GROUP BY model_id
    ORDER BY COUNT(*) DESC
  `);

  return result.rows.map(row => {
    const total = parseInt(row.total_predictions, 10);
    const fallback = parseInt(row.fallback_count, 10);
    return {
      modelId: row.model_id,
      totalPredictions: total,
      fallbackCount: fallback,
      fallbackRate: total > 0 ? fallback / total : 0,
      successRate: total > 0 ? (total - fallback) / total : 0,
    };
  });
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

async function main() {
  console.log('\n=== Fallback Rate Check ===\n');
  console.log(`Configuration:`);
  console.log(`  Global fallback threshold: <${(FALLBACK_THRESHOLD * 100)}%`);
  console.log(`  Model success threshold: >${(SUCCESS_THRESHOLD * 100)}%`);
  console.log(`  Minimum samples: ${MIN_SAMPLES}`);
  console.log(`  Period: last ${DAYS_TO_CHECK} days`);
  console.log('');

  const stats = await getFallbackStats(DAYS_TO_CHECK);

  // Calculate global fallback rate
  const globalStats = stats.reduce((acc, s) => {
    acc.total += s.totalPredictions;
    acc.fallback += s.fallbackCount;
    return acc;
  }, { total: 0, fallback: 0 });

  const globalFallbackRate = globalStats.total > 0
    ? globalStats.fallback / globalStats.total
    : 0;

  // Global stats output
  console.log('-'.repeat(60));
  console.log('\n=== GLOBAL STATISTICS ===\n');
  console.log(`Total predictions: ${globalStats.total}`);
  console.log(`Fallback count: ${globalStats.fallback}`);
  console.log(`Fallback rate: ${(globalFallbackRate * 100).toFixed(2)}%`);
  console.log(`Threshold: <${(FALLBACK_THRESHOLD * 100)}%`);

  // Check global threshold
  const globalPassed = globalFallbackRate < FALLBACK_THRESHOLD;
  console.log(`Status: ${globalPassed ? 'PASS' : 'FAIL'}`);

  // Check models with configured fallbacks
  console.log('\n' + '-'.repeat(60));
  console.log('\n=== MODELS WITH FALLBACK CONFIGURED ===\n');

  const modelsWithFallback = Object.keys(MODEL_FALLBACKS);
  console.log(`Configured fallback mappings: ${modelsWithFallback.length}`);
  for (const [source, target] of Object.entries(MODEL_FALLBACKS)) {
    console.log(`  ${source} -> ${target}`);
  }
  console.log('');

  let failedModels = 0;
  let skippedModels = 0;
  const modelResults: { modelId: string; status: string; details: string }[] = [];

  for (const modelId of modelsWithFallback) {
    const modelStats = stats.find(s => s.modelId === modelId);

    if (!modelStats || modelStats.totalPredictions < MIN_SAMPLES) {
      const samples = modelStats?.totalPredictions || 0;
      modelResults.push({
        modelId,
        status: 'SKIP',
        details: `Insufficient data (${samples}/${MIN_SAMPLES} samples)`,
      });
      skippedModels++;
      continue;
    }

    const passed = modelStats.successRate >= SUCCESS_THRESHOLD;
    const status = passed ? 'PASS' : 'FAIL';
    modelResults.push({
      modelId,
      status,
      details: `${(modelStats.successRate * 100).toFixed(1)}% success (${modelStats.totalPredictions} samples, ${modelStats.fallbackCount} fallbacks)`,
    });

    if (!passed) failedModels++;
  }

  // Print model results
  console.log('Model validation:');
  for (const result of modelResults) {
    console.log(`  [${result.status}] ${result.modelId}: ${result.details}`);
  }

  // Print all models with any fallback activity
  console.log('\n' + '-'.repeat(60));
  console.log('\n=== ALL MODELS WITH FALLBACK ACTIVITY ===\n');

  const modelsWithActivity = stats.filter(s => s.fallbackCount > 0);
  if (modelsWithActivity.length === 0) {
    console.log('No fallback activity in the period.');
  } else {
    console.log('Model                          | Total | Fallbacks | Rate');
    console.log('-'.repeat(60));
    for (const m of modelsWithActivity) {
      const modelIdPadded = m.modelId.padEnd(30);
      const totalPadded = String(m.totalPredictions).padStart(5);
      const fallbackPadded = String(m.fallbackCount).padStart(9);
      const ratePadded = `${(m.fallbackRate * 100).toFixed(1)}%`.padStart(6);
      console.log(`${modelIdPadded} | ${totalPadded} | ${fallbackPadded} | ${ratePadded}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n=== SUMMARY ===\n');
  console.log(`Global fallback rate: ${globalPassed ? 'PASS' : 'FAIL'} (${(globalFallbackRate * 100).toFixed(2)}% vs <${(FALLBACK_THRESHOLD * 100)}%)`);
  console.log(`Models with fallback configured: ${modelsWithFallback.length - skippedModels} evaluated, ${skippedModels} skipped (insufficient data)`);
  console.log(`Models below ${(SUCCESS_THRESHOLD * 100)}% threshold: ${failedModels}`);

  // Final verdict
  console.log('\n' + '='.repeat(60));
  console.log('\n=== FINAL VERDICT ===\n');

  if (!globalPassed) {
    console.log(`FAIL: Global fallback rate ${(globalFallbackRate * 100).toFixed(2)}% exceeds ${(FALLBACK_THRESHOLD * 100)}% threshold`);
  }

  if (failedModels > 0) {
    console.log(`FAIL: ${failedModels} model(s) with fallback configured below ${(SUCCESS_THRESHOLD * 100)}% success rate`);
  }

  // Exit code
  if (!globalPassed || failedModels > 0) {
    console.log('\nValidation FAILED');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }

  console.log('Validation PASSED');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
}

// ============================================================================
// EXECUTION
// ============================================================================

main()
  .catch(error => {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    // Check for nested cause
    if (error && typeof error === 'object' && 'cause' in error) {
      console.error('\nCause:', error.cause);
    }
    process.exit(1);
  })
  .finally(() => {
    // Allow connection pool to drain before exit
    setTimeout(() => process.exit(0), 100);
  });
