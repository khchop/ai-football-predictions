import { MatchResult, ScoringResult, ScoringBreakdown } from '@/types';

// ============= KICKTIPP QUOTA SCORING SYSTEM =============
// Points = TendencyQuota (2-6) + GoalDiffBonus (0-1) + ExactScoreBonus (0-3)
// Maximum: 10 points
//
// Quota Calculation (Kicktipp formula):
// - Count predictions by tendency (Home/Draw/Away)
// - P = predictions_for_tendency / total_predictions
// - rawQuota = (MAX / (10 * P)) - (MAX / 10) + MIN
// - Clamp to range [2, 6]
// - Rare predictions = more points, common predictions = fewer points
// - Unpredicted outcomes = MAX_QUOTA (6 points)
//
// Example (30 models, actual: Away Win 0-1):
// - Predictions: 24 Home, 4 Draw, 2 Away
// - P values: Home=0.8, Draw=0.133, Away=0.067
// - Quotas: H=2, D=5, A=6 (computed via formula)
// - Model predicted 0-1 (Away, exact): 6 + 1 + 3 = 10 points
// - Model predicted 2-0 (Home, wrong): 0 points

// Minimum and maximum quota values
const MIN_QUOTA = 2;
const MAX_QUOTA = 6;

// Bonus points
const GOAL_DIFF_BONUS = 1;
const EXACT_SCORE_BONUS = 3;

// Determine match result from scores
export function getResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

// Calculate points for a prediction (legacy simple scoring for backward compat)
// 3 points = exact score
// 1 point = correct result (W/D/L)
// 0 points = wrong
export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): ScoringResult {
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  
  const isExact = predictedHome === actualHome && predictedAway === actualAway;
  const isCorrectResult = predictedResult === actualResult;

  let points = 0;
  if (isExact) {
    points = 3;
  } else if (isCorrectResult) {
    points = 1;
  }

  return {
    points,
    isExact,
    isCorrectResult,
    predictedResult,
    actualResult,
  };
}

// Format result for display
export function formatResult(result: MatchResult): string {
  switch (result) {
    case 'H':
      return 'Home Win';
    case 'A':
      return 'Away Win';
    case 'D':
      return 'Draw';
  }
}

// ============= QUOTA CALCULATION =============

export interface QuotaResult {
  home: number;  // Quota for home win predictions (2-6)
  draw: number;  // Quota for draw predictions (2-6)
  away: number;  // Quota for away win predictions (2-6)
}

// Calculate quotas from prediction distribution using Kicktipp formula
// Each quota represents the points a model earns for correctly predicting that outcome
// Kicktipp formula: Points = (MAX / (10 * P)) - (MAX / 10) + MIN
// Where P = predictions_for_tendency / total_predictions
export function calculateQuotas(
  predictions: Array<{ predictedHome: number; predictedAway: number }>
): QuotaResult {
  const total = predictions.length;

  if (total === 0) {
    // Default quotas if no predictions
    return { home: MIN_QUOTA, draw: MIN_QUOTA, away: MIN_QUOTA };
  }

  // Count predictions by tendency
  let homeCount = 0;
  let drawCount = 0;
  let awayCount = 0;

  for (const pred of predictions) {
    const result = getResult(pred.predictedHome, pred.predictedAway);
    if (result === 'H') homeCount++;
    else if (result === 'D') drawCount++;
    else awayCount++;
  }

  // Kicktipp formula: Points = (MAX / (10 * P)) - (MAX / 10) + MIN
  // Where P = predictions_for_tendency / total_predictions
  function computeQuota(count: number): number {
    if (count === 0) return MAX_QUOTA; // Max points for unpredicted outcome

    const P = count / total;
    const rawQuota = (MAX_QUOTA / (10 * P)) - (MAX_QUOTA / 10) + MIN_QUOTA;

    // Clamp then round (per research recommendation)
    return Math.round(Math.min(MAX_QUOTA, Math.max(MIN_QUOTA, rawQuota)));
  }

  return {
    home: computeQuota(homeCount),
    draw: computeQuota(drawCount),
    away: computeQuota(awayCount),
  };
}

