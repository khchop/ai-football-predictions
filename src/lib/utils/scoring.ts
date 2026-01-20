import { MatchResult, ScoringResult, ScoringBreakdown } from '@/types';
import { getUnderdog, predictedUnderdogWin, isUpsetResult } from './upset';

// Determine match result from scores
export function getResult(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

// Calculate points for a prediction
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

// ============= ENHANCED SCORING (6 categories, max 10 points) =============

export interface EnhancedScoringInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  homeWinPct: number | null;
  awayWinPct: number | null;
}

// Calculate enhanced scoring breakdown (6 categories, max 10 points)
export function calculateEnhancedScores(input: EnhancedScoringInput): ScoringBreakdown {
  const { predictedHome, predictedAway, actualHome, actualAway, homeWinPct, awayWinPct } = input;
  
  const breakdown: ScoringBreakdown = {
    exactScore: 0,
    result: 0,
    goalDiff: 0,
    overUnder: 0,
    btts: 0,
    upsetBonus: 0,
    total: 0,
  };

  // 1. Exact Score (5 points)
  const isExact = predictedHome === actualHome && predictedAway === actualAway;
  if (isExact) {
    breakdown.exactScore = 5;
  }

  // 2. Correct Result (2 points) - only if not exact
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  if (!isExact && predictedResult === actualResult) {
    breakdown.result = 2;
  }

  // 3. Correct Goal Difference (1 point)
  const predictedDiff = predictedHome - predictedAway;
  const actualDiff = actualHome - actualAway;
  if (predictedDiff === actualDiff) {
    breakdown.goalDiff = 1;
  }

  // 4. Over/Under 2.5 (1 point)
  const predictedTotal = predictedHome + predictedAway;
  const actualTotal = actualHome + actualAway;
  const predictedOver = predictedTotal > 2.5;
  const actualOver = actualTotal > 2.5;
  if (predictedOver === actualOver) {
    breakdown.overUnder = 1;
  }

  // 5. Both Teams to Score (1 point)
  const predictedBtts = predictedHome > 0 && predictedAway > 0;
  const actualBtts = actualHome > 0 && actualAway > 0;
  if (predictedBtts === actualBtts) {
    breakdown.btts = 1;
  }

  // 6. Upset Bonus (2 points) - if correctly predicted underdog win
  const underdog = getUnderdog(homeWinPct, awayWinPct);
  const wasUpset = isUpsetResult(homeWinPct, awayWinPct, actualHome, actualAway);
  const calledUpset = predictedUnderdogWin(predictedHome, predictedAway, underdog);
  
  if (wasUpset && calledUpset) {
    breakdown.upsetBonus = 2;
  }

  // Calculate total
  breakdown.total = 
    breakdown.exactScore + 
    breakdown.result + 
    breakdown.goalDiff + 
    breakdown.overUnder + 
    breakdown.btts + 
    breakdown.upsetBonus;

  return breakdown;
}

// ============= LEGACY SCORING (for backward compatibility) =============

// Calculate accuracy statistics
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
