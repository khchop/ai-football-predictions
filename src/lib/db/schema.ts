import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Competitions we track (Champions League, Premier League, etc.)
export const competitions = sqliteTable('competitions', {
  id: text('id').primaryKey(), // e.g., "ucl", "epl"
  name: text('name').notNull(), // e.g., "UEFA Champions League"
  apiFootballId: integer('api_football_id').notNull(), // API-Football league ID
  season: integer('season').notNull(), // e.g., 2024
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Individual matches
export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(), // UUID
  externalId: text('external_id').unique(), // API-Football fixture ID
  competitionId: text('competition_id')
    .notNull()
    .references(() => competitions.id),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homeTeamLogo: text('home_team_logo'),
  awayTeamLogo: text('away_team_logo'),
  kickoffTime: text('kickoff_time').notNull(), // ISO datetime
  homeScore: integer('home_score'), // NULL until match finished
  awayScore: integer('away_score'),
  status: text('status').default('scheduled'), // scheduled, live, finished, postponed, cancelled
  round: text('round'), // e.g., "Group A - Matchday 1", "Quarter-finals"
  venue: text('venue'),
  isUpset: integer('is_upset', { mode: 'boolean' }).default(false), // Whether the underdog won
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// LLM models we test
export const models = sqliteTable('models', {
  id: text('id').primaryKey(), // e.g., "groq-llama-70b"
  provider: text('provider').notNull(), // e.g., "groq"
  modelName: text('model_name').notNull(), // e.g., "llama-3.3-70b-versatile"
  displayName: text('display_name').notNull(), // e.g., "Llama 3.3 70B (Groq)"
  isPremium: integer('is_premium', { mode: 'boolean' }).default(false),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Predictions made by models
export const predictions = sqliteTable('predictions', {
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
  pointsExactScore: integer('points_exact_score').default(0), // 5 pts if exact match
  pointsResult: integer('points_result').default(0), // 2 pts if correct result (H/D/A)
  pointsGoalDiff: integer('points_goal_diff').default(0), // 1 pt if correct goal difference
  pointsOverUnder: integer('points_over_under').default(0), // 1 pt if correct over/under 2.5
  pointsBtts: integer('points_btts').default(0), // 1 pt if correct both teams to score
  pointsUpsetBonus: integer('points_upset_bonus').default(0), // 2 pts if predicted underdog win
  pointsTotal: integer('points_total').default(0), // Sum of all points (max 10)
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Daily usage tracking for budget control
export const modelUsage = sqliteTable('model_usage', {
  id: text('id').primaryKey(), // UUID
  date: text('date').notNull(), // YYYY-MM-DD
  modelId: text('model_id').notNull(),
  predictionsCount: integer('predictions_count').default(0),
  totalCost: text('total_cost').default('0'), // Stored as string for precision
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

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

// Pre-match analysis data from API-Football
export const matchAnalysis = sqliteTable('match_analysis', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
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
  lineupsAvailable: integer('lineups_available', { mode: 'boolean' }).default(false),
  lineupsUpdatedAt: text('lineups_updated_at'),
  
  // Raw API data for debugging
  rawPredictionsData: text('raw_predictions_data'),
  rawInjuriesData: text('raw_injuries_data'),
  rawOddsData: text('raw_odds_data'),
  rawLineupsData: text('raw_lineups_data'),
  
  analysisUpdatedAt: text('analysis_updated_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type NewMatchAnalysis = typeof matchAnalysis.$inferInsert;
