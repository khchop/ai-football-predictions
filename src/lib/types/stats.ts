/**
 * Stats types for accuracy calculations
 * Single source of truth for stats-related TypeScript interfaces
 */

export interface ModelAccuracyStats {
  modelId: string;
  accuracy: number;           // Tendency accuracy: (tendencyPoints > 0) / scored * 100
  exactAccuracy: number;      // Exact score accuracy: exactScoreBonus=3 / scored * 100
  scoredPredictions: number;  // Denominator: predictions with status='scored'
  totalPredictions: number;   // All predictions including pending
  correctTendencies: number;  // Numerator for accuracy: tendencyPoints > 0
  exactScores: number;        // Numerator for exact: exactScoreBonus = 3
}

export interface CompetitionModelStats {
  modelId: string;
  competitionId: string;
  competitionName: string;
  accuracy: number;
  exactAccuracy: number;
  scoredPredictions: number;
  correctTendencies: number;
  exactScores: number;
  avgPoints: number;
  totalPoints: number;
}
