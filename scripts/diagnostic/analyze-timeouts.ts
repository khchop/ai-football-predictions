/**
 * Timeout Analysis Script
 *
 * Analyzes diagnostic raw response data to recommend per-model timeouts
 * based on P95 latency + 20% safety margin.
 *
 * Usage: npx tsx scripts/diagnostic/analyze-timeouts.ts
 *
 * If diagnostic data exists, calculates P50/P95/P99 from actual latency.
 * If no data exists, prints conservative default recommendations.
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { DiagnosticResult } from './categorize-failure';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RAW_RESPONSE_DIR = path.join(
  process.cwd(),
  'src/__tests__/diagnostic-results/raw-responses'
);

const REASONING_MODELS = [
  'deepseek-r1',
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
];

// Default recommendations based on industry data (Azure, vendor docs)
const DEFAULT_TIMEOUTS = {
  'deepseek-r1': 120000,
  'deepseek-r1-0528-syn': 120000,
  'kimi-k2-thinking-syn': 90000,
  'qwen3-235b-thinking-syn': 120000,
} as const;

// ============================================================================
// STATISTICS
// ============================================================================

interface LatencyStats {
  modelId: string;
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  currentTimeout: number;
  recommendedTimeout: number;
  action: 'INCREASE' | 'KEEP';
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Round up to nearest 5 seconds
 */
function roundUpToNearest5s(ms: number): number {
  return Math.ceil(ms / 5000) * 5000;
}

/**
 * Calculate timeout recommendation from latency data
 * Formula: P95 * 1.2 (20% safety margin), rounded up to nearest 5s
 */
function calculateRecommendedTimeout(p95: number): number {
  return roundUpToNearest5s(p95 * 1.2);
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load all diagnostic results from raw response files
 */
async function loadDiagnosticResults(): Promise<DiagnosticResult[]> {
  try {
    const files = await readdir(RAW_RESPONSE_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const results: DiagnosticResult[] = [];
    for (const file of jsonFiles) {
      const filePath = path.join(RAW_RESPONSE_DIR, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as DiagnosticResult[];
      results.push(...data);
    }

    return results;
  } catch (error) {
    // Directory doesn't exist or no files
    return [];
  }
}

/**
 * Analyze latency for each reasoning model
 */
function analyzeLatency(
  results: DiagnosticResult[],
  currentTimeouts: Map<string, number>
): LatencyStats[] {
  const stats: LatencyStats[] = [];

  for (const modelId of REASONING_MODELS) {
    const modelResults = results.filter(
      (r) => r.modelId === modelId && r.success && r.durationMs > 0
    );

    if (modelResults.length === 0) {
      // No data for this model
      continue;
    }

    const durations = modelResults
      .map((r) => r.durationMs)
      .sort((a, b) => a - b);

    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);
    const max = durations[durations.length - 1];

    const recommendedTimeout = calculateRecommendedTimeout(p95);
    const currentTimeout = currentTimeouts.get(modelId) || 60000;

    stats.push({
      modelId,
      samples: durations.length,
      p50,
      p95,
      p99,
      max,
      currentTimeout,
      recommendedTimeout,
      action: recommendedTimeout > currentTimeout ? 'INCREASE' : 'KEEP',
    });
  }

  return stats;
}

// ============================================================================
// OUTPUT
// ============================================================================

/**
 * Print data-driven recommendations table
 */
function printDataDrivenRecommendations(stats: LatencyStats[]): void {
  console.log('='.repeat(80));
  console.log('TIMEOUT ANALYSIS - DATA-DRIVEN RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');

  console.log(
    'Model ID'.padEnd(30),
    'Samples'.padEnd(8),
    'P50'.padEnd(8),
    'P95'.padEnd(8),
    'Current'.padEnd(10),
    'Recommended'.padEnd(12),
    'Action'
  );
  console.log('-'.repeat(80));

  for (const stat of stats) {
    const p50Display = `${Math.round(stat.p50 / 1000)}s`;
    const p95Display = `${Math.round(stat.p95 / 1000)}s`;
    const currentDisplay = `${Math.round(stat.currentTimeout / 1000)}s`;
    const recommendedDisplay = `${Math.round(stat.recommendedTimeout / 1000)}s`;

    console.log(
      stat.modelId.padEnd(30),
      stat.samples.toString().padEnd(8),
      p50Display.padEnd(8),
      p95Display.padEnd(8),
      currentDisplay.padEnd(10),
      recommendedDisplay.padEnd(12),
      stat.action
    );
  }

  console.log('');
  console.log('Formula: P95 * 1.2 (20% safety margin), rounded to nearest 5s');
  console.log('');
}

/**
 * Print default recommendations when no data exists
 */
function printDefaultRecommendations(): void {
  console.log('='.repeat(80));
  console.log('TIMEOUT ANALYSIS - DEFAULT RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');
  console.log('WARNING: No diagnostic data found.');
  console.log('Run `npm run diagnose` first for data-driven tuning.');
  console.log('');
  console.log('Using conservative defaults based on industry data:');
  console.log('');

  console.log('Model ID'.padEnd(35), 'Recommended Timeout'.padEnd(20), 'Rationale');
  console.log('-'.repeat(80));

  console.log(
    'deepseek-r1'.padEnd(35),
    '120000ms (2 min)'.padEnd(20),
    'Azure reports 2-min needed'
  );
  console.log(
    'deepseek-r1-0528-syn'.padEnd(35),
    '120000ms (2 min)'.padEnd(20),
    'Same model, different host'
  );
  console.log(
    'kimi-k2-thinking-syn'.padEnd(35),
    '90000ms (90s)'.padEnd(20),
    'Conservative default'
  );
  console.log(
    'qwen3-235b-thinking-syn'.padEnd(35),
    '120000ms (2 min)'.padEnd(20),
    'Large thinking model'
  );

  console.log('');
  console.log('These are conservative defaults. Run diagnostics for precise tuning.');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Current timeout values (read from code or config)
  const currentTimeouts = new Map<string, number>([
    ['deepseek-r1', 60000],
    ['deepseek-r1-0528-syn', 60000],
    ['kimi-k2-thinking-syn', 60000],
    ['qwen3-235b-thinking-syn', 90000],
  ]);

  // Load diagnostic data
  const results = await loadDiagnosticResults();

  if (results.length === 0) {
    // No data - print defaults
    printDefaultRecommendations();
    return;
  }

  // Analyze and print data-driven recommendations
  const stats = analyzeLatency(results, currentTimeouts);

  if (stats.length === 0) {
    console.log('No successful reasoning model results found in diagnostic data.');
    console.log('');
    printDefaultRecommendations();
    return;
  }

  printDataDrivenRecommendations(stats);
}

main().catch((error) => {
  console.error('Error analyzing timeouts:', error);
  process.exit(1);
});
