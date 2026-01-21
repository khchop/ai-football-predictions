import { pgTable, text, integer, boolean, doublePrecision, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Competitions we track (Champions League, Premier League, etc.)
export const competitions = pgTable('competitions', {
  id: text('id').primaryKey(), // e.g., "ucl", "epl"
  name: text('name').notNull(), // e.g., "UEFA Champions League"
  apiFootballId: integer('api_football_id').notNull(), // API-Football league ID
  season: integer('season').notNull(), // e.g., 2024
  active: boolean('active').default(true),
  createdAt: text('created_at').default(sql`now()`),
});

// Individual matches
export const matches = pgTable('matches', {
  id: text('id').primaryKey(), // UUID
  externalId: text('external_id').unique(), // API-Football fixture ID
  competitionId: text('competition_id')
    .notNull()
    .references(() => competitions.id),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homeTeamLogo: text('home_team_logo'),
  awayTeamLogo: text('away_team_logo'),
  kickoffTime: text('kickoff_time').notNull(), // ISO datetime string
  homeScore: integer('home_score'), // NULL until match finished
  awayScore: integer('away_score'),
  status: text('status').default('scheduled'), // scheduled, live, finished, postponed, cancelled
  matchMinute: text('match_minute'), // Live match time: "45'", "HT", "67'", "90'+3"
  round: text('round'), // e.g., "Group A - Matchday 1", "Quarter-finals"
  venue: text('venue'),
  isUpset: boolean('is_upset').default(false), // Whether the underdog won
  // Kicktipp quota scoring: points for correct tendency (2-6 range)
  // Lower quota = more models predicted that outcome = less reward
  quotaHome: integer('quota_home'), // Points for predicting home win (2-6)
  quotaDraw: integer('quota_draw'), // Points for predicting draw (2-6)
  quotaAway: integer('quota_away'), // Points for predicting away win (2-6)
  createdAt: text('created_at').default(sql`now()`),
  updatedAt: text('updated_at').default(sql`now()`),
}, (table) => [
  index('idx_matches_competition_id').on(table.competitionId),
  index('idx_matches_status').on(table.status),
  index('idx_matches_kickoff_time').on(table.kickoffTime),
  index('idx_matches_status_kickoff').on(table.status, table.kickoffTime),
]);

// LLM models we test
export const models = pgTable('models', {
  id: text('id').primaryKey(), // e.g., "groq-llama-70b"
  provider: text('provider').notNull(), // e.g., "groq"
  modelName: text('model_name').notNull(), // e.g., "llama-3.3-70b-versatile"
  displayName: text('display_name').notNull(), // e.g., "Llama 3.3 70B (Groq)"
  isPremium: boolean('is_premium').default(false),
  active: boolean('active').default(true),
  createdAt: text('created_at').default(sql`now()`),
  // Streak tracking (updated in real-time when matches are scored)
  currentStreak: integer('current_streak').default(0), // Positive = wins, negative = losses
  currentStreakType: text('current_streak_type').default('none'), // 'exact', 'tendency', 'none'
  bestStreak: integer('best_streak').default(0), // Best winning streak ever
  worstStreak: integer('worst_streak').default(0), // Worst losing streak ever (stored as negative)
  bestExactStreak: integer('best_exact_streak').default(0), // Best exact score streak
  bestTendencyStreak: integer('best_tendency_streak').default(0), // Best tendency streak (including exact)
  // Retry statistics (tracks JSON parse failures and recovery)
  totalRetryAttempts: integer('total_retry_attempts').default(0), // Lifetime retry attempts
  totalRetrySuccesses: integer('total_retry_successes').default(0), // Lifetime successful retries
  lastRetryAt: text('last_retry_at'), // ISO timestamp of last retry
  // Health tracking (for auto-disable and admin monitoring)
  consecutiveFailures: integer('consecutive_failures').default(0), // Number of consecutive API failures
  lastFailureAt: text('last_failure_at'), // ISO timestamp of last failure
  lastSuccessAt: text('last_success_at'), // ISO timestamp of last successful prediction
  failureReason: text('failure_reason'), // Last error message/reason
  autoDisabled: boolean('auto_disabled').default(false), // Auto-disabled after 3+ consecutive failures
}, (table) => [
  index('idx_models_active').on(table.active),
]);

// Predictions made by models
export const predictions = pgTable('predictions', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .references(() => matches.id),
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  predictedHomeScore: integer('predicted_home_score').notNull(),
  predictedAwayScore: integer('predicted_away_score').notNull(),
  confidence: text('confidence'), // "low", "medium", "high" (optional)
  rawResponse: text('raw_response'), // Full LLM response for debugging
  processingTimeMs: integer('processing_time_ms'), // How long the API call took
  // Points breakdown (calculated after match finishes)
  // Note: Using quota-based scoring - pointsResult stores tendencyPoints (2-6)
  pointsExactScore: integer('points_exact_score').default(0), // Exact score bonus (0-3)
  pointsResult: integer('points_result').default(0), // Tendency points (2-6)
  pointsGoalDiff: integer('points_goal_diff').default(0), // Goal diff bonus (0-1)
  pointsOverUnder: integer('points_over_under').default(0), // Unused (legacy)
  pointsBtts: integer('points_btts').default(0), // Unused (legacy)
  pointsUpsetBonus: integer('points_upset_bonus').default(0), // Unused (legacy)
  pointsTotal: integer('points_total').default(0), // Sum of all points
  createdAt: text('created_at').default(sql`now()`),
}, (table) => [
  index('idx_predictions_match_id').on(table.matchId),
  index('idx_predictions_model_id').on(table.modelId),
  unique('predictions_match_model_unique').on(table.matchId, table.modelId),
]);

