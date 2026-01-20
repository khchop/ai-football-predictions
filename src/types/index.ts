// Re-export database types
export type {
  Competition,
  NewCompetition,
  Match,
  NewMatch,
  Model,
  NewModel,
  Prediction,
  NewPrediction,
  MatchAnalysis,
  NewMatchAnalysis,
} from '@/lib/db/schema';

// Match with related data
export interface MatchWithPredictions {
  id: string;
  externalId: string | null;
  competitionId: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  kickoffTime: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  round: string | null;
  venue: string | null;
  predictions: PredictionWithModel[];
}

export interface PredictionWithModel {
  id: string;
  modelId: string;
  modelDisplayName: string;
  provider: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  confidence: string | null;
  points?: number; // Calculated after match finishes
  isExact?: boolean;
  isCorrectResult?: boolean;
}

// Leaderboard entry
export interface LeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  exactScores: number;
  correctResults: number;
  totalPoints: number;
  exactScorePercent: number;
  correctResultPercent: number;
  averagePoints: number;
}

// LLM Provider types
export interface LLMPredictionResult {
  homeScore: number;
  awayScore: number;
  confidence?: string;
  rawResponse: string;
  success: boolean;
  error?: string;
  processingTimeMs: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  model: string;
  displayName: string;
  isPremium: boolean;
  predict(homeTeam: string, awayTeam: string, competition: string, matchDate: string): Promise<LLMPredictionResult>;
}

// API Football types
export interface APIFootballFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    venue: {
      name: string | null;
      city: string | null;
    };
    status: {
      short: string;
      long: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface APIFootballResponse {
  response: APIFootballFixture[];
  errors: Record<string, string>;
  results: number;
}

// Scoring types
export type MatchResult = 'H' | 'D' | 'A'; // Home win, Draw, Away win

export interface ScoringResult {
  points: number;
  isExact: boolean;
  isCorrectResult: boolean;
  predictedResult: MatchResult;
  actualResult: MatchResult;
}

// Kicktipp Quota Scoring Breakdown (max 10 points)
// Points = TendencyQuota (2-6) + GoalDiffBonus (0-1) + ExactScoreBonus (0-3)
// TendencyQuota: Based on how many models predicted the same outcome (rarer = more points)
// Formula: rawQuota = totalPredictions / predictionsForThatTendency, clamped to [2, 6]
export interface ScoringBreakdown {
  tendencyPoints: number;   // 2-6 based on quota (0 if wrong tendency)
  goalDiffBonus: number;    // +1 if correct goal difference
  exactScoreBonus: number;  // +3 if exact score match
  total: number;            // Sum of all points (max 10)
}

// Enhanced leaderboard entry with quota-based scoring breakdown
export interface EnhancedLeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  averagePoints: number;
  // Points breakdown totals (quota system)
  pointsTendency: number;     // Sum of tendency quota points (2-6 per correct)
  pointsGoalDiff: number;     // Sum of goal diff bonuses (+1 each)
  pointsExactScore: number;   // Sum of exact score bonuses (+3 each)
  // Category counts
  correctTendencies: number;  // How many correct H/D/A predictions
  correctGoalDiffs: number;   // How many correct goal differences
  exactScores: number;        // How many exact score matches
}

// API-Football Prediction Response
export interface APIFootballPredictionResponse {
  response: Array<{
    predictions: {
      winner: {
        id: number;
        name: string;
        comment: string;
      } | null;
      win_or_draw: boolean;
      under_over: string | null;
      goals: {
        home: string;
        away: string;
      };
      advice: string | null;
      percent: {
        home: string;
        draw: string;
        away: string;
      };
    };
    league: {
      id: number;
      name: string;
    };
    teams: {
      home: {
        id: number;
        name: string;
        logo: string;
        last_5: {
          form: string;
          att: string;
          def: string;
          goals: {
            for: { total: number; average: string };
            against: { total: number; average: string };
          };
        };
      };
      away: {
        id: number;
        name: string;
        logo: string;
        last_5: {
          form: string;
          att: string;
          def: string;
          goals: {
            for: { total: number; average: string };
            against: { total: number; average: string };
          };
        };
      };
    };
    comparison: {
      form: { home: string; away: string };
      att: { home: string; away: string };
      def: { home: string; away: string };
      poisson_distribution: { home: string; away: string };
      h2h: { home: string; away: string };
      goals: { home: string; away: string };
      total: { home: string; away: string };
    };
    h2h: Array<{
      fixture: { id: number };
      goals: { home: number; away: number };
    }>;
  }>;
}

// API-Football Injury Response
export interface APIFootballInjuryResponse {
  response: Array<{
    player: {
      id: number;
      name: string;
      photo: string;
      type: string;
      reason: string;
    };
    team: {
      id: number;
      name: string;
      logo: string;
    };
    fixture: {
      id: number;
      timezone: string;
      date: string;
      timestamp: number;
    };
    league: {
      id: number;
      season: number;
      name: string;
    };
  }>;
}

// API-Football Odds Response
export interface APIFootballOddsResponse {
  response: Array<{
    league: {
      id: number;
      name: string;
    };
    fixture: {
      id: number;
      timezone: string;
      date: string;
      timestamp: number;
    };
    update: string;
    bookmakers: Array<{
      id: number;
      name: string;
      bets: Array<{
        id: number;
        name: string;
        values: Array<{
          value: string;
          odd: string;
        }>;
      }>;
    }>;
  }>;
}

// API-Football Lineups Response
export interface APIFootballLineupsResponse {
  response: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
      colors: {
        player: { primary: string; number: string; border: string };
        goalkeeper: { primary: string; number: string; border: string };
      } | null;
    };
    coach: {
      id: number;
      name: string;
      photo: string;
    };
    formation: string;
    startXI: Array<{
      player: {
        id: number;
        name: string;
        number: number;
        pos: string;
        grid: string | null;
      };
    }>;
    substitutes: Array<{
      player: {
        id: number;
        name: string;
        number: number;
        pos: string;
        grid: string | null;
      };
    }>;
  }>;
}

// Likely score from odds
export interface LikelyScore {
  score: string;
  odds: string;
}

// Key injury info
export interface KeyInjury {
  playerName: string;
  teamName: string;
  reason: string;
  type: string;
}
