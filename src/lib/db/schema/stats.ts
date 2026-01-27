export const RARITY_POINTS = {
  EXACT_SCORE: 10,
  CORRECT_TENDENCY: 3,
  CORRECT_DRAW: 3,
  GOAL_DIFF_BONUS: 1,
} as const;

export type RarityPoints = typeof RARITY_POINTS;

export interface ModelStatsOverall {
  modelId: string;
  totalMatches: number;
  totalPoints: number;
  avgPoints: number;
  winRate: number;
  winCount: number;
  drawCount: number;
  lossCount: number;
}

export interface ModelStatsCompetition {
  modelId: string;
  competitionId: string;
  season: number;
  totalMatches: number;
  totalPoints: number;
  avgPoints: number;
  winRate: number;
}

export interface ModelStatsClub {
  modelId: string;
  clubId: string;
  season: number;
  isHome: boolean;
  totalMatches: number;
  totalPoints: number;
  avgPoints: number;
  winRate: number;
}

export interface MatchWithTeams {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competitionId: string;
  season: number;
  status: string;
  kickoffTime: string;
}

export interface PredictionWithMatch {
  id: string;
  matchId: string;
  modelId: string;
  predictedHome: number;
  predictedAway: number;
  predictedResult: 'H' | 'D' | 'A';
  tendencyPoints: number | null;
  goalDiffBonus: number | null;
  exactScoreBonus: number | null;
  totalPoints: number | null;
  status: string;
  createdAt: Date | null;
  match: MatchWithTeams | null;
}
