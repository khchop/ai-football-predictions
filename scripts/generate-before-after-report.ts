/**
 * Before/After Comparison Report Generator
 *
 * Generates a markdown report comparing per-model prediction success rates
 * between a baseline period (pre-v2.8) and a current period (post-v2.8 fixes).
 *
 * If llm_model_stats has no data for the requested periods, the script
 * backfills by running aggregateDailyStats for each date in both ranges.
 *
 * Usage:
 *   npx tsx scripts/generate-before-after-report.ts
 *   npx tsx scripts/generate-before-after-report.ts --baseline-start 2026-01-20 --baseline-end 2026-02-04
 *   npx tsx scripts/generate-before-after-report.ts --current-start 2026-02-06 --current-end 2026-02-08
 */

import { format, parseISO, eachDayOfInterval, subDays } from 'date-fns';
import { eq, and, gte, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { llmModelStats, models } from '@/lib/db/schema';
import { aggregateDailyStats } from '@/lib/db/queries/model-stats';
import * as fs from 'fs';
import * as path from 'path';

// ----- CLI Args Parsing -----

function parseArgs(): {
  baselineStart: string;
  baselineEnd: string;
  currentStart: string;
  currentEnd: string;
} {
  const args = process.argv.slice(2);
  const defaults = {
    baselineStart: '2026-01-20',
    baselineEnd: '2026-02-04',
    currentStart: '2026-02-06',
    currentEnd: format(new Date(), 'yyyy-MM-dd'),
  };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!value) continue;

    switch (flag) {
      case '--baseline-start':
        defaults.baselineStart = value;
        break;
      case '--baseline-end':
        defaults.baselineEnd = value;
        break;
      case '--current-start':
        defaults.currentStart = value;
        break;
      case '--current-end':
        defaults.currentEnd = value;
        break;
    }
  }

  return defaults;
}

// ----- Backfill -----

async function ensureStatsExist(startDate: string, endDate: string): Promise<number> {
  const db = getDb();
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  let backfilledCount = 0;

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');

    // Check if any stats exist for this date
    const existing = await db
      .select({ id: llmModelStats.id })
      .from(llmModelStats)
      .where(eq(llmModelStats.date, dateStr))
      .limit(1);

    if (existing.length === 0) {
      console.log(`  Backfilling stats for ${dateStr}...`);
      await aggregateDailyStats(dateStr);
      backfilledCount++;
    }
  }

  return backfilledCount;
}

// ----- Report Generation -----

interface ModelComparisonRow {
  modelId: string;
  displayName: string;
  provider: string;
  baselineRate: number;
  baselineAttempts: number;
  currentRate: number;
  currentAttempts: number;
  change: number;
  status: 'improved' | 'degraded' | 'unchanged';
}