// Daily usage tracking for budget control
export const modelUsage = pgTable('model_usage', {
  id: text('id').primaryKey(), // UUID
  date: text('date').notNull(), // YYYY-MM-DD
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  predictionsCount: integer('predictions_count').default(0),
  totalCost: text('total_cost').default('0'), // Stored as string for precision
  createdAt: text('created_at').default(sql`now()`),
  updatedAt: text('updated_at').default(sql`now()`),
}, (table) => [
  unique('model_usage_date_model_unique').on(table.date, table.modelId),
  index('idx_model_usage_date').on(table.date),
]);

// Type exports for use in application
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

export type ModelUsage = typeof modelUsage.$inferSelect;
export type NewModelUsage = typeof modelUsage.$inferInsert;

// Track failed prediction attempts per match/model pair
// Allows retrying up to 3 times before giving up
// Records are auto-cleaned after 7 days
export const predictionAttempts = pgTable('prediction_attempts', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .references(() => matches.id),
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  attemptCount: integer('attempt_count').default(0), // Number of failed attempts
  lastAttemptAt: text('last_attempt_at'), // ISO timestamp of last failed attempt
  lastError: text('last_error'), // Error message from last attempt
  createdAt: text('created_at').default(sql`now()`),
}, (table) => [
  unique('prediction_attempts_match_model_unique').on(table.matchId, table.modelId),
  index('idx_prediction_attempts_match_id').on(table.matchId),
  index('idx_prediction_attempts_created_at').on(table.createdAt),
]);

export type PredictionAttempt = typeof predictionAttempts.$inferSelect;
export type NewPredictionAttempt = typeof predictionAttempts.$inferInsert;