// ============= QUOTA-BASED SCORING =============

export interface QuotaScoringInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  quotaHome: number;
  quotaDraw: number;
  quotaAway: number;
}

// Calculate points for a single prediction using the quota system
export function calculateQuotaScores(input: QuotaScoringInput): ScoringBreakdown {
  const { predictedHome, predictedAway, actualHome, actualAway, quotaHome, quotaDraw, quotaAway } = input;
  
  const breakdown: ScoringBreakdown = {
    tendencyPoints: 0,
    goalDiffBonus: 0,
    exactScoreBonus: 0,
    total: 0,
  };
  
  // Determine tendencies
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  
  // If wrong tendency, no points at all
  if (predictedResult !== actualResult) {
    return breakdown;
  }
  
  // 1. Tendency Points: Use the quota for the actual result (2-6)
  switch (actualResult) {
    case 'H':
      breakdown.tendencyPoints = quotaHome;
      break;
    case 'D':
      breakdown.tendencyPoints = quotaDraw;
      break;
    case 'A':
      breakdown.tendencyPoints = quotaAway;
      break;
  }
  
  // 2. Goal Difference Bonus (+1)
  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;
  if (predictedDiff === actualDiff) {
    breakdown.goalDiffBonus = GOAL_DIFF_BONUS;
  }
  
  // 3. Exact Score Bonus (+3)
  if (predictedHome === actualHome && predictedAway === actualAway) {
    breakdown.exactScoreBonus = EXACT_SCORE_BONUS;
  }
  
  // Calculate total
  breakdown.total = breakdown.tendencyPoints + breakdown.goalDiffBonus + breakdown.exactScoreBonus;
  
  return breakdown;
}

// ============= LEGACY ENHANCED SCORING (for backward compatibility during transition) =============

export interface EnhancedScoringInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  homeWinPct: number | null;
  awayWinPct: number | null;
}

// Legacy scoring function - now wraps quota scoring with default quotas
// This ensures old code paths still work during transition
export function calculateEnhancedScores(input: EnhancedScoringInput): ScoringBreakdown {
  // Use minimum quota (2) as default when quotas aren't available
  // This gives a baseline score similar to old system
  return calculateQuotaScores({
    predictedHome: input.predictedHome,
    predictedAway: input.predictedAway,
    actualHome: input.actualHome,
    actualAway: input.actualAway,
    quotaHome: MIN_QUOTA,
    quotaDraw: MIN_QUOTA,
    quotaAway: MIN_QUOTA,
  });
}

// ============= LEGACY ACCURACY STATS =============

export interface AccuracyStats {
  totalPredictions: number;
  exactScores: number;
  correctResults: number;
  totalPoints: number;
  exactScorePercent: number;
  correctResultPercent: number;
  averagePoints: number;
}

export function calculateAccuracyStats(
  predictions: Array<{
    predictedHome: number;
    predictedAway: number;
    actualHome: number;
    actualAway: number;
  }>
): AccuracyStats {
  if (predictions.length === 0) {
    return {
      totalPredictions: 0,
      exactScores: 0,
      correctResults: 0,
      totalPoints: 0,
      exactScorePercent: 0,
      correctResultPercent: 0,
      averagePoints: 0,
    };
  }

  let exactScores = 0;
  let correctResults = 0;
  let totalPoints = 0;

  for (const pred of predictions) {
    const result = calculatePoints(
      pred.predictedHome,
      pred.predictedAway,
      pred.actualHome,
      pred.actualAway
    );
    
    if (result.isExact) exactScores++;
    if (result.isCorrectResult) correctResults++;
    totalPoints += result.points;
  }

  const total = predictions.length;

  return {
    totalPredictions: total,
    exactScores,
    correctResults,
    totalPoints,
    exactScorePercent: Math.round((exactScores / total) * 100 * 10) / 10,
    correctResultPercent: Math.round((correctResults / total) * 100 * 10) / 10,
    averagePoints: Math.round((totalPoints / total) * 100) / 100,
  };
}
