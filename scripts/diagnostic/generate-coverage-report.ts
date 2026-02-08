/**
 * Phase 57 Coverage Assessment Report Generator
 *
 * Generates a comprehensive coverage assessment from diagnostic results,
 * combining per-model diagnostic outcomes with fallback configuration and
 * model inventory data.
 *
 * Reads:
 * - Diagnostic result JSON files from src/__tests__/diagnostic-results/raw-responses/
 * - MODEL_PROVIDER_ROUTES from src/lib/llm/index.ts for fallback status
 * - ALL_PROVIDERS from src/lib/llm for full model inventory
 *
 * Writes:
 * - Markdown report to src/__tests__/diagnostic-results/reports/coverage-assessment.md
 *
 * Usage: npx tsx scripts/diagnostic/generate-coverage-report.ts
 */

import path from 'path';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { ALL_PROVIDERS, MODEL_PROVIDER_ROUTES } from '../../src/lib/llm';
import {
  type DiagnosticResult,
  type FailureCategory,
  FIX_RECOMMENDATIONS,
} from './categorize-failure';
import { PromptVariant } from '../../src/lib/llm/prompt-variants';
import { ResponseHandler } from '../../src/lib/llm/response-handlers';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RAW_RESPONSES_DIR = 'src/__tests__/diagnostic-results/raw-responses';
const REPORTS_DIR = 'src/__tests__/diagnostic-results/reports';
const REPORT_FILENAME = 'coverage-assessment.md';

/** Phase 57 target success rate */
const TARGET_SUCCESS_RATE = 95;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Coverage status classification for each model.
 * - PASS: Valid prediction JSON produced
 * - FAIL-FIXABLE: Failed but has fallback or config that could help
 * - FAIL-UNFIXABLE: Failed, no fallback available, all configs applied
 * - SKIP: Model was not tested (API key missing, etc.)
 */
type CoverageStatus = 'PASS' | 'FAIL-FIXABLE' | 'FAIL-UNFIXABLE' | 'SKIP';

