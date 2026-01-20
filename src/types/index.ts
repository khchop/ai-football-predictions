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

// Enhanced scoring breakdown (6 categories, max 10 points)
// Max with exact score: 5 + 0 + 1 + 1 + 1 + 2 = 10
// Max without exact: 0 + 2 + 1 + 1 + 1 + 2 = 7
export interface ScoringBreakdown {
  exactScore: number;    // 5 pts if exact match
  result: number;        // 2 pts if correct result (only if not exact)
  goalDiff: number;      // 1 pt if correct goal difference
  overUnder: number;     // 1 pt if correct over/under 2.5
  btts: number;          // 1 pt if correct both teams to score
  upsetBonus: number;    // 2 pts if correctly predicted underdog win
  total: number;         // Sum of all points (max 10)
}

// Enhanced leaderboard entry with points breakdown
export interface EnhancedLeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  averagePoints: number;
  // Points breakdown totals
  pointsExactScore: number;
  pointsResult: number;
  pointsGoalDiff: number;
  pointsOverUnder: number;
  pointsBtts: number;
  pointsUpsetBonus: number;
  // Category counts
  exactScores: number;
  correctResults: number;
  correctGoalDiffs: number;
  correctOverUnders: number;
  correctBtts: number;
  upsetsCalled: number;
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
