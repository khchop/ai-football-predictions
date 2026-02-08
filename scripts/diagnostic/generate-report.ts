/**
 * Diagnostic Report Generator
 *
 * Generates formatted markdown reports from diagnostic results.
 * Includes summary stats, failure breakdown by category with fix recommendations,
 * and per-model results table sorted by status and duration.
 */

import {
  type DiagnosticResult,
  FailureCategory,
  FIX_RECOMMENDATIONS,
} from './categorize-failure';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Group failed results by their failure category.
 *
 * @param results - Array of diagnostic results
 * @returns Record mapping category to array of failed results
 */
export function groupByCategory(
  results: DiagnosticResult[]
): Record<string, DiagnosticResult[]> {
  const grouped: Record<string, DiagnosticResult[]> = {};

  for (const result of results) {
    if (!result.success && result.category) {
      if (!grouped[result.category]) {
        grouped[result.category] = [];
      }
      grouped[result.category].push(result);
    }
  }

  return grouped;
}

/**
 * Format date as YYYY-MM-DD HH:MM:SS UTC
 */
function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate a complete markdown diagnostic report.
 *
 * @param results - Array of diagnostic results from all tested models
 * @returns Formatted markdown string
 */
export function generateDiagnosticReport(results: DiagnosticResult[]): string {
  const now = new Date();
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const successRate = (successful.length / results.length) * 100;

  let report = '';

  // ============================================================================
  // HEADER
  // ============================================================================

  report += `# Diagnostic Report - ${now.toISOString().split('T')[0]}\n\n`;

  // ============================================================================
  // METADATA
  // ============================================================================

  report += `**Generated:** ${formatDate(now)}\n`;
  report += `**Total Models Tested:** ${results.length}\n\n`;

  // ============================================================================
  // SUMMARY
  // ============================================================================

  report += `## Summary\n\n`;
  report += `**Success Rate:** ${successful.length}/${results.length} (${successRate.toFixed(1)}%)\n\n`;
  report += `- **Passed:** ${successful.length} models\n`;
  report += `- **Failed:** ${failed.length} models\n\n`;

  // ============================================================================
  // FAILURE DISTRIBUTION
  // ============================================================================

  if (failed.length > 0) {
    const failuresByCategory: Record<string, number> = {};
    for (const result of failed) {
      if (result.category) {
        failuresByCategory[result.category] = (failuresByCategory[result.category] || 0) + 1;
      }
    }

    report += `### Failure Distribution\n\n`;
    for (const [category, count] of Object.entries(failuresByCategory)) {
      report += `- **${category}**: ${count} models\n`;
    }
    report += `\n`;
  }

  // ============================================================================
  // FAILURE BREAKDOWN BY CATEGORY
  // ============================================================================

  if (failed.length > 0) {
    report += `## Failure Breakdown by Category\n\n`;

    const grouped = groupByCategory(results);

    // Sort categories by count (most common first)
    const sortedCategories = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

    for (const [category, categoryResults] of sortedCategories) {
      report += `### ${category.toUpperCase()} (${categoryResults.length} models)\n\n`;

      // Affected models
      report += `**Affected Models:**\n`;
      for (const result of categoryResults) {
        report += `- \`${result.modelId}\`\n`;
      }
      report += `\n`;

      // Recommended fix
      const fix = FIX_RECOMMENDATIONS[category as FailureCategory];
      report += `**Recommended Fix:**\n\`\`\`\n${fix}\n\`\`\`\n\n`;

      // Sample errors (up to 3)
      const sampleCount = Math.min(3, categoryResults.length);
      report += `**Sample Errors:**\n`;
      for (let i = 0; i < sampleCount; i++) {
        const result = categoryResults[i];
        const errorPreview = result.error ? result.error.slice(0, 100) : 'No error message';
        report += `- \`${result.modelId}\`: ${errorPreview}${result.error && result.error.length > 100 ? '...' : ''}\n`;
      }
      report += `\n`;
    }
  }

  // ============================================================================
  // PER-MODEL RESULTS TABLE
  // ============================================================================

  report += `## Per-Model Results\n\n`;

  // Sort: failures first (grouped by category), then successes (sorted by duration)
  const sortedResults = [...results].sort((a, b) => {
    if (a.success && !b.success) return 1;
    if (!a.success && b.success) return -1;
    if (!a.success && !b.success) {
      // Both failures: sort by category
      if (a.category && b.category && a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
    }
    // Both successes or same category: sort by duration
    return a.durationMs - b.durationMs;
  });

  report += `| Model | Provider | Status | Duration | Category | Error |\n`;
  report += `|-------|----------|--------|----------|----------|-------|\n`;

  for (const result of sortedResults) {
    const status = result.success ? 'PASS' : 'FAIL';
    const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
    const category = result.category || '-';
    const error = result.error
      ? result.error.slice(0, 50) + (result.error.length > 50 ? '...' : '')
      : '-';

    report += `| \`${result.modelId}\` | ${result.provider} | ${status} | ${duration} | ${category} | ${error} |\n`;
  }

  report += `\n`;

  // ============================================================================
  // FOOTER
  // ============================================================================

  report += `## Raw Responses\n\n`;
  report += `Full diagnostic results with raw LLM responses saved to:\n`;
  report += `\`src/__tests__/diagnostic-results/raw-responses/\`\n\n`;
  report += `Each model has a JSON file with complete response data for debugging.\n`;

  return report;
}