/** Severity based on model tier/importance */
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ModelCoverageEntry {
  modelId: string;
  provider: 'together' | 'synthetic';
  status: CoverageStatus;
  hasFallback: boolean;
  fallbackTarget: string | null;
  promptVariant: string;
  responseHandler: string;
  hasSpecialConfig: boolean;
  category: FailureCategory | null;
  error: string | null;
  severity: Severity;
  notes: string;
  rawResponse?: string;
  durationMs?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load all diagnostic result JSON files from the raw-responses directory.
 *
 * @returns Map of modelId to DiagnosticResult, or null if directory doesn't exist
 */
async function loadDiagnosticResults(): Promise<Map<string, DiagnosticResult> | null> {
  if (!existsSync(RAW_RESPONSES_DIR)) {
    return null;
  }

  const files = await readdir(RAW_RESPONSES_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    return null;
  }

  const results = new Map<string, DiagnosticResult>();

  for (const file of jsonFiles) {
    try {
      const content = await readFile(path.join(RAW_RESPONSES_DIR, file), 'utf-8');
      const result: DiagnosticResult = JSON.parse(content);
      results.set(result.modelId, result);
    } catch {
      // Skip malformed files silently
      console.warn(`  Warning: Could not parse ${file}, skipping`);
    }
  }

  return results;
}

/**
 * Determine model severity based on provider type and tier.
 * Uses the same tier logic as validate-coverage.ts.
 *
 * - CRITICAL: Core Together AI models (budget/premium tier)
 * - HIGH: Premium Synthetic or Together premium models
 * - MEDIUM: Budget-tier models
 * - LOW: Ultra-budget and niche/exclusive models
 */
function getModelSeverity(provider: typeof ALL_PROVIDERS[number]): Severity {
  // Access tier through provider implementation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerImpl = provider as any;
  const tier = providerImpl.tier as string | undefined;
  const isSynthetic = provider.name === 'synthetic';

  if (provider.isPremium) {
    return isSynthetic ? 'HIGH' : 'CRITICAL';
  }

  switch (tier) {
    case 'premium':
      return 'CRITICAL';
    case 'budget':
      return 'MEDIUM';
    case 'ultra-budget':
    case 'free':
      return 'LOW';
    default:
      return isSynthetic ? 'LOW' : 'MEDIUM';
  }
}

/**
 * Get prompt config for a provider (promptVariant and responseHandler).
 * Follows same pattern as validate-coverage.ts.
 */
function getProviderConfig(provider: typeof ALL_PROVIDERS[number]): {
  promptVariant: string;
  responseHandler: string;
  hasSpecialConfig: boolean;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerImpl = provider as any;
  const promptConfig = providerImpl.promptConfig as {
    promptVariant?: PromptVariant;
    responseHandler?: ResponseHandler;
  } | undefined;

  const promptVariant = promptConfig?.promptVariant || PromptVariant.BASE;
  const responseHandler = promptConfig?.responseHandler || ResponseHandler.DEFAULT;
  const hasSpecialConfig = promptVariant !== PromptVariant.BASE || responseHandler !== ResponseHandler.DEFAULT;

  return { promptVariant, responseHandler, hasSpecialConfig };
}

/**
 * Classify a model into a CoverageStatus based on diagnostic result and config.
 */
function classifyModel(
  provider: typeof ALL_PROVIDERS[number],
  diagnosticResult: DiagnosticResult | undefined,
  config: { hasSpecialConfig: boolean; hasFallback: boolean }
): { status: CoverageStatus; notes: string } {
  // Not tested
  if (!diagnosticResult) {
    return { status: 'SKIP', notes: 'Not tested (API key missing or model excluded)' };
  }

  // Passed
  if (diagnosticResult.success) {
    return { status: 'PASS', notes: 'Valid prediction produced' };
  }

  // Failed - check if fixable
  const isSynthetic = provider.name === 'synthetic';

  // Has fallback available -> fixable
  if (config.hasFallback) {
    return {
      status: 'FAIL-FIXABLE',
      notes: `Has fallback route configured`,
    };
  }

  // Has special config but still failed -> check if more config could help
  if (!config.hasSpecialConfig && isSynthetic) {
    return {
      status: 'FAIL-FIXABLE',
      notes: 'Default config - could benefit from specialized prompt/handler',
    };
  }

  // Together AI models can potentially get additional fixes
  if (!isSynthetic) {
    return {
      status: 'FAIL-FIXABLE',
      notes: 'Together AI model - prompt/handler tuning available',
    };
  }

  // Synthetic, no fallback, special config already applied
  return {
    status: 'FAIL-UNFIXABLE',
    notes: 'Synthetic exclusive, no fallback, config already applied',
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Format date as YYYY-MM-DD HH:MM:SS UTC
 */
function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Generate the full coverage assessment report markdown.
 */
function generateCoverageReport(entries: ModelCoverageEntry[]): string {
  const now = new Date();

  const passCount = entries.filter(e => e.status === 'PASS').length;
  const failFixableCount = entries.filter(e => e.status === 'FAIL-FIXABLE').length;
  const failUnfixableCount = entries.filter(e => e.status === 'FAIL-UNFIXABLE').length;
  const skipCount = entries.filter(e => e.status === 'SKIP').length;
  const testedCount = entries.length - skipCount;
  const successRate = testedCount > 0 ? (passCount / testedCount) * 100 : 0;
  const meetsTarget = successRate >= TARGET_SUCCESS_RATE;

  let report = '';

  // ============================================================================
  // HEADER
  // ============================================================================

  report += `# Phase 57 Coverage Assessment Report\n\n`;
  report += `**Generated:** ${formatDate(now)}\n`;
  report += `**Total Models in Inventory:** ${entries.length}\n`;
  report += `**Models Tested:** ${testedCount}\n`;
  report += `**Target Success Rate:** ${TARGET_SUCCESS_RATE}%\n\n`;

  // ============================================================================
  // EXECUTIVE SUMMARY
  // ============================================================================

  report += `## Executive Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Models Passing | ${passCount}/${testedCount} (${successRate.toFixed(1)}%) |\n`;
  report += `| Models Failing (Fixable) | ${failFixableCount} |\n`;
  report += `| Models Failing (Unfixable) | ${failUnfixableCount} |\n`;
  report += `| Models Skipped | ${skipCount} |\n`;
  report += `| Target (${TARGET_SUCCESS_RATE}%) | ${meetsTarget ? 'MET' : 'NOT MET'} |\n`;
  report += `\n`;

  if (meetsTarget) {
    report += `**Result:** Success rate of ${successRate.toFixed(1)}% meets the Phase 57 target of ${TARGET_SUCCESS_RATE}%.\n\n`;
  } else {
    const modelsNeeded = Math.ceil((TARGET_SUCCESS_RATE / 100) * testedCount) - passCount;
    report += `**Result:** Success rate of ${successRate.toFixed(1)}% does NOT meet the Phase 57 target of ${TARGET_SUCCESS_RATE}%. `;
    report += `Need ${modelsNeeded} more model(s) passing to reach target.\n\n`;
  }

  // ============================================================================
  // MODEL COVERAGE MATRIX
  // ============================================================================

  report += `## Model Coverage Matrix\n\n`;
  report += `| Model ID | Provider | Status | Fallback | Config | Category | Notes |\n`;
  report += `|----------|----------|--------|----------|--------|----------|-------|\n`;

  // Sort: FAIL-UNFIXABLE first, then FAIL-FIXABLE, then SKIP, then PASS
  const statusOrder: Record<CoverageStatus, number> = {
    'FAIL-UNFIXABLE': 0,
    'FAIL-FIXABLE': 1,
    'SKIP': 2,
    'PASS': 3,
  };

  const sorted = [...entries].sort((a, b) => {
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return a.modelId.localeCompare(b.modelId);
  });

  for (const entry of sorted) {
    const fallback = entry.hasFallback ? `-> ${entry.fallbackTarget}` : '-';
    const config = entry.hasSpecialConfig
      ? `${entry.promptVariant}/${entry.responseHandler}`
      : 'default';
    const category = entry.category || '-';
    const notes = entry.notes.length > 60
      ? entry.notes.slice(0, 57) + '...'
      : entry.notes;

    report += `| \`${entry.modelId}\` | ${entry.provider} | **${entry.status}** | ${fallback} | ${config} | ${category} | ${notes} |\n`;
  }

  report += `\n`;

  // ============================================================================
  // FAILURE ANALYSIS
  // ============================================================================

  const failingEntries = entries.filter(e => e.status === 'FAIL-FIXABLE' || e.status === 'FAIL-UNFIXABLE');

  if (failingEntries.length > 0) {
    report += `## Failure Analysis\n\n`;

    // Group by category
    const byCategory: Record<string, ModelCoverageEntry[]> = {};
    for (const entry of failingEntries) {
      const cat = entry.category || 'unknown';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(entry);
    }

    // Sort categories by count (most common first)
    const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);

    for (const [category, categoryEntries] of sortedCategories) {
      report += `### ${category.toUpperCase()} (${categoryEntries.length} model${categoryEntries.length > 1 ? 's' : ''})\n\n`;

      for (const entry of categoryEntries) {
        report += `**\`${entry.modelId}\`** (${entry.provider})\n`;
        report += `- **Status:** ${entry.status}\n`;
        report += `- **Severity:** ${entry.severity}\n`;
        report += `- **Error:** ${entry.error || 'N/A'}\n`;
        report += `- **Fallback Available:** ${entry.hasFallback ? `Yes (-> ${entry.fallbackTarget})` : 'No'}\n`;
        report += `- **Current Config:** ${entry.hasSpecialConfig ? `${entry.promptVariant} + ${entry.responseHandler}` : 'Default (BASE + DEFAULT)'}\n`;

        // Mitigation plan based on status
        if (entry.status === 'FAIL-FIXABLE') {
          if (entry.hasFallback) {
            report += `- **Mitigation:** Fallback to \`${entry.fallbackTarget}\` on failure\n`;
          } else {
            const fix = entry.category ? FIX_RECOMMENDATIONS[entry.category as FailureCategory] : 'Review raw response';
            report += `- **Mitigation:** ${fix}\n`;
          }
        } else {
          report += `- **Mitigation:** Auto-disable after consecutive failures; document as accepted limitation\n`;
        }

        report += `\n`;
      }
    }
  }

  // ============================================================================
  // UNFIXABLE MODELS (following research template)
  // ============================================================================

  const unfixableEntries = entries.filter(e => e.status === 'FAIL-UNFIXABLE');
  const skipEntries = entries.filter(e => e.status === 'SKIP');

  if (unfixableEntries.length > 0 || skipEntries.length > 0) {
    report += `## Unfixable / Skipped Models\n\n`;

    if (unfixableEntries.length > 0) {
      report += `### Unfixable (${unfixableEntries.length} model${unfixableEntries.length > 1 ? 's' : ''})\n\n`;
      report += `These models have no Together AI fallback, special configs already applied, and still fail.\n\n`;

      for (const entry of unfixableEntries) {
        report += `#### Model: ${entry.modelId}\n`;
        report += `- **Provider:** ${entry.provider === 'synthetic' ? 'Synthetic' : 'Together AI'}\n`;
        report += `- **Failure Category:** ${entry.category || 'Unknown'}\n`;
        report += `- **Root Cause:** ${entry.error || 'Unknown'}\n`;
        report += `- **Fallback Available:** No${entry.provider === 'synthetic' ? ' (Synthetic exclusive, no Together AI equivalent)' : ''}\n`;
        report += `- **Config Applied:** ${entry.hasSpecialConfig ? `${entry.promptVariant} + ${entry.responseHandler}` : 'Default'}\n`;
        report += `- **Severity:** ${entry.severity}\n`;
        report += `- **Mitigation Plan:**\n`;
        report += `  - Auto-disable after 5 consecutive failures\n`;
        report += `  - Admin notification when disabled\n`;
        report += `  - Redirect predictions to alternative models in same tier\n`;
        report += `- **Status:** SKIP (accepted limitation)\n\n`;
      }
    }

    if (skipEntries.length > 0) {
      report += `### Skipped (${skipEntries.length} model${skipEntries.length > 1 ? 's' : ''})\n\n`;
      report += `These models were not tested (API key missing or excluded from diagnostic run).\n\n`;

      for (const entry of skipEntries) {
        report += `- \`${entry.modelId}\` (${entry.provider}): ${entry.notes}\n`;
      }

      report += `\n`;
    }
  }

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  report += `## Recommendations\n\n`;

  if (meetsTarget && failingEntries.length === 0) {
    report += `All models passing. No further action required.\n\n`;
  } else {
    report += `### Priority Actions\n\n`;

    // Critical/High severity failures first
    const criticalFailures = failingEntries.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
    if (criticalFailures.length > 0) {
      report += `**1. Fix Critical/High Severity Failures (${criticalFailures.length} models)**\n`;
      for (const entry of criticalFailures) {
        report += `   - \`${entry.modelId}\`: ${entry.category || 'unknown'} - ${entry.status === 'FAIL-FIXABLE' ? 'fixable' : 'needs acceptance'}\n`;
      }
      report += `\n`;
    }

    // Fixable failures
    const fixable = failingEntries.filter(e => e.status === 'FAIL-FIXABLE');
    if (fixable.length > 0) {
      report += `**${criticalFailures.length > 0 ? '2' : '1'}. Address Fixable Failures (${fixable.length} models)**\n`;
      report += `   Apply recommended fixes from Failure Analysis section above.\n`;
      report += `   Re-run diagnostics after each fix to measure improvement.\n\n`;
    }

    // Unfixable acceptance
    if (unfixableEntries.length > 0) {
      report += `**${criticalFailures.length > 0 && fixable.length > 0 ? '3' : '2'}. Accept Unfixable Limitations (${unfixableEntries.length} models)**\n`;
      report += `   Document in production runbook. Ensure auto-disable is configured.\n\n`;
    }

    // Skipped models
    if (skipEntries.length > 0) {
      report += `**Note:** ${skipEntries.length} model(s) were not tested. Run \`npm run diagnose\` with all API keys configured for complete coverage.\n\n`;
    }
  }

  // ============================================================================
  // FOOTER
  // ============================================================================

  report += `---\n\n`;
  report += `*Report generated by \`scripts/diagnostic/generate-coverage-report.ts\`*\n`;
  report += `*Raw diagnostic data: \`${RAW_RESPONSES_DIR}/\`*\n`;
  report += `*Run \`npm run diagnose\` to refresh diagnostic results before regenerating this report.*\n`;

  return report;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('\n=== Phase 57 Coverage Assessment Generator ===\n');

  // Load diagnostic results
  const diagnosticResults = await loadDiagnosticResults();

  if (!diagnosticResults || diagnosticResults.size === 0) {
    console.log('No diagnostic results found. Run \'npm run diagnose\' first.');
    process.exit(0);
  }

  console.log(`Loaded ${diagnosticResults.size} diagnostic result(s)`);
  console.log(`Model inventory: ${ALL_PROVIDERS.length} providers`);
  // Count providers with fallbacks (all except last in each route)
  let fallbackMappingCount = 0;
  for (const providers of Object.values(MODEL_PROVIDER_ROUTES)) {
    fallbackMappingCount += Math.max(0, providers.length - 1);
  }
  console.log(`Fallback mappings: ${fallbackMappingCount}`);
  console.log('');

  // Build coverage entries for all models in inventory
  const entries: ModelCoverageEntry[] = [];

  for (const provider of ALL_PROVIDERS) {
    const isSynthetic = provider.name === 'synthetic';
    const providerType: 'together' | 'synthetic' = isSynthetic ? 'synthetic' : 'together';
    // Check if this provider has a fallback in any route
    let hasFallback = false;
    let fallbackTarget: string | null = null;
    for (const providers of Object.values(MODEL_PROVIDER_ROUTES)) {
      const idx = providers.indexOf(provider.id);
      if (idx !== -1 && idx < providers.length - 1) {
        hasFallback = true;
        fallbackTarget = providers[idx + 1];
        break;
      }
    }
    const config = getProviderConfig(provider);
    const severity = getModelSeverity(provider);
    const diagnosticResult = diagnosticResults.get(provider.id);

    const { status, notes } = classifyModel(provider, diagnosticResult, {
      hasSpecialConfig: config.hasSpecialConfig,
      hasFallback,
    });

    entries.push({
      modelId: provider.id,
      provider: providerType,
      status,
      hasFallback,
      fallbackTarget,
      promptVariant: config.promptVariant,
      responseHandler: config.responseHandler,
      hasSpecialConfig: config.hasSpecialConfig,
      category: diagnosticResult?.category || null,
      error: diagnosticResult?.error || null,
      severity,
      notes,
      rawResponse: diagnosticResult?.rawResponse,
      durationMs: diagnosticResult?.durationMs,
    });
  }

  // Generate report
  const report = generateCoverageReport(entries);

  // Write report
  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, REPORT_FILENAME);
  await writeFile(reportPath, report, 'utf-8');

  // Print summary to stdout
  const passCount = entries.filter(e => e.status === 'PASS').length;
  const failFixableCount = entries.filter(e => e.status === 'FAIL-FIXABLE').length;
  const failUnfixableCount = entries.filter(e => e.status === 'FAIL-UNFIXABLE').length;
  const skipCount = entries.filter(e => e.status === 'SKIP').length;
  const testedCount = entries.length - skipCount;
  const successRate = testedCount > 0 ? (passCount / testedCount) * 100 : 0;

  console.log('--- Coverage Summary ---');
  console.log(`  PASS:            ${passCount}`);
  console.log(`  FAIL-FIXABLE:    ${failFixableCount}`);
  console.log(`  FAIL-UNFIXABLE:  ${failUnfixableCount}`);
  console.log(`  SKIP:            ${skipCount}`);
  console.log(`  Success Rate:    ${successRate.toFixed(1)}% (target: ${TARGET_SUCCESS_RATE}%)`);
  console.log(`  Target Met:      ${successRate >= TARGET_SUCCESS_RATE ? 'YES' : 'NO'}`);
  console.log('');
  console.log(`Report saved to: ${reportPath}`);
  console.log('');

  process.exit(0);
}

main().catch(error => {
  console.error('\nCoverage report generation failed:', error);
  process.exit(1);
});
