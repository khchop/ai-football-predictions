/**
 * Model health stats queries for Phase 58 Observability & Monitoring.
 *
 * Provides daily per-model aggregation, multi-window trend analysis,
 * health summaries, and regression detection.
 *
 * Success = model produced a prediction for a match on that date.
 * Failure = model was active but did NOT produce a prediction for a match
 *           where the pipeline ran (at least one other model predicted).
 */

import { eq, and, gte, lt, sql, desc, count, countDistinct } from 'drizzle-orm';
import { subDays, format } from 'date-fns';
import { getDb } from '@/lib/db';
import { llmModelStats, predictions, models } from '@/lib/db/schema';

// ----- Types -----

interface DailyDataPoint {
  date: string;
  successRate: number;
  attempts: number;
}

interface TrendWindow {
  successRate: number;
  attempts: number;
  dailyData: DailyDataPoint[];
}

export interface ModelHealthTrend {
  modelId: string;
  current: {
    successRate: number;
    lastFailure: string | null;
    failureCategory: string | null;
  };
  trends: {
    days7: TrendWindow;
    days30: TrendWindow;
    days90: TrendWindow;
  };
}

export interface ModelHealthSummary {
  modelId: string;
  displayName: string;
  provider: string;
  active: boolean | null;
  successRate7d: number;
  successRate30d: number;
  totalAttempts7d: number;
  lastFailure: string | null;
  failureCategory: string | null;
  status: 'healthy' | 'warning' | 'critical';
}

export interface RegressionAlert {
  modelId: string;
  displayName: string;
  previousSuccessRate: number;
  currentSuccessRate: number;
  drop: number;
  severity: 'warning' | 'critical';
}

// ----- Helper -----

/**
 * Determine the primary error category from a failureReason string.
 * Pattern-matches against known error patterns from the pipeline.
 */
function categorizeFailureReason(reason: string | null): {
  timeout: number;
  parse: number;
  apiError: number;
  language: number;
  other: number;
} {
  const result = { timeout: 0, parse: 0, apiError: 0, language: 0, other: 0 };
  if (!reason) return result;

  const lower = reason.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnaborted')) {
    result.timeout = 1;
  } else if (lower.includes('parse') || lower.includes('json') || lower.includes('unexpected token') || lower.includes('syntaxerror')) {
    result.parse = 1;
  } else if (lower.includes('429') || lower.includes('rate limit') || lower.includes('5xx') || lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('api error') || lower.includes('server error')) {
    result.apiError = 1;
  } else if (lower.includes('language') || lower.includes('chinese') || lower.includes('not in english') || lower.includes('non-english')) {
    result.language = 1;
  } else {
    result.other = 1;
  }

  return result;
}

/**
 * Determine the primary error category name from an llmModelStats row.
 */
function determinePrimaryCategory(stat: {
  timeoutErrors: number | null;
  parseErrors: number | null;
  apiErrors: number | null;
  languageErrors: number | null;
  otherErrors: number | null;
} | undefined): string | null {
  if (!stat) return null;

  const categories: Record<string, number> = {
    timeout: stat.timeoutErrors ?? 0,
    parse: stat.parseErrors ?? 0,
    apiError: stat.apiErrors ?? 0,
    language: stat.languageErrors ?? 0,
    other: stat.otherErrors ?? 0,
  };

  const max = Math.max(...Object.values(categories));
  if (max === 0) return null;

  return Object.entries(categories).find(([, count]) => count === max)?.[0] ?? null;
}

/**
 * Calculate aggregate success rate from a set of stat rows.
 */
function aggregateWindow(stats: Array<{
  successCount: number | null;
  failureCount: number | null;
  totalAttempts: number | null;
  successRate: number | null;
  date: string;
}>): TrendWindow {
  const totalSuccess = stats.reduce((sum, s) => sum + (s.successCount ?? 0), 0);
  const totalAttempts = stats.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);

  return {
    successRate: totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0,
    attempts: totalAttempts,
    dailyData: stats.map((s) => ({
      date: s.date,
      successRate: s.successRate ?? 0,
      attempts: s.totalAttempts ?? 0,
    })),
  };
}

// ----- Exported Functions -----

/**
 * Aggregate per-model prediction counts for a given date (YYYY-MM-DD).
 *
 * For each active model, counts predictions created on that date as successes.
 * Failures = total matches predicted by ANY model that day minus this model's predictions.
 * Error categories come from the models table's failureReason (best-effort, stores latest error only).
 *
 * Idempotent: uses upsert on (date, modelId) unique constraint.
 */
