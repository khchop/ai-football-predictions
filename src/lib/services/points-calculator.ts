import { desc, eq, sql, and, gt, lt } from 'drizzle-orm';
import { getDb, predictions, matches, models } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';

export const RARITY_POINTS = {
  COMMON: 2,
  UNCOMMON: 3,
  RARE: 4,
  VERY_RARE: 5,
  UNIQUE: 6,
} as const;

export type RarityScore = typeof RARITY_POINTS[keyof typeof RARITY_POINTS];

export type MatchResult = 'H' | 'D' | 'A';

export interface PredictionInput {
  id: string;
  matchId: string;
  modelId: string;
  predictedHome: number;
  predictedAway: number;
  predictedResult: MatchResult;
}

export interface PredictionWithAll {
  id: string;
  matchId: string;
  modelId: string;
  predictedHome: number;
  predictedAway: number;
  predictedResult: MatchResult;
  tendencyPoints: number | null;
  goalDiffBonus: number | null;
  exactScoreBonus: number | null;
  totalPoints: number | null;
  status: string;
}

export interface ScoringResult {
  tendencyPoints: number;
  goalDiffBonus: number;
  exactScoreBonus: number;
  totalPoints: number;
}

function calculateRarityScore(totalModels: number, modelsWithPrediction: number): RarityScore {
  if (totalModels === 0) return RARITY_POINTS.UNIQUE;
  
  const percentage = (modelsWithPrediction / totalModels) * 100;
  
  if (percentage > 75) return RARITY_POINTS.COMMON;
  if (percentage > 50) return RARITY_POINTS.UNCOMMON;
  if (percentage > 25) return RARITY_POINTS.RARE;
  if (percentage > 10) return RARITY_POINTS.VERY_RARE;
  return RARITY_POINTS.UNIQUE;
}

function getActualResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

function calculateTendencyPoints(
  predictedResult: MatchResult,
  actualResult: MatchResult,
  totalModels: number,
  modelsWithSamePrediction: number
): number {
  if (predictedResult !== actualResult) {
    return 0;
  }
  
  const rarityScore = calculateRarityScore(totalModels, modelsWithSamePrediction);
  return rarityScore;
}

export function calculatePointsForPrediction(
  prediction: PredictionInput,
  allModelPredictions: PredictionInput[],
  actualHomeScore: number,
  actualAwayScore: number
): ScoringResult {
  const actualResult = getActualResult(actualHomeScore, actualAwayScore);
  const totalModels = allModelPredictions.length;
  
  if (totalModels === 0) {
    return {
      tendencyPoints: 0,
      goalDiffBonus: 0,
      exactScoreBonus: 0,
      totalPoints: 0,
    };
  }
  
  const modelsWithSameResult = allModelPredictions.filter(
    p => p.predictedResult === prediction.predictedResult
  ).length;
  
  const tendencyPoints = calculateTendencyPoints(
    prediction.predictedResult,
    actualResult,
    totalModels,
    modelsWithSameResult
  );
  
  const predictedGoalDiff = prediction.predictedHome - prediction.predictedAway;
  const actualGoalDiff = actualHomeScore - actualAwayScore;
  const goalDiffBonus = predictedGoalDiff === actualGoalDiff ? 1 : 0;
  
  const exactScoreBonus = 
    prediction.predictedHome === actualHomeScore && 
    prediction.predictedAway === actualAwayScore ? 3 : 0;
  
  const totalPoints = tendencyPoints + goalDiffBonus + exactScoreBonus;
  
  return {
    tendencyPoints,
    goalDiffBonus,
    exactScoreBonus,
    totalPoints,
  };
}

export async function calculateAndSavePoints(
  matchId: string,
  tx?: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  const db = tx ?? getDb();
  
  const matchResult = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  
  const match = matchResult[0];
  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }
  
  if (match.status !== 'finished') {
    throw new Error(`Match is not finished: ${matchId} (status: ${match.status})`);
  }
  
  if (match.homeScore === null || match.awayScore === null) {
    throw new Error(`Match has no scores: ${matchId}`);
  }
  
  const allPredictionsRaw = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));
  
  if (allPredictionsRaw.length === 0) {
    loggers.db.warn({ matchId }, 'No predictions found for match');
    return;
  }
  
  const allPredictions: PredictionInput[] = allPredictionsRaw.map(p => ({
    id: p.id,
    matchId: p.matchId,
    modelId: p.modelId,
    predictedHome: p.predictedHome,
    predictedAway: p.predictedAway,
    predictedResult: p.predictedResult as MatchResult,
  }));
  
  const scoredPredictions = allPredictionsRaw.filter(p => p.status === 'scored');
  if (scoredPredictions.length > 0 && scoredPredictions.length === allPredictionsRaw.length) {
    loggers.db.debug({ matchId }, 'All predictions already scored');
    return;
  }
  
  const predictionsByResult: Record<MatchResult, number> = { H: 0, D: 0, A: 0 };
  for (const p of allPredictionsRaw) {
    if (p.status === 'pending') {
      predictionsByResult[p.predictedResult as MatchResult]++;
    }
  }
  
  for (const prediction of allPredictionsRaw) {
    if (prediction.status !== 'pending') {
      continue;
    }
    
    const scoringResult = calculatePointsForPrediction(
      {
        id: prediction.id,
        matchId: prediction.matchId,
        modelId: prediction.modelId,
        predictedHome: prediction.predictedHome,
        predictedAway: prediction.predictedAway,
        predictedResult: prediction.predictedResult as MatchResult,
      },
      allPredictions,
      match.homeScore,
      match.awayScore
    );
    
    await db
      .update(predictions)
      .set({
        tendencyPoints: scoringResult.tendencyPoints,
        goalDiffBonus: scoringResult.goalDiffBonus,
        exactScoreBonus: scoringResult.exactScoreBonus,
        totalPoints: scoringResult.totalPoints,
        status: 'scored',
        scoredAt: new Date(),
      })
      .where(eq(predictions.id, prediction.id));
    
    await updateModelStreak(prediction.modelId, scoringResult);
  }
}

