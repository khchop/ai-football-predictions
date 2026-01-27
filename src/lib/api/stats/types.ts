/**
 * Type definitions for stats API endpoints
 * Provides consistent response structures across all stats routes
 */

// StatsResponse wrapper for consistent API output
export interface StatsResponse<T> {
  data: T;
  meta: {
    generatedAt: string;
    cached: boolean;
    cacheKey?: string;
    filters?: StatsFilters;
    pagination?: PaginationMeta;
  };
}

// Pagination meta for cursor-based pagination
export interface PaginationMeta {
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
  limit: number;
}

// Filter parameters for stats queries
export interface StatsFilters {
  season?: string;
  competition?: string;
  club?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
  isHome?: boolean;
  limit?: number;
  cursor?: string;
}

// Stats level for cache key building
export type StatsLevel = 'overall' | 'competition' | 'club' | 'leaderboard' | 'model';

// Overall stats response type
export interface OverallStats {
  models: ModelStatsRow[];
  totalModels: number;
  totalPredictions: number;
}

// Individual model stats row
export interface ModelStatsRow {
  rank: number;
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  scoredPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  exactScores: number;
  correctTendencies: number;
}

// Competition stats response
export interface CompetitionStats {
  competitionId: string;
  competitionName: string;
  season: string;
  models: ModelStatsRow[];
  totalModels: number;
}

// Club stats response
export interface ClubStats {
  clubId: string;
  clubName: string;
  season: string;
  isHome?: boolean;
  models: ModelClubStatsRow[];
}

// Club-specific model stats
export interface ModelClubStatsRow {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  wins: number;
  draws: number;
  losses: number;
}

// Model-specific stats response
export interface ModelStats {
  modelId: string;
  displayName: string;
  provider: string;
  overall: ModelOverallDetails;
  competitions: ModelCompetitionDetails[];
  clubs: ModelClubDetails[];
}

// Model overall details
export interface ModelOverallDetails {
  totalPredictions: number;
  scoredPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  exactScores: number;
  correctTendencies: number;
  currentStreak: number;
  bestStreak: number;
}

// Model competition details
export interface ModelCompetitionDetails {
  competitionId: string;
  competitionName: string;
  season: string;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
}

// Model club details
export interface ModelClubDetails {
  clubId: string;
  clubName: string;
  season: string;
  isHome: boolean;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
}