export async function aggregateDailyStats(date: string): Promise<void> {
  const db = getDb();

  // Timestamp range for the given date (predictions.createdAt is a timestamp column)
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // 1. Count distinct matches that received ANY prediction on this date
  const [matchCountResult] = await db
    .select({
      totalMatches: countDistinct(predictions.matchId),
    })
    .from(predictions)
    .where(
      and(
        gte(predictions.createdAt, dayStart),
        lt(predictions.createdAt, dayEnd),
      ),
    );

  const totalMatchesPredicted = matchCountResult?.totalMatches ?? 0;

  if (totalMatchesPredicted === 0) {
    // No predictions on this date; nothing to aggregate
    return;
  }

  // 2. Count per-model predictions for this date
  const perModelCounts = await db
    .select({
      modelId: predictions.modelId,
      predictionCount: count(),
    })
    .from(predictions)
    .where(
      and(
        gte(predictions.createdAt, dayStart),
        lt(predictions.createdAt, dayEnd),
      ),
    )
    .groupBy(predictions.modelId);

  // Build a map of modelId -> prediction count
  const modelPredictionMap = new Map<string, number>();
  for (const row of perModelCounts) {
    modelPredictionMap.set(row.modelId, Number(row.predictionCount));
  }

  // 3. Get all active models (to account for models with 0 predictions)
  const activeModels = await db
    .select({
      id: models.id,
      failureReason: models.failureReason,
    })
    .from(models)
    .where(eq(models.active, true));

  // 4. Upsert stats for each active model
  for (const model of activeModels) {
    const successCount = modelPredictionMap.get(model.id) ?? 0;
    const failureCount = Math.max(0, totalMatchesPredicted - successCount);
    const totalAttempts = successCount + failureCount;
    const successRate = totalAttempts > 0
      ? (successCount / totalAttempts) * 100
      : 0;

    // Error category from current failureReason (best-effort)
    const errorCats = failureCount > 0
      ? categorizeFailureReason(model.failureReason)
      : { timeout: 0, parse: 0, apiError: 0, language: 0, other: 0 };

    // Scale error categories proportionally to failure count
    // (failureReason is only the latest error, so spread evenly is best effort)
    const errorMultiplier = failureCount > 0 ? failureCount : 0;

    await db
      .insert(llmModelStats)
      .values({
        id: crypto.randomUUID(),
        date,
        modelId: model.id,
        successCount,
        failureCount,
        totalAttempts,
        successRate,
        timeoutErrors: errorCats.timeout * errorMultiplier,
        parseErrors: errorCats.parse * errorMultiplier,
        apiErrors: errorCats.apiError * errorMultiplier,
        languageErrors: errorCats.language * errorMultiplier,
        otherErrors: errorCats.other * errorMultiplier,
      })
      .onConflictDoUpdate({
        target: [llmModelStats.date, llmModelStats.modelId],
        set: {
          successCount,
          failureCount,
          totalAttempts,
          successRate,
          timeoutErrors: errorCats.timeout * errorMultiplier,
          parseErrors: errorCats.parse * errorMultiplier,
          apiErrors: errorCats.apiError * errorMultiplier,
          languageErrors: errorCats.language * errorMultiplier,
          otherErrors: errorCats.other * errorMultiplier,
          updatedAt: sql`now()`,
        },
      });
  }
}

/**
 * Returns health trends for a single model across 7/30/90-day windows.
 * Includes daily data points for Recharts visualization.
 */
export async function getModelHealthTrends(modelId: string): Promise<ModelHealthTrend> {
  const db = getDb();
  const now = new Date();

  const date7 = format(subDays(now, 7), 'yyyy-MM-dd');
  const date30 = format(subDays(now, 30), 'yyyy-MM-dd');
  const date90 = format(subDays(now, 90), 'yyyy-MM-dd');

  // Fetch stats for all three windows in parallel
  const [stats7d, stats30d, stats90d, modelInfo] = await Promise.all([
    db
      .select()
      .from(llmModelStats)
      .where(and(eq(llmModelStats.modelId, modelId), gte(llmModelStats.date, date7)))
      .orderBy(desc(llmModelStats.date)),

    db
      .select()
      .from(llmModelStats)
      .where(and(eq(llmModelStats.modelId, modelId), gte(llmModelStats.date, date30)))
      .orderBy(desc(llmModelStats.date)),

    db
      .select()
      .from(llmModelStats)
      .where(and(eq(llmModelStats.modelId, modelId), gte(llmModelStats.date, date90)))
      .orderBy(desc(llmModelStats.date)),

    db
      .select({
        lastFailureAt: models.lastFailureAt,
        failureReason: models.failureReason,
      })
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1),
  ]);

  const latestStat = stats7d[0];

  return {
    modelId,
    current: {
      successRate: latestStat?.successRate ?? 0,
      lastFailure: modelInfo[0]?.lastFailureAt ?? null,
      failureCategory: determinePrimaryCategory(latestStat),
    },
    trends: {
      days7: aggregateWindow(stats7d),
      days30: aggregateWindow(stats30d),
      days90: aggregateWindow(stats90d),
    },
  };
}

/**
 * Returns health summary for ALL active models (used by dashboard overview).
 * Aggregates last 7 and 30 days for each model.
 */