async function updateModelStreak(
  modelId: string,
  scoringResult: ScoringResult
): Promise<void> {
  const db = getDb();
  
  await db.transaction(async (tx) => {
    const modelResult = await tx
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);
    
    const model = modelResult[0];
    if (!model) return;
    
    let resultType: 'exact' | 'tendency' | 'wrong';
    
    if (scoringResult.exactScoreBonus > 0) {
      resultType = 'exact';
    } else if (scoringResult.tendencyPoints > 0) {
      resultType = 'tendency';
    } else {
      resultType = 'wrong';
    }
    
    const currentStreak = model.currentStreak || 0;
    const currentStreakType = model.currentStreakType || 'none';
    let bestStreak = model.bestStreak || 0;
    let worstStreak = model.worstStreak || 0;
    let bestExactStreak = model.bestExactStreak || 0;
    let bestTendencyStreak = model.bestTendencyStreak || 0;
    
    let newStreak: number;
    let newStreakType: string;
    
    if (resultType === 'wrong') {
      if (currentStreak < 0) {
        newStreak = currentStreak - 1;
      } else {
        newStreak = -1;
      }
      newStreakType = 'none';
      if (newStreak < worstStreak) {
        worstStreak = newStreak;
      }
    } else {
      if (currentStreak > 0) {
        newStreak = currentStreak + 1;
        if (resultType === 'exact') {
          newStreakType = 'exact';
        } else {
          newStreakType = currentStreakType === 'exact' ? 'exact' : 'tendency';
        }
      } else {
        newStreak = 1;
        newStreakType = resultType;
      }
      if (newStreak > bestStreak) {
        bestStreak = newStreak;
      }
      if (resultType === 'exact') {
        const exactCount = currentStreakType === 'exact' ? bestExactStreak + 1 : 1;
        if (exactCount > bestExactStreak) {
          bestExactStreak = exactCount;
        }
      }
      if (newStreak > bestTendencyStreak) {
        bestTendencyStreak = newStreak;
      }
    }
    
    await tx
      .update(models)
      .set({
        currentStreak: newStreak,
        currentStreakType: newStreakType,
        bestStreak,
        worstStreak,
        bestExactStreak,
        bestTendencyStreak,
      })
      .where(eq(models.id, modelId));
  });
}

export async function calculateMatchQuotas(
  matchId: string
): Promise<{ quotaHome: number; quotaDraw: number; quotaAway: number }> {
  const db = getDb();
  
  const allPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));
  
  if (allPredictions.length === 0) {
    throw new Error(`No predictions found for match: ${matchId}`);
  }
  
  const predictionsByResult: Record<MatchResult, number> = { H: 0, D: 0, A: 0 };
  for (const p of allPredictions) {
    predictionsByResult[p.predictedResult as MatchResult]++;
  }
  
  const totalModels = allPredictions.length;
  
  const quotaHome = calculateRarityScore(totalModels, predictionsByResult.H);
  const quotaDraw = calculateRarityScore(totalModels, predictionsByResult.D);
  const quotaAway = calculateRarityScore(totalModels, predictionsByResult.A);
  
  return { quotaHome, quotaDraw, quotaAway };
}

export async function updateMatchQuotasWithLock(
  matchId: string
): Promise<void> {
  const db = getDb();
  
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT 1 FROM predictions WHERE match_id = ${matchId} FOR UPDATE`);
    
    const quotas = await calculateMatchQuotas(matchId);
    
    await tx
      .update(matches)
      .set({
        quotaHome: quotas.quotaHome,
        quotaDraw: quotas.quotaDraw,
        quotaAway: quotas.quotaAway,
      })
      .where(eq(matches.id, matchId));
  });
}
