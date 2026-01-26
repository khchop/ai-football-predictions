import { pgTable, text, integer, boolean, doublePrecision, unique, index, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Competitions we track (Champions League, Premier League, etc.)
export const competitions = pgTable('competitions', {
  id: text('id').primaryKey(), // e.g., "ucl", "epl"
  name: text('name').notNull(), // e.g., "UEFA Champions League"
  apiFootballId: integer('api_football_id').notNull(), // API-Football league ID
  season: integer('season').notNull(), // e.g., 2024
  active: boolean('active').default(true),
  slug: text('slug').unique(), // SEO-friendly slug, e.g., "champions-league"
  createdAt: timestamp('created_at').defaultNow(),
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
  slug: text('slug'), // SEO-friendly slug, e.g., "manchester-city-vs-arsenal-2026-01-22" (nullable for backfill)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_matches_competition_id').on(table.competitionId),
  index('idx_matches_status').on(table.status),
  index('idx_matches_kickoff_time').on(table.kickoffTime),
  index('idx_matches_status_kickoff').on(table.status, table.kickoffTime),
  index('idx_matches_slug').on(table.slug),
]);

// LLM models we test
export const models = pgTable('models', {
  id: text('id').primaryKey(), // e.g., "groq-llama-70b"
  provider: text('provider').notNull(), // e.g., "groq"
  modelName: text('model_name').notNull(), // e.g., "llama-3.3-70b-versatile"
  displayName: text('display_name').notNull(), // e.g., "Llama 3.3 70B (Groq)"
  modelDescription: text('model_description'), // AI-generated description of the model
  isPremium: boolean('is_premium').default(false),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
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

// Daily usage tracking for budget control
export const modelUsage = pgTable('model_usage', {
  id: text('id').primaryKey(), // UUID
  date: text('date').notNull(), // YYYY-MM-DD
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  predictionsCount: integer('predictions_count').default(0),
  totalCost: text('total_cost').default('0'), // Stored as string for precision
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export type ModelUsage = typeof modelUsage.$inferSelect;
export type NewModelUsage = typeof modelUsage.$inferInsert;

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
  oddsHome: text('odds_home'), // e.g., "1.38" - 1X2: Home win
  oddsDraw: text('odds_draw'), // e.g., "5.60" - 1X2: Draw
  oddsAway: text('odds_away'), // e.g., "6.50" - 1X2: Away win
  likelyScores: text('likely_scores'), // JSON array of {score, odds}
  
  // Double Chance odds
  odds1X: text('odds_1x'), // Home win OR Draw
  oddsX2: text('odds_x2'), // Draw OR Away win
  odds12: text('odds_12'), // Home win OR Away win (no draw)
  
  // Over/Under goals odds
  oddsOver05: text('odds_over_05'),
  oddsUnder05: text('odds_under_05'),
  oddsOver15: text('odds_over_15'),
  oddsUnder15: text('odds_under_15'),
  oddsOver25: text('odds_over_25'),
  oddsUnder25: text('odds_under_25'),
  oddsOver35: text('odds_over_35'),
  oddsUnder35: text('odds_under_35'),
  oddsOver45: text('odds_over_45'),
  oddsUnder45: text('odds_under_45'),
  
  // Both Teams To Score odds
  oddsBttsYes: text('odds_btts_yes'),
  oddsBttsNo: text('odds_btts_no'),
  
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
  createdAt: timestamp('created_at').defaultNow(),
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
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_league_standings_league_id').on(table.leagueId),
  index('idx_league_standings_team_name').on(table.teamName),
  index('idx_league_standings_league_position').on(table.leagueId, table.position),
]);

export type LeagueStanding = typeof leagueStandings.$inferSelect;
export type NewLeagueStanding = typeof leagueStandings.$inferInsert;

// Betting seasons (for tracking when to reset balances)
export const seasons = pgTable('seasons', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(), // e.g., "2024-2025"
  startDate: text('start_date').notNull(), // ISO date
  endDate: text('end_date'), // ISO date (null if current season)
  isCurrent: boolean('is_current').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;

// Model betting balances per season
export const modelBalances = pgTable('model_balances', {
  id: text('id').primaryKey(), // UUID
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  season: text('season').notNull(), // e.g., "2024-2025"
  startingBalance: doublePrecision('starting_balance').default(1000.00),
  currentBalance: doublePrecision('current_balance').default(1000.00),
  totalWagered: doublePrecision('total_wagered').default(0.00),
  totalWon: doublePrecision('total_won').default(0.00),
  totalBets: integer('total_bets').default(0),
  winningBets: integer('winning_bets').default(0),
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
}, (table) => [
  unique('model_balances_model_season_unique').on(table.modelId, table.season),
  index('idx_model_balances_season').on(table.season),
  index('idx_model_balances_model_id').on(table.modelId),
]);

export type ModelBalance = typeof modelBalances.$inferSelect;
export type NewModelBalance = typeof modelBalances.$inferInsert;

// Individual bets (replaces predictions for betting system)
export const bets = pgTable('bets', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .references(() => matches.id),
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  season: text('season').notNull(),
  
  // Bet details
  betType: text('bet_type').notNull(), // 'result' | 'over_under' | 'btts'
  selection: text('selection').notNull(), // '1' | '2' | '1X' | 'X2' | 'O2.5' | 'U1.5' | 'Yes' | 'No'
  odds: doublePrecision('odds').notNull(),
  stake: doublePrecision('stake').default(1.00),
  
  // Outcome
  status: text('status').default('pending'), // 'pending' | 'won' | 'lost' | 'void'
  payout: doublePrecision('payout'), // NULL until settled
  profit: doublePrecision('profit'), // NULL until settled
  
  createdAt: timestamp('created_at').default(sql`now()`),
  settledAt: timestamp('settled_at'),
}, (table) => [
  unique('bets_match_model_type_unique').on(table.matchId, table.modelId, table.betType),
  index('idx_bets_match_id').on(table.matchId),
  index('idx_bets_model_id').on(table.modelId),
  index('idx_bets_season').on(table.season),
  index('idx_bets_status').on(table.status),
]);

export type Bet = typeof bets.$inferSelect;
export type NewBet = typeof bets.$inferInsert;

// AI score predictions (Kicktipp Quota Scoring system)
export const predictions = pgTable('predictions', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .references(() => matches.id),
  modelId: text('model_id')
    .notNull()
    .references(() => models.id),
  
  // Prediction
  predictedHome: integer('predicted_home').notNull(),
  predictedAway: integer('predicted_away').notNull(),
  predictedResult: text('predicted_result').notNull(), // 'H' | 'D' | 'A'
  
  // Scoring (calculated after match finishes using Kicktipp Quota System)
  tendencyPoints: integer('tendency_points'), // 2-6 based on quota
  goalDiffBonus: integer('goal_diff_bonus'), // 0 or 1
  exactScoreBonus: integer('exact_score_bonus'), // 0 or 3
  totalPoints: integer('total_points'), // Sum of above (max 10)
  
  // Status
  status: text('status').default('pending'), // 'pending' | 'scored' | 'void'
  
  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`),
  scoredAt: timestamp('scored_at'),
}, (table) => [
  unique('predictions_match_model_unique').on(table.matchId, table.modelId),
  index('idx_predictions_match_id').on(table.matchId),
  index('idx_predictions_model_id').on(table.modelId),
  index('idx_predictions_status').on(table.status),
  index('idx_predictions_created_at').on(table.createdAt),
  index('idx_predictions_match_status').on(table.matchId, table.status), // Composite index for queries filtering by match + status
]);

export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

// AI-generated blog posts for SEO/GEO
export const blogPosts = pgTable('blog_posts', {
  id: text('id').primaryKey(), // UUID
  slug: text('slug').notNull().unique(), // SEO-friendly URL slug
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(), // Short summary (150-160 chars for meta description)
  content: text('content').notNull(), // Full markdown content
  contentType: text('content_type').notNull(), // 'league_roundup' | 'model_report' | 'analysis'
  
  // SEO metadata
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  keywords: text('keywords'), // Comma-separated
  
  // Relations
  competitionId: text('competition_id').references(() => competitions.id), // For league roundups
  modelId: text('model_id').references(() => models.id), // For model reports
  
  // Publishing
  status: text('status').default('draft'), // 'draft' | 'published'
  publishedAt: text('published_at'),
  
  // AI generation metadata
  generatedBy: text('generated_by').notNull(), // 'gemini-3-flash-preview'
  generationCost: text('generation_cost'), // Cost in USD
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_blog_posts_slug').on(table.slug),
  index('idx_blog_posts_status').on(table.status),
  index('idx_blog_posts_published_at').on(table.publishedAt),
  index('idx_blog_posts_competition_id').on(table.competitionId),
  index('idx_blog_posts_content_type').on(table.contentType),
]);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

// AI-generated match previews for SEO/GEO
export const matchPreviews = pgTable('match_previews', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .unique()
    .references(() => matches.id),
  
  // Content sections
  introduction: text('introduction').notNull(), // Opening paragraph
  teamFormAnalysis: text('team_form_analysis').notNull(), // Recent form comparison
  headToHead: text('head_to_head'), // H2H history
  keyPlayers: text('key_players'), // Star players to watch
  tacticalAnalysis: text('tactical_analysis'), // Tactical breakdown
  prediction: text('prediction').notNull(), // AI prediction summary
  bettingInsights: text('betting_insights'), // Betting odds analysis
  
  // SEO
  metaDescription: text('meta_description'),
  keywords: text('keywords'), // Comma-separated
  
  // Publishing
  status: text('status').default('draft'), // 'draft' | 'published'
  publishedAt: text('published_at'),
  
  // AI generation metadata
  generatedBy: text('generated_by').notNull(), // 'gemini-3-flash-preview'
  generationCost: text('generation_cost'), // Cost in USD
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_match_previews_match_id').on(table.matchId),
  index('idx_match_previews_status').on(table.status),
  index('idx_match_previews_published_at').on(table.publishedAt),
]);

export type MatchPreview = typeof matchPreviews.$inferSelect;
export type NewMatchPreview = typeof matchPreviews.$inferInsert;

// Match content: 3-section narrative for SEO/GEO
// Replaces raw odds panel with progressive content:
// 1. Pre-match (~150-200 words) - odds/market summary
// 2. Betting (~150-200 words) - AI predictions summary
// 3. Post-match (~150-200 words) - results/performance
export const matchContent = pgTable('match_content', {
  id: text('id').primaryKey(), // UUID
  matchId: text('match_id')
    .notNull()
    .unique()
    .references(() => matches.id, { onDelete: 'cascade' }),

  // Pre-match section (generated after odds refresh, ~6h before kickoff)
  preMatchContent: text('pre_match_content'),
  preMatchGeneratedAt: text('pre_match_generated_at'),

  // Betting section (generated after AI predictions, ~30m before kickoff)
  bettingContent: text('betting_content'),
  bettingGeneratedAt: text('betting_generated_at'),

  // Post-match section (generated after scoring complete)
  postMatchContent: text('post_match_content'),
  postMatchGeneratedAt: text('post_match_generated_at'),

  // AI generation metadata
  generatedBy: text('generated_by').default('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
  totalTokens: integer('total_tokens').default(0),
  totalCost: text('total_cost').default('0'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_match_content_match_id').on(table.matchId),
]);

export type MatchContent = typeof matchContent.$inferSelect;
export type NewMatchContent = typeof matchContent.$inferInsert;