export async function getAllModelHealthSummary(): Promise<ModelHealthSummary[]> {
  const db = getDb();
  const now = new Date();
  const date7 = format(subDays(now, 7), 'yyyy-MM-dd');
  const date30 = format(subDays(now, 30), 'yyyy-MM-dd');

  // Get all active models
  const activeModels = await db
    .select()
    .from(models)
    .where(eq(models.active, true));

  // Get all stats for last 30 days (covers both 7d and 30d windows)
  const allStats = await db
    .select()
    .from(llmModelStats)
    .where(gte(llmModelStats.date, date30));

  // Group stats by model
  const statsByModel = new Map<string, typeof allStats>();
  for (const stat of allStats) {
    const existing = statsByModel.get(stat.modelId) ?? [];
    existing.push(stat);
    statsByModel.set(stat.modelId, existing);
  }

  const summaries: ModelHealthSummary[] = [];

  for (const model of activeModels) {
    const modelStats = statsByModel.get(model.id) ?? [];
    const stats7d = modelStats.filter((s) => s.date >= date7);
    const stats30d = modelStats; // Already filtered to 30d

    const success7d = stats7d.reduce((sum, s) => sum + (s.successCount ?? 0), 0);
    const attempts7d = stats7d.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);
    const successRate7d = attempts7d > 0 ? (success7d / attempts7d) * 100 : 0;

    const success30d = stats30d.reduce((sum, s) => sum + (s.successCount ?? 0), 0);
    const attempts30d = stats30d.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);
    const successRate30d = attempts30d > 0 ? (success30d / attempts30d) * 100 : 0;

    // Determine status from 7-day rate
    let status: 'healthy' | 'warning' | 'critical';
    if (successRate7d >= 90) {
      status = 'healthy';
    } else if (successRate7d >= 80) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    // Find primary failure category from most recent stat
    const latestStat = stats7d.sort((a, b) => b.date.localeCompare(a.date))[0];

    summaries.push({
      modelId: model.id,
      displayName: model.displayName,
      provider: model.provider,
      active: model.active,
      successRate7d,
      successRate30d,
      totalAttempts7d: attempts7d,
      lastFailure: model.lastFailureAt,
      failureCategory: determinePrimaryCategory(latestStat),
      status,
    });
  }

  return summaries;
}

/**
 * Compares current 7-day window to previous 7-day window for all active models.
 *
 * Regression = previousRate - currentRate > 10 AND currentRate < 90.
 * Severity: < 80% = critical, 80-90% = warning.
 */
export async function detectRegressions(): Promise<RegressionAlert[]> {
  const db = getDb();
  const now = new Date();

  const currentStart = format(subDays(now, 7), 'yyyy-MM-dd');
  const previousStart = format(subDays(now, 14), 'yyyy-MM-dd');
  const previousEnd = format(subDays(now, 7), 'yyyy-MM-dd');

  // Get all active models
  const activeModels = await db
    .select()
    .from(models)
    .where(eq(models.active, true));

  // Get all stats for last 14 days (covers both windows)
  const allStats = await db
    .select()
    .from(llmModelStats)
    .where(gte(llmModelStats.date, previousStart));

  // Group stats by model
  const statsByModel = new Map<string, typeof allStats>();
  for (const stat of allStats) {
    const existing = statsByModel.get(stat.modelId) ?? [];
    existing.push(stat);
    statsByModel.set(stat.modelId, existing);
  }

  const alerts: RegressionAlert[] = [];

  for (const model of activeModels) {
    const modelStats = statsByModel.get(model.id) ?? [];

    // Split into current and previous windows
    const currentStats = modelStats.filter((s) => s.date >= currentStart);
    const prevStats = modelStats.filter((s) => s.date >= previousStart && s.date < previousEnd);

    if (currentStats.length === 0 || prevStats.length === 0) continue;

    // Calculate success rates from totals (not averaging daily rates)
    const currentSuccess = currentStats.reduce((sum, s) => sum + (s.successCount ?? 0), 0);
    const currentAttempts = currentStats.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);
    const currentRate = currentAttempts > 0 ? (currentSuccess / currentAttempts) * 100 : 0;

    const prevSuccess = prevStats.reduce((sum, s) => sum + (s.successCount ?? 0), 0);
    const prevAttempts = prevStats.reduce((sum, s) => sum + (s.totalAttempts ?? 0), 0);
    const previousRate = prevAttempts > 0 ? (prevSuccess / prevAttempts) * 100 : 0;

    const drop = previousRate - currentRate;

    // Regression: >10% drop AND current rate below 90%
    if (drop > 10 && currentRate < 90) {
      alerts.push({
        modelId: model.id,
        displayName: model.displayName,
        previousSuccessRate: previousRate,
        currentSuccessRate: currentRate,
        drop,
        severity: currentRate < 80 ? 'critical' : 'warning',
      });
    }
  }

  return alerts;
}