// Pre-match analysis data from API-Football
export const matchAnalysis = pgTable('match_analysis', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .unique()  // Required for upsert on conflict
    .references(() => matches.id),
  
  // Winner prediction from API-Football /predictions endpoint
  favoriteTeamId: integer('favorite_team_id'),
  favoriteTeamName: text('favorite_team_name'),
  homeWinPct: integer('home_win_pct'), // e.g., 68 for "68%"
  drawPct: integer('draw_pct'),
  awayWinPct: integer('away_win_pct'),
  advice: text('advice'), // e.g., "Double chance: draw or Manchester City"
  
  // Team comparison percentages
  formHomePct: integer('form_home_pct'),
  formAwayPct: integer('form_away_pct'),
  attackHomePct: integer('attack_home_pct'),
  attackAwayPct: integer('attack_away_pct'),
  defenseHomePct: integer('defense_home_pct'),
  defenseAwayPct: integer('defense_away_pct'),
  
  // Team recent form
  homeTeamForm: text('home_team_form'), // e.g., "WWLDL"
  awayTeamForm: text('away_team_form'),
  homeGoalsScored: integer('home_goals_scored'), // Last 5 matches
  homeGoalsConceded: integer('home_goals_conceded'),
  awayGoalsScored: integer('away_goals_scored'),
  awayGoalsConceded: integer('away_goals_conceded'),
  
  // Betting odds (from /odds endpoint)
  oddsHome: text('odds_home'), // e.g., "1.38"
  oddsDraw: text('odds_draw'), // e.g., "5.60"
  oddsAway: text('odds_away'), // e.g., "6.50"
  likelyScores: text('likely_scores'), // JSON array of {score, odds}
  
  // Injuries (from /injuries endpoint)
  homeInjuriesCount: integer('home_injuries_count').default(0),
  awayInjuriesCount: integer('away_injuries_count').default(0),
  keyInjuries: text('key_injuries'), // JSON array of injury details
  
  // Lineups (from /fixtures/lineups endpoint, fetched closer to kickoff)
  homeFormation: text('home_formation'), // e.g., "4-3-3"
  awayFormation: text('away_formation'),
  homeStartingXI: text('home_starting_xi'), // JSON array of player names
  awayStartingXI: text('away_starting_xi'),
  homeCoach: text('home_coach'),
  awayCoach: text('away_coach'),
  lineupsAvailable: boolean('lineups_available').default(false),
  lineupsUpdatedAt: text('lineups_updated_at'),
  
  // Head-to-head history (extracted from /predictions endpoint h2h data)
  h2hTotal: integer('h2h_total'),           // Total H2H matches in data
  h2hHomeWins: integer('h2h_home_wins'),    // Home team wins in H2H
  h2hDraws: integer('h2h_draws'),           // Draws in H2H
  h2hAwayWins: integer('h2h_away_wins'),    // Away team wins in H2H
  h2hResults: text('h2h_results'),          // JSON: last 5 scores [{home:2,away:1}, ...]
  
  // Enhanced team season statistics
  homeSeasonStats: text('home_season_stats'),  // JSON: TeamSeasonStats for home team
  awaySeasonStats: text('away_season_stats'),  // JSON: TeamSeasonStats for away team
  
  // Enhanced H2H data (last 10 matches instead of 5)
  h2hDetailed: text('h2h_detailed'),        // JSON: Extended H2H with halftime scores
  
  // Raw API data for debugging
  rawPredictionsData: text('raw_predictions_data'),
  rawInjuriesData: text('raw_injuries_data'),
  rawOddsData: text('raw_odds_data'),
  rawLineupsData: text('raw_lineups_data'),
  rawTeamStatsHome: text('raw_team_stats_home'),     // Raw team statistics API response
  rawTeamStatsAway: text('raw_team_stats_away'),     // Raw team statistics API response
  rawH2HData: text('raw_h2h_data'),                   // Raw H2H API response
  
  analysisUpdatedAt: text('analysis_updated_at'),
  createdAt: text('created_at').default(sql`now()`),
});

export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type NewMatchAnalysis = typeof matchAnalysis.$inferInsert;

// League standings for team context
export const leagueStandings = pgTable('league_standings', {
  id: text('id').primaryKey(), // "{leagueId}-{season}-{teamId}"
  leagueId: integer('league_id').notNull(),
  season: integer('season').notNull(),
  teamId: integer('team_id').notNull(),
  teamName: text('team_name').notNull(),
  position: integer('position').notNull(),
  points: integer('points').notNull(),
  played: integer('played').notNull(),
  won: integer('won').notNull(),
  drawn: integer('drawn').notNull(),
  lost: integer('lost').notNull(),
  goalsFor: integer('goals_for').notNull(),
  goalsAgainst: integer('goals_against').notNull(),
  goalDiff: integer('goal_diff').notNull(),
  form: text('form'),                        // e.g., "WWDLW"
  homeWon: integer('home_won'),
  homeDrawn: integer('home_drawn'),
  homeLost: integer('home_lost'),
  homeGoalsFor: integer('home_goals_for'),
  homeGoalsAgainst: integer('home_goals_against'),
  awayWon: integer('away_won'),
  awayDrawn: integer('away_drawn'),
  awayLost: integer('away_lost'),
  awayGoalsFor: integer('away_goals_for'),
  awayGoalsAgainst: integer('away_goals_against'),
  updatedAt: text('updated_at').default(sql`now()`),
}, (table) => [
  index('idx_league_standings_league_id').on(table.leagueId),
  index('idx_league_standings_team_name').on(table.teamName),
  index('idx_league_standings_league_position').on(table.leagueId, table.position),
]);

export type LeagueStanding = typeof leagueStandings.$inferSelect;
export type NewLeagueStanding = typeof leagueStandings.$inferInsert;
