/**
 * Stats Service - Single Source of Truth for Accuracy Calculations
 *
 * CANONICAL FORMULA:
 * accuracy = (predictions with tendencyPoints > 0) / (scored predictions) * 100
 *
 * Key rules:
 * - Denominator: ALWAYS scored predictions (status = 'scored')
 * - Numerator: tendencyPoints > 0 (not IS NOT NULL - that includes 0-point wrong predictions)
 * - Division protection: NULLIF(denominator, 0) + COALESCE(result, 0)
 */

import { eq, and, sql } from 'drizzle-orm';
import { getDb, predictions, models, matches, competitions } from '@/lib/db';
import type { ModelAccuracyStats, CompetitionModelStats } from '@/lib/types/stats';

// ============= REUSABLE SQL FRAGMENTS =============
// Use these in all stats queries for consistency

/** Count of predictions with correct tendency (tendencyPoints > 0) */
export const CORRECT_TENDENCIES_SQL = sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`;

/** Count of predictions with exact score (exactScoreBonus = 3) */
export const EXACT_SCORES_SQL = sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`;

/** Count of scored predictions (denominator for accuracy) */
export const SCORED_PREDICTIONS_SQL = sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END)`;

/** Tendency accuracy percentage with division protection */
export const ACCURACY_SQL = sql<number>`COALESCE(
  ROUND(
    100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
    1
  ),
  0
)`;

/** Exact score accuracy percentage with division protection */
export const EXACT_ACCURACY_SQL = sql<number>`COALESCE(
  ROUND(
    100.0 * SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric,
    1
  ),
  0
)`;

// ============= SERVICE FUNCTIONS =============

/**
 * Get accuracy stats for a model - CANONICAL VERSION
 * All pages must use this function, not raw queries
 */
export async function getModelAccuracyStats(modelId: string): Promise<ModelAccuracyStats | null> {
  const db = getDb();

  const result = await db
    .select({
      modelId: models.id,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      scoredPredictions: SCORED_PREDICTIONS_SQL,
      correctTendencies: CORRECT_TENDENCIES_SQL,
      exactScores: EXACT_SCORES_SQL,
      accuracy: ACCURACY_SQL,
      exactAccuracy: EXACT_ACCURACY_SQL,
    })
    .from(models)
    .leftJoin(predictions, eq(predictions.modelId, models.id))
    .where(eq(models.id, modelId))
    .groupBy(models.id);

  if (!result[0]) return null;

  return {
    modelId: result[0].modelId,
    accuracy: Number(result[0].accuracy),
    exactAccuracy: Number(result[0].exactAccuracy),
    scoredPredictions: Number(result[0].scoredPredictions) || 0,
    totalPredictions: Number(result[0].totalPredictions) || 0,
    correctTendencies: Number(result[0].correctTendencies) || 0,
    exactScores: Number(result[0].exactScores) || 0,
  };
}

/**
 * Get model stats for a specific competition - CANONICAL VERSION
 */
export async function getCompetitionModelStats(
  modelId: string,
  competitionId: string
): Promise<CompetitionModelStats | null> {
  const db = getDb();

  const result = await db
    .select({
      modelId: sql<string>`${modelId}`,
      competitionId: competitions.id,
      competitionName: competitions.name,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      scoredPredictions: SCORED_PREDICTIONS_SQL,
      correctTendencies: CORRECT_TENDENCIES_SQL,
      exactScores: EXACT_SCORES_SQL,
      accuracy: ACCURACY_SQL,
      exactAccuracy: EXACT_ACCURACY_SQL,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(matches.competitionId, competitionId),
        eq(predictions.status, 'scored')
      )
    )
    .groupBy(competitions.id, competitions.name);

  if (!result[0]) return null;

  return {
    modelId: result[0].modelId,
    competitionId: result[0].competitionId,
    competitionName: result[0].competitionName,
    accuracy: Number(result[0].accuracy),
    exactAccuracy: Number(result[0].exactAccuracy),
    scoredPredictions: Number(result[0].scoredPredictions) || 0,
    correctTendencies: Number(result[0].correctTendencies) || 0,
    exactScores: Number(result[0].exactScores) || 0,
    avgPoints: Number(result[0].avgPoints),
    totalPoints: Number(result[0].totalPoints),
  };
}