async function generateReport(config: ReturnType<typeof parseArgs>): Promise<string> {
  const db = getDb();

  // Get all models (including inactive for historical comparison)
  const allModels = await db.select().from(models);
  const modelMap = new Map(allModels.map(m => [m.id, m]));

  // Fetch stats for baseline period
  const baselineStats = await db
    .select()
    .from(llmModelStats)
    .where(
      and(
        gte(llmModelStats.date, config.baselineStart),
        lt(llmModelStats.date, config.baselineEnd),
      ),
    );

  // Fetch stats for current period
  const currentStats = await db
    .select()
    .from(llmModelStats)
    .where(
      and(
        gte(llmModelStats.date, config.currentStart),
        lt(llmModelStats.date, config.currentEnd),
      ),
    );

  // Group by model and calculate period rates
  const baselineByModel = groupByModel(baselineStats);
  const currentByModel = groupByModel(currentStats);

  // Get all model IDs that appear in either period
  const allModelIds = new Set([
    ...baselineByModel.keys(),
    ...currentByModel.keys(),
  ]);

  // Build comparison rows
  const rows: ModelComparisonRow[] = [];
  for (const modelId of allModelIds) {
    const model = modelMap.get(modelId);
    if (!model) continue;

    const baseline = baselineByModel.get(modelId);
    const current = currentByModel.get(modelId);

    const baselineRate = baseline
      ? (baseline.success / baseline.attempts) * 100
      : 0;
    const currentRate = current
      ? (current.success / current.attempts) * 100
      : 0;
    const change = currentRate - baselineRate;

    let status: 'improved' | 'degraded' | 'unchanged';
    if (change > 5) {
      status = 'improved';
    } else if (change < -5) {
      status = 'degraded';
    } else {
      status = 'unchanged';
    }

    rows.push({
      modelId,
      displayName: model.displayName,
      provider: model.provider,
      baselineRate,
      baselineAttempts: baseline?.attempts ?? 0,
      currentRate,
      currentAttempts: current?.attempts ?? 0,
      change,
      status,
    });
  }

  // Sort by change descending (biggest improvements first)
  rows.sort((a, b) => b.change - a.change);

  // Calculate summary stats
  const improved = rows.filter(r => r.status === 'improved');
  const degraded = rows.filter(r => r.status === 'degraded');
  const unchanged = rows.filter(r => r.status === 'unchanged');

  const overallBaselineSuccess = [...baselineByModel.values()].reduce((s, v) => s + v.success, 0);
  const overallBaselineAttempts = [...baselineByModel.values()].reduce((s, v) => s + v.attempts, 0);
  const overallCurrentSuccess = [...currentByModel.values()].reduce((s, v) => s + v.success, 0);
  const overallCurrentAttempts = [...currentByModel.values()].reduce((s, v) => s + v.attempts, 0);

  const overallBaselineRate = overallBaselineAttempts > 0
    ? (overallBaselineSuccess / overallBaselineAttempts) * 100
    : 0;
  const overallCurrentRate = overallCurrentAttempts > 0
    ? (overallCurrentSuccess / overallCurrentAttempts) * 100
    : 0;
  const overallChange = overallCurrentRate - overallBaselineRate;

  const belowThreshold = rows.filter(r => r.currentRate < 90 && r.currentAttempts > 0);
  const top5 = rows.filter(r => r.change > 0).slice(0, 5);

  // Build markdown report
  const today = format(new Date(), 'yyyy-MM-dd');
  let report = `# Before/After Comparison Report\n\n`;
  report += `**Generated:** ${today}\n`;
  report += `**Baseline Period:** ${config.baselineStart} to ${config.baselineEnd} (pre-v2.8)\n`;
  report += `**Current Period:** ${config.currentStart} to ${config.currentEnd} (post-v2.8)\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Overall Baseline Rate | ${overallBaselineRate.toFixed(1)}% |\n`;
  report += `| Overall Current Rate | ${overallCurrentRate.toFixed(1)}% |\n`;
  report += `| Overall Change | ${overallChange >= 0 ? '+' : ''}${overallChange.toFixed(1)}% |\n`;
  report += `| Models Improved (>5% gain) | ${improved.length} |\n`;
  report += `| Models Degraded (>5% loss) | ${degraded.length} |\n`;
  report += `| Models Unchanged | ${unchanged.length} |\n`;
  report += `| Models Still Below 90% | ${belowThreshold.length} |\n`;
  report += `| Total Models Tracked | ${rows.length} |\n\n`;

  if (top5.length > 0) {
    report += `## Top 5 Improvements\n\n`;
    report += `| Model | Provider | Baseline | Current | Change |\n`;
    report += `|-------|----------|----------|---------|--------|\n`;
    for (const row of top5) {
      report += `| ${row.displayName} | ${row.provider} | ${row.baselineRate.toFixed(1)}% | ${row.currentRate.toFixed(1)}% | +${row.change.toFixed(1)}% |\n`;
    }
    report += `\n`;
  }

  report += `## Per-Model Results\n\n`;
  report += `| Model | Provider | Baseline | Current | Change | Status |\n`;
  report += `|-------|----------|----------|---------|--------|--------|\n`;
  for (const row of rows) {
    const changeStr = row.change >= 0 ? `+${row.change.toFixed(1)}%` : `${row.change.toFixed(1)}%`;
    const statusEmoji = row.status === 'improved' ? 'Improved' : row.status === 'degraded' ? 'Degraded' : 'Unchanged';
    report += `| ${row.displayName} | ${row.provider} | ${row.baselineRate.toFixed(1)}% | ${row.currentRate.toFixed(1)}% | ${changeStr} | ${statusEmoji} |\n`;
  }
  report += `\n`;

  if (belowThreshold.length > 0) {
    report += `## Remaining Issues (Models Below 90%)\n\n`;
    report += `| Model | Provider | Current Rate | Gap to 90% |\n`;
    report += `|-------|----------|-------------|------------|\n`;
    for (const row of belowThreshold.sort((a, b) => a.currentRate - b.currentRate)) {
      report += `| ${row.displayName} | ${row.provider} | ${row.currentRate.toFixed(1)}% | ${(90 - row.currentRate).toFixed(1)}% |\n`;
    }
    report += `\n`;
  }

  report += `---\n`;
  report += `*Generated by scripts/generate-before-after-report.ts*\n`;

  return report;
}

function groupByModel(stats: Array<{
  modelId: string;
  successCount: number | null;
  failureCount: number | null;
  totalAttempts: number | null;
}>): Map<string, { success: number; attempts: number }> {
  const map = new Map<string, { success: number; attempts: number }>();

  for (const stat of stats) {
    const existing = map.get(stat.modelId) ?? { success: 0, attempts: 0 };
    existing.success += stat.successCount ?? 0;
    existing.attempts += stat.totalAttempts ?? 0;
    map.set(stat.modelId, existing);
  }

  return map;
}

// ----- Main -----

async function main() {
  const config = parseArgs();

  console.log('=== Before/After Comparison Report Generator ===\n');
  console.log(`Baseline: ${config.baselineStart} to ${config.baselineEnd}`);
  console.log(`Current:  ${config.currentStart} to ${config.currentEnd}\n`);

  // Ensure stats exist (backfill if needed)
  console.log('Checking baseline period stats...');
  const baselineBackfilled = await ensureStatsExist(config.baselineStart, config.baselineEnd);
  if (baselineBackfilled > 0) {
    console.log(`  Backfilled ${baselineBackfilled} days for baseline period`);
  } else {
    console.log('  All baseline stats present');
  }

  console.log('Checking current period stats...');
  const currentBackfilled = await ensureStatsExist(config.currentStart, config.currentEnd);
  if (currentBackfilled > 0) {
    console.log(`  Backfilled ${currentBackfilled} days for current period`);
  } else {
    console.log('  All current stats present');
  }

  console.log('\nGenerating report...');
  const report = await generateReport(config);

  // Write report
  const today = format(new Date(), 'yyyy-MM-dd');
  const outputPath = path.join(
    process.cwd(),
    '.planning',
    'phases',
    '58-observability-monitoring',
    `before-after-report-${today}.md`,
  );

  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`\nReport written to: ${outputPath}`);
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error generating report:', error);
    process.exit(1);
  });
