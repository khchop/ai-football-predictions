import { getLeaderboard } from './queries/stats';
import { getDb, competitions, matches, models, matchAnalysis, bets, modelBalances, seasons, predictions, blogPosts, leagueStandings, matchRoundups } from './index';
import { eq, and, desc, gte, lte, sql, inArray, ne, or, lt, not, isNull, isNotNull } from 'drizzle-orm';
import type { NewCompetition, NewModel, Match, MatchAnalysis, Model, Competition, Bet, ModelBalance, Prediction, BlogPost, NewMatch, NewMatchAnalysis, NewBet, NewModelBalance, NewPrediction } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from '@/lib/logger/modules';

import { withCache, cacheKeys, CACHE_TTL, cacheDelete } from '@/lib/cache/redis';
import { calculateQuotaScores } from '@/lib/utils/scoring';

// Legacy betting system constant (unused, kept for model_balances table compatibility)
const LEGACY_STARTING_BALANCE = 1000;

/**
 * Log database query errors with full context
 */
function logQueryError(operation: string, error: any, context?: Record<string, any>) {
   loggers.db.error({
     operation,
     message: error.message,
     code: error.code,
     severity: error.severity,
     detail: error.detail,
     hint: error.hint,
     position: error.position,
     table: error.table,
     column: error.column,
     constraint: error.constraint,
     dataType: error.dataType,
     file: error.file,
     line: error.line,
     routine: error.routine,
     ...context,
   }, 'Database query error');
 }

// ============= COMPETITIONS =============

export async function upsertCompetition(data: NewCompetition) {
  const db = getDb();
  
  // Fire-and-forget cache invalidation - don't fail DB operation if Redis is down
  try {
    await cacheDelete(cacheKeys.activeCompetitions());
  } catch (error) {
    logQueryError('cacheDelete', error, { operation: 'upsertCompetition', cacheKey: 'activeCompetitions' });
  }
  
  return db
    .insert(competitions)
    .values(data)
    .onConflictDoUpdate({
      target: competitions.id,
      set: {
        name: data.name,
        apiFootballId: data.apiFootballId,
        season: data.season,
        active: data.active,
      },
    });
}

// Cached version of getActiveCompetitions
export async function getActiveCompetitions(): Promise<Competition[]> {
  return withCache(
    cacheKeys.activeCompetitions(),
    CACHE_TTL.COMPETITIONS,
    async () => {
      const db = getDb();
      return db.select().from(competitions).where(eq(competitions.active, true));
    }
  );
}

// ============= MATCHES =============

export async function upsertMatch(data: Omit<NewMatch, 'id'> & { id?: string }): Promise<{ id: string }> {
  const db = getDb();
  const id = data.id || uuidv4();
  
  // Validate kickoffTime is a valid date
  const kickoffDate = new Date(data.kickoffTime);
  if (isNaN(kickoffDate.getTime())) {
    throw new Error(`Invalid kickoffTime: ${data.kickoffTime}`);
  }
  
  // Validate kickoffTime is not too far in the past (more than 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (kickoffDate < sevenDaysAgo) {
    throw new Error(`kickoffTime is too far in the past: ${data.kickoffTime}`);
  }
  
  // Validate kickoffTime is not too far in the future (more than 1 year)
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  if (kickoffDate > oneYearFromNow) {
    throw new Error(`kickoffTime is too far in the future: ${data.kickoffTime}`);
  }
  
  const result = await db
    .insert(matches)
    .values({ ...data, id })
    .onConflictDoUpdate({
      target: matches.externalId,
      set: {
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        status: data.status,
        updatedAt: new Date(),
      },
    })
    .returning({ id: matches.id });
  
  return result[0];
}

export async function getUpcomingMatches(hoursAhead: number = 48) {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString())
      )
    )
    .orderBy(matches.kickoffTime);
}

export async function getMatchesPendingResults() {
  const db = getDb();
  // Get matches that are scheduled/live and kickoff was more than 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  return db
    .select()
    .from(matches)
    .where(
      and(
        sql`${matches.status} IN ('scheduled', 'live')`,
        lte(matches.kickoffTime, twoHoursAgo.toISOString())
      )
    );
}

// Get matches stuck in 'scheduled' status where kickoff has passed (likely in progress)
export async function getStuckScheduledMatches() {
  const db = getDb();
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000); // Look back 3 hours max
  
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        lte(matches.kickoffTime, now.toISOString()),
        gte(matches.kickoffTime, threeHoursAgo.toISOString())
      )
    )
    .orderBy(matches.kickoffTime);
}

export async function getMatchById(id: string): Promise<{ match: Match; competition: Competition } | undefined> {
  const db = getDb();
  const result = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, id))
    .limit(1);
  
  return result[0];
}

/**
 * Get match by competition slug and match slug
 * Used for SEO-friendly URLs: /leagues/{league-slug}/{match-slug}
 */
export async function getMatchBySlug(competitionSlug: string, matchSlug: string): Promise<{ match: Match; competition: Competition } | undefined> {
  const db = getDb();
  const result = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(competitions.slug, competitionSlug),
        eq(matches.slug, matchSlug)
      )
    )
    .limit(1);
  
  return result[0];
}

/**
 * Get matches for a specific competition by its ID
 * NOTE: Uses competitions.id (e.g., 'epl', 'seriea') not slug
 */
export async function getMatchesByCompetitionId(competitionId: string, limit: number = 50) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(competitions.id, competitionId))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

/**
 * Get competition by slug (for SEO URLs like /leagues/champions-league)
 */
export async function getCompetitionBySlug(slug: string): Promise<Competition | undefined> {
  const db = getDb();
  const result = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);
  return result[0];
}

/**
 * Get competition by ID (e.g., 'epl', 'seriea')
 */
export async function getCompetitionById(id: string): Promise<Competition | undefined> {
  const db = getDb();
  const result = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  return result[0];
}

/**
 * Get top performing models for a specific competition
 * Returns models ranked by average points in this competition
 */
export async function getTopModelsByCompetition(competitionId: string, limit: number = 5) {
  const db = getDb();
  
  return db
    .select({
      model: models,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      accuracy: sql<number>`COALESCE(ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(${predictions.id}), 0)::numeric, 1), 0)`,
    })
    .from(models)
    .leftJoin(predictions, and(
      eq(predictions.modelId, models.id),
      eq(predictions.status, 'scored')
    ))
    .leftJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(
      eq(models.active, true),
      eq(matches.competitionId, competitionId)
    ))
    .groupBy(models.id)
    .orderBy(desc(sql`COALESCE(AVG(${predictions.totalPoints})::numeric, 0)`))
    .limit(limit);
}

/**
 * Get competition statistics (match results, goals, etc.)
 */
export async function getCompetitionStats(competitionId: string) {
  const db = getDb();
  
  const stats = await db
    .select({
      totalMatches: sql<number>`COUNT(*)`,
      finishedMatches: sql<number>`SUM(CASE WHEN ${matches.status} = 'finished' THEN 1 ELSE 0 END)`,
      scheduledMatches: sql<number>`SUM(CASE WHEN ${matches.status} = 'scheduled' THEN 1 ELSE 0 END)`,
      liveMatches: sql<number>`SUM(CASE WHEN ${matches.status} = 'live' THEN 1 ELSE 0 END)`,
      homeWins: sql<number>`SUM(CASE WHEN ${matches.status} = 'finished' AND ${matches.homeScore} > ${matches.awayScore} THEN 1 ELSE 0 END)`,
      awayWins: sql<number>`SUM(CASE WHEN ${matches.status} = 'finished' AND ${matches.homeScore} < ${matches.awayScore} THEN 1 ELSE 0 END)`,
      draws: sql<number>`SUM(CASE WHEN ${matches.status} = 'finished' AND ${matches.homeScore} = ${matches.awayScore} THEN 1 ELSE 0 END)`,
      totalGoals: sql<number>`SUM(CASE WHEN ${matches.status} = 'finished' THEN COALESCE(${matches.homeScore}, 0) + COALESCE(${matches.awayScore}, 0) ELSE 0 END)`,
      avgGoalsPerMatch: sql<number>`COALESCE(ROUND(AVG(CASE WHEN ${matches.status} = 'finished' THEN COALESCE(${matches.homeScore}, 0) + COALESCE(${matches.awayScore}, 0) END)::numeric, 2), 0)`,
    })
    .from(matches)
    .where(eq(matches.competitionId, competitionId));
  
  return stats[0] || {
    totalMatches: 0,
    finishedMatches: 0,
    scheduledMatches: 0,
    liveMatches: 0,
    homeWins: 0,
    awayWins: 0,
    draws: 0,
    totalGoals: 0,
    avgGoalsPerMatch: 0,
  };
}

/**
 * Get prediction summary for a competition
 * Shows model consensus, accuracy metrics, and prediction patterns
 */
export async function getCompetitionPredictionSummary(competitionId: string) {
  const db = getDb();
  
  // Get result type distribution from predictions
  const predictionBreakdown = await db
    .select({
      resultType: predictions.predictedResult,
      count: sql<number>`COUNT(*)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(
      eq(predictions.status, 'scored'),
      eq(matches.competitionId, competitionId)
    ))
    .groupBy(predictions.predictedResult);
  
  // Calculate overall accuracy for this competition
  const accuracyStats = await db
    .select({
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      maxPoints: sql<number>`MAX(${predictions.totalPoints})`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(
      eq(predictions.status, 'scored'),
      eq(matches.competitionId, competitionId)
    ));
  
  const accuracy = accuracyStats[0];
  const tendencyAccuracy = accuracy?.totalPredictions 
    ? (Number(accuracy.correctTendencies) / Number(accuracy.totalPredictions)) * 100 
    : 0;
  const exactAccuracy = accuracy?.totalPredictions 
    ? (Number(accuracy.exactScores) / Number(accuracy.totalPredictions)) * 100 
    : 0;
  
  // Find most predicted result
  let mostPredictedResult: 'H' | 'D' | 'A' = 'H';
  let mostPredictedCount = 0;
  for (const item of predictionBreakdown) {
    if (item.count && Number(item.count) > mostPredictedCount) {
      mostPredictedCount = Number(item.count);
      mostPredictedResult = (item.resultType as 'H' | 'D' | 'A') || 'H';
    }
  }
  
  const totalPredictions = predictionBreakdown.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const confidence = totalPredictions > 0 ? (mostPredictedCount / totalPredictions) * 100 : 0;
  
  return {
    totalPredictions: Number(accuracy?.totalPredictions) || 0,
    avgPointsPerPrediction: Number(accuracy?.avgPoints) || 0,
    tendencyAccuracy: Math.round(tendencyAccuracy * 10) / 10,
    exactScoreAccuracy: Math.round(exactAccuracy * 10) / 10,
    mostPredictedResult,
    confidence: Math.round(confidence * 10) / 10,
    predictionBreakdown: predictionBreakdown.map(p => ({
      resultType: p.resultType,
      count: Number(p.count) || 0,
      avgPoints: Number(p.avgPoints) || 0,
    })),
  };
}

/**
 * Get next scheduled match for a competition
 */
export async function getNextMatchForCompetition(competitionId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(and(
      eq(matches.competitionId, competitionId),
      eq(matches.status, 'scheduled'),
      gte(matches.kickoffTime, now)
    ))
    .orderBy(matches.kickoffTime)
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get standings for a competition
 */
export async function getStandingsByCompetitionId(competitionId: string) {
  const db = getDb();
  // We need to map competition ID string (e.g. "epl") to API Football ID if needed, 
  // or just use the competitions table to find it.
  const comp = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!comp[0]) return [];

  // IMPORTANT: Filter by BOTH leagueId AND season to get current season's standings
  // comp[0].season contains the current season (e.g., 2025 for 2025-26 season)
  return db
    .select()
    .from(leagueStandings)
    .where(
      and(
        eq(leagueStandings.leagueId, comp[0].apiFootballId),
        eq(leagueStandings.season, comp[0].season)
      )
    )
    .orderBy(leagueStandings.position);
}

/**
 * Get standings for specific teams in a competition
 */
export async function getStandingsForTeams(leagueId: number, teamNames: string[], season: number) {
  const db = getDb();
  return db
    .select()
    .from(leagueStandings)
    .where(
      and(
        eq(leagueStandings.leagueId, leagueId),
        eq(leagueStandings.season, season),
        inArray(leagueStandings.teamName, teamNames)
      )
    );
}

/**
 * Get next scheduled matches for specific teams
 */
export async function getNextMatchesForTeams(teamNames: string[], limit: number = 2) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now),
        or(
          inArray(matches.homeTeam, teamNames),
          inArray(matches.awayTeam, teamNames)
        )
      )
    )
    .orderBy(matches.kickoffTime)
    .limit(limit);
}

// Optimized: Single query for match with predictions
export async function getRecentMatches(limit: number = 20) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

export async function getFinishedMatches(limit: number = 100) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.status, 'finished'))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: string,
  matchMinute?: string | null
) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      homeScore,
      awayScore,
      status,
      matchMinute: matchMinute ?? null,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));
}

// Get all currently live matches
export async function getLiveMatches() {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.status, 'live'))
    .orderBy(matches.kickoffTime);
}

// Get count of live matches (for tab badge)
export async function getLiveMatchCount(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(eq(matches.status, 'live'));
  return result[0]?.count || 0;
}

// ============= MODELS =============

export async function upsertModel(data: NewModel) {
  const db = getDb();
  return db
    .insert(models)
    .values(data)
    .onConflictDoUpdate({
      target: models.id,
      set: {
        modelName: data.modelName,
        displayName: data.displayName,
        isPremium: data.isPremium,
        active: data.active,
      },
    });
}

// Cached version of getActiveModels
export async function getActiveModels(): Promise<Model[]> {
  return withCache(
    cacheKeys.activeModels(),
    CACHE_TTL.MODELS,
    async () => {
      const db = getDb();
      return db.select().from(models).where(eq(models.active, true));
    }
  );
}

// Deactivate models not in the provided list of IDs
export async function deactivateOldModels(activeModelIds: string[]) {
  const db = getDb();
  
  // Fire-and-forget cache invalidation - don't fail DB operation if Redis is down
  try {
    await cacheDelete(cacheKeys.activeModels());
  } catch (error) {
    logQueryError('cacheDelete', error, { operation: 'deactivateOldModels', cacheKey: 'activeModels' });
  }
  
  return db
    .update(models)
    .set({ active: false })
    .where(not(inArray(models.id, activeModelIds)));
}

export async function getModelById(id: string): Promise<Model | undefined> {
  const db = getDb();
  const result = await db.select().from(models).where(eq(models.id, id)).limit(1);
  return result[0];
}

/**
 * Determine if a match result should update model streaks
 *
 * Rules:
 * - Only finished matches with valid scores count
 * - Voided, cancelled, postponed matches do NOT affect streaks
 * - Predictions with 'void' status do NOT affect streaks
 */
export function shouldUpdateStreak(
  matchStatus: string,
  homeScore: number | null,
  awayScore: number | null,
  predictionStatus: string
): boolean {
  // Only finished matches count
  if (matchStatus !== 'finished') {
    return false;
  }

  // Must have valid scores
  if (homeScore === null || awayScore === null) {
    return false;
  }

  // Voided predictions don't count
  if (predictionStatus === 'void') {
    return false;
  }

  // Valid match with valid prediction - update streak
  return true;
}

// Update model streak after a prediction is scored
// resultType: 'exact' (exact score), 'tendency' (correct result), 'wrong' (wrong result)
// Uses a transaction to prevent race conditions when multiple predictions are scored concurrently
export async function updateModelStreak(
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
) {
  const db = getDb();
  
  // Use transaction with row-level locking to prevent race conditions
  await db.transaction(async (tx) => {
    // Lock model row for update to prevent concurrent streak modifications
    const modelResult = await tx
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .for('update')
      .limit(1);
    
    const model = modelResult[0];
    if (!model) return;

    const currentStreak = model.currentStreak || 0;
    const currentStreakType = model.currentStreakType || 'none';
    let bestStreak = model.bestStreak || 0;
    let worstStreak = model.worstStreak || 0;
    let bestExactStreak = model.bestExactStreak || 0;
    let bestTendencyStreak = model.bestTendencyStreak || 0;

    let newStreak: number;
    let newStreakType: string;

    if (resultType === 'wrong') {
      // Wrong prediction - start or extend losing streak
      if (currentStreak < 0) {
        newStreak = currentStreak - 1; // Extend losing streak
      } else {
        newStreak = -1; // Start new losing streak
      }
      newStreakType = 'none';
      // Update worst streak if this is worse
      if (newStreak < worstStreak) {
        worstStreak = newStreak;
      }
    } else {
      // Correct prediction (exact or tendency)
      if (currentStreak > 0) {
        newStreak = currentStreak + 1; // Extend winning streak
        // Keep the "better" streak type (exact > tendency)
        if (resultType === 'exact') {
          newStreakType = 'exact';
        } else {
          newStreakType = currentStreakType === 'exact' ? 'exact' : 'tendency';
        }
      } else {
        newStreak = 1; // Start new winning streak
        newStreakType = resultType;
      }
      // Update best streaks
      if (newStreak > bestStreak) {
        bestStreak = newStreak;
      }
      // Track consecutive exact scores separately
      if (resultType === 'exact') {
        const exactCount = currentStreakType === 'exact' ? bestExactStreak + 1 : 1;
        if (exactCount > bestExactStreak) {
          bestExactStreak = exactCount;
        }
      }
      if (newStreak > bestTendencyStreak) {
        bestTendencyStreak = newStreak;
      }
    }

    await tx
      .update(models)
      .set({
        currentStreak: newStreak,
        currentStreakType: newStreakType,
        bestStreak,
        worstStreak,
        bestExactStreak,
        bestTendencyStreak,
      })
      .where(eq(models.id, modelId));
  });
}

// Update model retry statistics after prediction batch
// Called when retries were attempted (successful or not)
export async function updateModelRetryStats(
  modelId: string,
  retriesAttempted: number,
  retriesSuccessful: number
): Promise<void> {
  if (retriesAttempted === 0) return; // No retries, nothing to update
  
  const db = getDb();
  
  await db
    .update(models)
    .set({
      totalRetryAttempts: sql`COALESCE(${models.totalRetryAttempts}, 0) + ${retriesAttempted}`,
      totalRetrySuccesses: sql`COALESCE(${models.totalRetrySuccesses}, 0) + ${retriesSuccessful}`,
      lastRetryAt: new Date().toISOString(),
    })
    .where(eq(models.id, modelId));
}

// ============= MODEL HEALTH TRACKING =============

// Record a successful prediction for a model (resets failure count)
// Atomic SQL UPDATE prevents lost updates under concurrent predictions
export async function recordModelSuccess(modelId: string): Promise<void> {
  const db = getDb();
  
  // PostgreSQL UPDATE is atomic - all fields updated atomically in a single operation
  await db
    .update(models)
    .set({
      consecutiveFailures: 0,
      lastSuccessAt: new Date().toISOString(),
      failureReason: null,
      // Re-enable if it was auto-disabled
      autoDisabled: false,
    })
    .where(eq(models.id, modelId));
}

// Record a failed prediction attempt for a model
// Auto-disables after 5 consecutive MODEL-SPECIFIC failures (parse errors, 4xx)
// Transient errors (rate limits, timeouts, 5xx) do NOT count toward disable
export async function recordModelFailure(
  modelId: string,
  reason: string,
  errorType?: string
): Promise<{ autoDisabled: boolean; consecutiveFailures: number }> {
  const db = getDb();

  const DISABLE_THRESHOLD = 5;
  const isModelSpecific = errorType === 'parse-error' || errorType === 'client-error';

  // Only increment consecutive failures for model-specific errors
  const incrementExpr = isModelSpecific
    ? sql`COALESCE(${models.consecutiveFailures}, 0) + 1`
    : models.consecutiveFailures;

  // Auto-disable only for model-specific failures at threshold
  const autoDisableExpr = isModelSpecific
    ? sql`CASE WHEN COALESCE(${models.consecutiveFailures}, 0) + 1 >= ${DISABLE_THRESHOLD} THEN TRUE ELSE ${models.autoDisabled} END`
    : models.autoDisabled;

  // Use atomic SQL to avoid race condition
  const result = await db
    .update(models)
    .set({
      consecutiveFailures: incrementExpr,
      lastFailureAt: new Date().toISOString(),
      failureReason: reason.substring(0, 500), // Truncate long error messages
      autoDisabled: autoDisableExpr,
    })
    .where(eq(models.id, modelId))
    .returning({
      consecutiveFailures: models.consecutiveFailures,
      autoDisabled: models.autoDisabled,
    });

  const updated = result[0];

  // Log auto-disable event
  if (updated?.autoDisabled && isModelSpecific) {
    loggers.db.warn({
      modelId,
      consecutiveFailures: updated.consecutiveFailures,
      threshold: DISABLE_THRESHOLD,
      errorType,
    }, 'Model auto-disabled after consecutive failures');
  }

  return {
    autoDisabled: updated?.autoDisabled || false,
    consecutiveFailures: updated?.consecutiveFailures || 0,
  };
}

// Re-enable a model that was auto-disabled (legacy - use recoverDisabledModels for automated recovery)
export async function reEnableModel(modelId: string): Promise<void> {
  const db = getDb();
  await db
    .update(models)
    .set({
      autoDisabled: false,
      consecutiveFailures: 0,
      failureReason: null,
    })
    .where(eq(models.id, modelId));
}

// Recover auto-disabled models after cooldown
// Partial reset: consecutiveFailures = 2 (require 3 more failures before re-disable at threshold 5)
export async function recoverDisabledModels(): Promise<number> {
  const db = getDb();
  const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

  const disabledModels = await getAutoDisabledModels();
  let recoveredCount = 0;

  for (const model of disabledModels) {
    const lastFailure = model.lastFailureAt ? new Date(model.lastFailureAt).getTime() : 0;
    const timeSinceFailure = Date.now() - lastFailure;

    if (timeSinceFailure >= COOLDOWN_MS) {
      // Reset to partial count (2) - not fully trusted yet
      await db
        .update(models)
        .set({
          autoDisabled: false,
          consecutiveFailures: 2,
          failureReason: 'Recovered after 1h cooldown',
        })
        .where(eq(models.id, model.id));

      loggers.db.info({
        modelId: model.id,
        displayName: model.displayName,
        consecutiveFailures: 2,
        cooldownHours: COOLDOWN_MS / (60 * 60 * 1000),
      }, 'Model re-enabled after cooldown with partial reset');

      recoveredCount++;
    }
  }

  return recoveredCount;
}

// Get all models with their health status (for admin page)
export async function getAllModelsWithHealth(): Promise<Model[]> {
  const db = getDb();
  return db
    .select()
    .from(models)
    .where(eq(models.active, true))
    .orderBy(models.displayName);
}

// Get models that are auto-disabled
export async function getAutoDisabledModels(): Promise<Model[]> {
  const db = getDb();
  return db
    .select()
    .from(models)
    .where(eq(models.autoDisabled, true))
    .orderBy(models.displayName);
}

// Get IDs of all auto-disabled models (for filtering in providers)
export async function getAutoDisabledModelIds(): Promise<Set<string>> {
  const db = getDb();
  const results = await db
    .select({ id: models.id })
    .from(models)
    .where(eq(models.autoDisabled, true));
  
  return new Set(results.map(r => r.id));
}

// Check if a model should be skipped due to health issues
export function shouldSkipModelDueToHealth(model: Model): boolean {
  return model.autoDisabled === true;
}

// ============= BETTING SYSTEM =============

// Get current season
export async function getCurrentSeason(): Promise<string> {
  const db = getDb();
  const result = await db
    .select({ name: seasons.name })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1);
  
  return result[0]?.name || '2024-2025';
}

// Get model balance for current season
export async function getModelBalance(modelId: string, season: string): Promise<ModelBalance | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(modelBalances)
    .where(
      and(
        eq(modelBalances.modelId, modelId),
        eq(modelBalances.season, season)
      )
    )
    .limit(1);
  
  return result[0] || null;
}

// Get or create model balance (lazy initialization)
export async function getOrCreateModelBalance(modelId: string, season: string): Promise<ModelBalance> {
  const db = getDb();
  
  // Try to get existing balance
  let balance = await getModelBalance(modelId, season);
  
  if (!balance) {
    // Create new balance with defaults
    const newBalance: NewModelBalance = {
      id: crypto.randomUUID(),
      modelId,
      season,
      startingBalance: LEGACY_STARTING_BALANCE,
      currentBalance: LEGACY_STARTING_BALANCE,
      totalWagered: 0,
      totalWon: 0,
      totalBets: 0,
      winningBets: 0,
    };
    
    await db.insert(modelBalances).values(newBalance).onConflictDoNothing();
    
    // Fetch the created/existing balance
    balance = await getModelBalance(modelId, season);
    
    if (!balance) {
      throw new Error(`Failed to create balance for model ${modelId} in season ${season}`);
    }
  }
  
  return balance;
}

// Create or update model balance
export async function upsertModelBalance(data: NewModelBalance) {
  const db = getDb();
  return db
    .insert(modelBalances)
    .values(data)
    .onConflictDoUpdate({
      target: [modelBalances.modelId, modelBalances.season],
      set: {
        currentBalance: data.currentBalance,
        totalWagered: data.totalWagered,
        totalWon: data.totalWon,
        totalBets: data.totalBets,
        winningBets: data.winningBets,
        updatedAt: sql`now()`,
      },
    });
}

// Create a bet
export async function createBet(data: NewBet) {
  const db = getDb();
  return db.insert(bets).values(data);
}

// Create multiple bets (INTERNAL: Use createBetsWithBalanceUpdate for external calls)
async function createBets(betsData: NewBet[]) {
  const db = getDb();
  return db.insert(bets).values(betsData);
}

// Get bets for a match
export async function getBetsByMatch(matchId: string): Promise<Bet[]> {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .where(eq(bets.matchId, matchId))
    .orderBy(bets.modelId, bets.betType);
}

// Get bets for a model
export async function getBetsByModel(modelId: string, limit: number = 100): Promise<Bet[]> {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .where(eq(bets.modelId, modelId))
    .orderBy(desc(bets.createdAt))
    .limit(limit);
}

// Get pending bets for a match
export async function getPendingBetsByMatch(matchId: string): Promise<Bet[]> {
  const db = getDb();
  return db
    .select()
    .from(bets)
    .where(
      and(
        eq(bets.matchId, matchId),
        eq(bets.status, 'pending')
      )
    );
}

/**
 * Lock ordering for transactions to prevent deadlocks:
 * REQUIRED ORDER: models -> bets -> modelBalances
 * 
 * All transactions must acquire locks in this order to prevent circular wait conditions.
 * If a transaction needs multiple tables, it must lock them in this order.
 */

// Create bets and update balance atomically (transaction)
export async function createBetsWithBalanceUpdate(
  betsData: NewBet[],
  modelId: string,
  season: string,
  totalStake: number
) {
  const db = getDb();
  
   return db.transaction(async (tx) => {
     // LOCK ORDER: bets -> modelBalances (per global lock ordering policy)
     
     // Insert all bets (locks bets table)
     await tx.insert(bets).values(betsData);
     
     // Verify balance exists (then lock modelBalances)
     const balanceResult = await tx
       .select()
       .from(modelBalances)
       .where(and(
         eq(modelBalances.modelId, modelId),
         eq(modelBalances.season, season)
       ))
       .limit(1);
     
     if (!balanceResult[0]) {
       throw new Error(`No balance found for model ${modelId} in season ${season}`);
     }
     
     // Update balance with atomic SQL operations
     await tx
       .update(modelBalances)
       .set({
          currentBalance: sql`${modelBalances.currentBalance} - ${totalStake}`,
          totalWagered: sql`${modelBalances.totalWagered} + ${totalStake}`,
          totalBets: sql`${modelBalances.totalBets} + ${betsData.length}`,
          updatedAt: new Date(),
        })
       .where(and(
         eq(modelBalances.modelId, modelId),
         eq(modelBalances.season, season)
       ));
   });
}

// Update bet outcome
export async function settleBet(
  betId: string,
  status: 'won' | 'lost' | 'void',
  payout: number,
  profit: number
) {
  const db = getDb();
  return db
    .update(bets)
    .set({
      status,
      payout,
      profit,
      settledAt: new Date(),
    })
    .where(eq(bets.id, betId));
}

// Settle multiple bets and update balances atomically (transaction)
export async function settleBetsTransaction(
  betsToSettle: Array<{
    betId: string;
    status: 'won' | 'lost' | 'void';
    payout: number;
    profit: number;
  }>,
  balanceUpdates: Map<string, { totalPayout: number; winsCount: number }>,
  season: string
) {
  const db = getDb();
  
   return db.transaction(async (tx) => {
      const settledAtDate = new Date();
      
      // LOCK ORDER: bets -> modelBalances (per global lock ordering policy)
      // Batch update all bets using SQL CASE expressions (single query instead of N+1)
      // This prevents connection pool exhaustion with large bet batches
     if (betsToSettle.length > 0) {
       // Build CASE expressions for status, payout, and profit fields
       const statusCaseWhen = betsToSettle
         .map(b => `WHEN '${b.betId}' THEN '${b.status}'`)
         .join(' ');
       
       const payoutCaseWhen = betsToSettle
         .map(b => `WHEN '${b.betId}' THEN ${b.payout}`)
         .join(' ');
       
       const profitCaseWhen = betsToSettle
         .map(b => `WHEN '${b.betId}' THEN ${b.profit}`)
         .join(' ');
       
       const betIds = betsToSettle.map(b => `'${b.betId}'`).join(',');
       
       // Execute batch update with CASE expressions
       await tx.execute(sql`
         UPDATE bets 
         SET 
           status = CASE id ${sql.raw(statusCaseWhen)} END,
           payout = CASE id ${sql.raw(payoutCaseWhen)} END,
           profit = CASE id ${sql.raw(profitCaseWhen)} END,
           settled_at = ${settledAtDate}
         WHERE id IN (${sql.raw(betIds)})
       `);
     }
     
     // Update all model balances (atomic SQL prevents race conditions)
     for (const [modelId, update] of balanceUpdates) {
       await tx
         .update(modelBalances)
         .set({
           currentBalance: sql`COALESCE(${modelBalances.currentBalance}, 0) + ${update.totalPayout}`,
           totalWon: sql`COALESCE(${modelBalances.totalWon}, 0) + ${update.totalPayout}`,
           winningBets: sql`COALESCE(${modelBalances.winningBets}, 0) + ${update.winsCount}`,
           updatedAt: settledAtDate,
         })
         .where(and(
           eq(modelBalances.modelId, modelId),
           eq(modelBalances.season, season)
         ));
     }
  });
}

// Update model balance after bets
export async function updateModelBalanceAfterBets(
  modelId: string,
  season: string,
  amountChange: number,
  betsCount: number,
  winsCount: number
) {
  const db = getDb();
  
  // Use atomic SQL operations to avoid race condition
  return db
    .update(modelBalances)
     .set({
       currentBalance: sql`COALESCE(${modelBalances.currentBalance}, 0) + ${amountChange}`,
       totalWagered: sql`COALESCE(${modelBalances.totalWagered}, 0) + ${amountChange < 0 ? Math.abs(amountChange) : 0}`,
       totalWon: sql`COALESCE(${modelBalances.totalWon}, 0) + ${amountChange > 0 ? amountChange : 0}`,
       totalBets: sql`COALESCE(${modelBalances.totalBets}, 0) + ${betsCount}`,
       winningBets: sql`COALESCE(${modelBalances.winningBets}, 0) + ${winsCount}`,
       updatedAt: new Date(),
     })
    .where(
      and(
        eq(modelBalances.modelId, modelId),
        eq(modelBalances.season, season)
      )
    );
}

// Get model betting history
export async function getModelBettingHistory(
  modelId: string,
  options: { limit?: number; offset?: number; status?: 'pending' | 'won' | 'lost' } = {}
) {
  const db = getDb();
  const { limit = 50, offset = 0, status } = options;

  const conditions = [eq(bets.modelId, modelId)];
  if (status) {
    conditions.push(eq(bets.status, status));
  }

  return db
    .select({
      betId: bets.id,
      matchId: bets.matchId,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      matchStatus: matches.status,
      kickoffTime: matches.kickoffTime,
      competitionName: competitions.name,
      betType: bets.betType,
      selection: bets.selection,
      odds: bets.odds,
      stake: bets.stake,
      status: bets.status,
      payout: bets.payout,
      profit: bets.profit,
      createdAt: bets.createdAt,
      settledAt: bets.settledAt,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(and(...conditions))
    .orderBy(desc(bets.createdAt))
    .limit(limit)
    .offset(offset);
}

// Get betting stats for a model
export async function getModelBettingStats(modelId: string) {
  const db = getDb();
  const currentSeason = await getCurrentSeason();

  const balance = await getModelBalance(modelId, currentSeason);
  
  if (!balance) {
    return null;
  }

  const profit = (balance.currentBalance || 0) - (balance.startingBalance || LEGACY_STARTING_BALANCE);
  const roi = balance.startingBalance ? (profit / balance.startingBalance) * 100 : 0;
  const winRate = balance.totalBets ? ((balance.winningBets || 0) / balance.totalBets) * 100 : 0;

  return {
    balance: balance.currentBalance || 0,
    startingBalance: balance.startingBalance || LEGACY_STARTING_BALANCE,
    profit,
    roi,
    totalBets: balance.totalBets || 0,
    winningBets: balance.winningBets || 0,
    losingBets: (balance.totalBets || 0) - (balance.winningBets || 0),
    winRate,
    totalWagered: balance.totalWagered || 0,
    totalWon: balance.totalWon || 0,
  };
}



// Get health status for multiple models at once (batch query)
export async function getModelHealthBatch(modelIds: string[]): Promise<Map<string, Model>> {
  const db = getDb();
  
  if (modelIds.length === 0) {
    return new Map();
  }
  
  const results = await db
    .select()
    .from(models)
    .where(inArray(models.id, modelIds));
  
  const healthMap = new Map<string, Model>();
  for (const model of results) {
    healthMap.set(model.id, model);
  }
  
  return healthMap;
}

// ============= MATCH ANALYSIS =============

export async function upsertMatchAnalysis(data: NewMatchAnalysis) {
  const db = getDb();
  return db
    .insert(matchAnalysis)
    .values(data)
    .onConflictDoUpdate({
      target: matchAnalysis.matchId,
      set: {
        ...data,
        analysisUpdatedAt: new Date().toISOString(),
      },
    });
}

export async function getMatchAnalysisByMatchId(matchId: string): Promise<MatchAnalysis | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(matchAnalysis)
    .where(eq(matchAnalysis.matchId, matchId))
    .limit(1);
  return result[0] || null;
}

export async function updateMatchAnalysisLineups(
  matchId: string,
  lineupData: {
    homeFormation: string | null;
    awayFormation: string | null;
    homeStartingXI: string;
    awayStartingXI: string;
    homeCoach: string | null;
    awayCoach: string | null;
    lineupsAvailable: boolean;
    lineupsUpdatedAt: string;
    rawLineupsData: string;
  }
) {
  const db = getDb();
  
  // First check if analysis exists
  const existing = await getMatchAnalysisByMatchId(matchId);
  if (!existing) {
    throw new Error(`No analysis found for match ${matchId}`);
  }
  
  return db
    .update(matchAnalysis)
    .set(lineupData)
    .where(eq(matchAnalysis.matchId, matchId));
}

// ============= LEGACY FUNCTIONS (DEPRECATED - Betting System Only) =============
// These functions are stubs to allow build to succeed while UI is migrated to betting system

export async function getMatchWithAnalysis(matchId: string) {
  const db = getDb();
  
  // Get match with competition and analysis
  const matchWithAnalysis = await db
    .select({
      match: matches,
      competition: competitions,
      analysis: matchAnalysis,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchWithAnalysis[0]) return null;

  return {
    match: matchWithAnalysis[0].match,
    competition: matchWithAnalysis[0].competition,
    analysis: matchWithAnalysis[0].analysis,
    predictions: [], // Empty - predictions table removed
  };
}

export async function getOverallStats() {
  return withCache(
    cacheKeys.overallStats(),
    CACHE_TTL.STATS,
    async () => {
      const db = getDb();
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM matches)::int as total_matches,
          (SELECT COUNT(*) FROM matches WHERE status = 'finished')::int as finished_matches,
          (SELECT COUNT(*) FROM predictions)::int as total_predictions,
          (SELECT COUNT(*) FROM models WHERE active = true)::int as active_models
      `);
      
      const row = result.rows[0] as {
        total_matches: number;
        finished_matches: number;
        total_predictions: number;
        active_models: number;
      };
      
      return {
        totalMatches: row?.total_matches || 0,
        finishedMatches: row?.finished_matches || 0,
        totalPredictions: row?.total_predictions || 0,
        activeModels: row?.active_models || 0,
      };
    }
  );
}

/**
 * Get top performing model (by average points)
 * Used for homepage featured insights
 */
export async function getTopPerformingModel() {
  return withCache(
    cacheKeys.topPerformingModel(),
    CACHE_TTL.STATS,
    async () => {
      try {
        // Use existing getLeaderboard query but limit to 1
        const leaderboard = await getLeaderboard(1);
        
        if (leaderboard.length === 0) {
          return null;
        }
        
        const topModel = leaderboard[0];
        return {
          displayName: topModel.displayName,
          avgPoints: Number(topModel.avgPoints) || 0,
        };
      } catch (error) {
        logQueryError('getTopPerformingModel', error);
        return null;
      }
    }
  );
}

export async function getModelOverallStats(modelId: string) {
  // Return empty stats - model detail page should use betting stats instead
  return {
    totalPredictions: 0,
    totalPoints: 0,
    averagePoints: 0,
    accuracy: 0,
    exactScores: 0,
    correctTendencies: 0,
    correctGoalDiffs: 0,
  };
}

export async function getModelWeeklyPerformance(modelId: string, maxDays: number = 90) {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);

  return db
    .select({
      weekStart: sql<string>`date_trunc('week', ${matches.kickoffTime}::timestamp)::text`,
      matchCount: sql<number>`count(${predictions.id})`,
      totalPoints: sql<number>`sum(${predictions.totalPoints})`,
      avgPoints: sql<number>`round(avg(${predictions.totalPoints})::numeric, 2)`,
      accuracy: sql<number>`round((sum(case when ${predictions.tendencyPoints} > 0 then 1 else 0 end)::float / count(${predictions.id})::float * 100)::numeric, 1)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(
      eq(predictions.modelId, modelId),
      eq(predictions.status, 'scored'),
      gte(matches.kickoffTime, cutoff.toISOString())
    ))
    .groupBy(sql`date_trunc('week', ${matches.kickoffTime}::timestamp)`)
    .orderBy(sql`date_trunc('week', ${matches.kickoffTime}::timestamp)`);
}

export async function getModelStatsByCompetition(modelId: string) {
  const db = getDb();
  return db
    .select({
      competitionId: competitions.id,
      competitionName: competitions.name,
      totalPredictions: sql<number>`count(${predictions.id})`,
      correctTendencies: sql<number>`sum(case when ${predictions.tendencyPoints} > 0 then 1 else 0 end)`,
      exactScores: sql<number>`sum(case when ${predictions.exactScoreBonus} = 3 then 1 else 0 end)`,
      totalPoints: sql<number>`sum(${predictions.totalPoints})`,
      averagePoints: sql<number>`round(avg(${predictions.totalPoints})::numeric, 2)`,
      accuracy: sql<number>`round((sum(case when ${predictions.tendencyPoints} > 0 then 1 else 0 end)::float / count(${predictions.id})::float * 100)::numeric, 1)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(and(
      eq(predictions.modelId, modelId),
      eq(predictions.status, 'scored')
    ))
    .groupBy(competitions.id, competitions.name)
    .orderBy(desc(sql`count(${predictions.id})`));
}

export async function getModelFunStats(modelId: string) {
  // Return empty object - no longer available without predictions table
  return {
    mostPredictedScore: null,
    bestExactScore: null,
    avgProcessingTime: null,
    totalExactScores: 0,
  };
}

// ============= BACKFILL QUERIES =============

// Get scheduled matches missing analysis data
export async function getMatchesMissingAnalysis(hoursAhead: number = 12): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  const results = await db
    .select({ match: matches })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString()),
        isNotNull(matches.externalId),
        isNull(matchAnalysis.id) // No analysis record exists
      )
    )
    .orderBy(matches.kickoffTime);
  
  return results.map(r => r.match);
}

// Get matches with analysis but missing odds
export async function getMatchesMissingOdds(hoursAhead: number = 6): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  const results = await db
    .select({ match: matches })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString()),
        isNotNull(matches.externalId),
        isNull(matchAnalysis.oddsHome) // Has analysis but no odds
      )
    )
    .orderBy(matches.kickoffTime);
  
  return results.map(r => r.match);
}

// Get matches missing lineups (has analysis, < X hours to kickoff)
export async function getMatchesMissingLineups(hoursAhead: number = 2): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  const results = await db
    .select({ match: matches })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString()),
        isNotNull(matches.externalId),
        eq(matchAnalysis.lineupsAvailable, false) // Lineups not yet fetched
      )
    )
    .orderBy(matches.kickoffTime);
  
  return results.map(r => r.match);
}

// Get matches missing bets (has lineups, < X hours to kickoff, no bets)
// Deprecated: Use getMatchesMissingPredictions instead
export async function getMatchesMissingBets(hoursAhead: number = 2): Promise<Match[]> {
  return getMatchesMissingPredictions(hoursAhead);
}

// Deprecated: Use getMatchesNeedingScoring instead
export async function getMatchesNeedingSettlement(): Promise<Match[]> {
  return getMatchesNeedingScoring();
}

// ============= ADDITIONAL QUERIES =============

// Get match by external ID (API-Football fixture ID)
export async function getMatchByExternalId(externalId: string): Promise<Match | null> {
  const db = getDb();
  
  const results = await db
    .select()
    .from(matches)
    .where(eq(matches.externalId, externalId))
    .limit(1);
  
  return results[0] || null;
}

// ============= PREDICTIONS SYSTEM (Kicktipp Quota Scoring) =============

/**
 * Helper function to update model streak within a transaction context
 * Uses FOR UPDATE row-level locking to prevent lost updates when multiple
 * predictions for the same model are scored concurrently.
 */
async function updateModelStreakInTransaction(
  tx: any, // Transaction context from drizzle-orm
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
): Promise<void> {
  // Lock model row for update to prevent concurrent streak modifications
  const modelResult = await tx
    .select()
    .from(models)
    .where(eq(models.id, modelId))
    .for('update')
    .limit(1);

  const model = modelResult[0];
  if (!model) return;

  const currentStreak = model.currentStreak || 0;
  const currentStreakType = model.currentStreakType || 'none';
  let bestStreak = model.bestStreak || 0;
  let worstStreak = model.worstStreak || 0;
  let bestExactStreak = model.bestExactStreak || 0;
  let bestTendencyStreak = model.bestTendencyStreak || 0;

  let newStreak: number;
  let newStreakType: string;

  if (resultType === 'wrong') {
    // Wrong prediction - start or extend losing streak
    if (currentStreak < 0) {
      newStreak = currentStreak - 1; // Extend losing streak
    } else {
      newStreak = -1; // Start new losing streak
    }
    newStreakType = 'none';
    // Update worst streak if this is worse
    if (newStreak < worstStreak) {
      worstStreak = newStreak;
    }
  } else {
    // Correct prediction (exact or tendency)
    if (currentStreak > 0) {
      newStreak = currentStreak + 1; // Extend winning streak
      // Keep the "better" streak type (exact > tendency)
      if (resultType === 'exact') {
        newStreakType = 'exact';
      } else {
        newStreakType = currentStreakType === 'exact' ? 'exact' : 'tendency';
      }
    } else {
      newStreak = 1; // Start new winning streak
      newStreakType = resultType;
    }
    // Update best streaks
    if (newStreak > bestStreak) {
      bestStreak = newStreak;
    }
    // Track consecutive exact scores separately
    if (resultType === 'exact') {
      const exactCount = currentStreakType === 'exact' ? bestExactStreak + 1 : 1;
      if (exactCount > bestExactStreak) {
        bestExactStreak = exactCount;
      }
    }
    if (newStreak > bestTendencyStreak) {
      bestTendencyStreak = newStreak;
    }
  }

  await tx
    .update(models)
    .set({
      currentStreak: newStreak,
      currentStreakType: newStreakType,
      bestStreak,
      worstStreak,
      bestExactStreak,
      bestTendencyStreak,
    })
    .where(eq(models.id, modelId));
}

/**
 * Score all predictions for a match in a single database transaction with row-level locking.
 *
 * This function prevents race conditions when concurrent settlement jobs attempt to score
 * the same match (e.g., live-score worker + backfill job running simultaneously).
 *
 * Uses SELECT FOR UPDATE to lock prediction rows during scoring, ensuring exactly-once
 * scoring per prediction even under concurrent access.
 *
 * IMPORTANT: Cache invalidation must be called by the caller AFTER this function returns
 * successfully. Do NOT call cache invalidation inside transactions.
 *
 * @returns Object with success status, scored count, failed count, and optional error
 */
export async function scorePredictionsTransactional(
  matchId: string,
  actualHome: number,
  actualAway: number,
  quotas: { home: number; draw: number; away: number },
  matchStatus: string = 'finished'
): Promise<{
  success: boolean;
  scoredCount: number;
  failedCount: number;
  totalPointsAwarded: number;
  error?: string;
}> {
  const db = getDb();
  const log = loggers.db.child({ matchId, fn: 'scorePredictionsTransactional' });

  let scoredCount = 0;
  let failedCount = 0;
  let totalPointsAwarded = 0;

  try {
    await db.transaction(async (tx) => {
      // Step 1: Lock all pending predictions for this match with FOR UPDATE
      // This prevents other settlement jobs from reading/updating these rows
      const pendingPredictions = await tx
        .select()
        .from(predictions)
        .where(and(
          eq(predictions.matchId, matchId),
          eq(predictions.status, 'pending')
        ))
        .for('update');

      // If no pending predictions, another job already scored them (idempotent)
      if (pendingPredictions.length === 0) {
        log.info('No pending predictions found - already scored');
        return;
      }

      log.info({ count: pendingPredictions.length }, 'Locked predictions for scoring');

      // Step 2: Score each prediction within the transaction
      for (const prediction of pendingPredictions) {
        try {
          // Calculate points using Kicktipp Quota System
          const breakdown = calculateQuotaScores({
            predictedHome: prediction.predictedHome,
            predictedAway: prediction.predictedAway,
            actualHome,
            actualAway,
            quotaHome: quotas.home,
            quotaDraw: quotas.draw,
            quotaAway: quotas.away,
          });

          // Update prediction with scores
          await tx
            .update(predictions)
            .set({
              tendencyPoints: breakdown.tendencyPoints,
              goalDiffBonus: breakdown.goalDiffBonus,
              exactScoreBonus: breakdown.exactScoreBonus,
              totalPoints: breakdown.total,
              status: 'scored',
              scoredAt: new Date(),
            })
            .where(eq(predictions.id, prediction.id));

          // Step 3: Update model streak within same transaction (if valid)
          // Uses shouldUpdateStreak to check match status, scores, and prediction status
          // Voided/cancelled/postponed matches do NOT affect streaks
          if (shouldUpdateStreak(matchStatus, actualHome, actualAway, prediction.status || 'pending')) {
            const resultType: 'exact' | 'tendency' | 'wrong' =
              breakdown.total === 0 ? 'wrong' :
              breakdown.exactScoreBonus > 0 ? 'exact' : 'tendency';

            try {
              await updateModelStreakInTransaction(tx, prediction.modelId, resultType);
            } catch (streakError: any) {
              // Log but don't fail - prediction score is the primary concern
              log.warn({
                modelId: prediction.modelId,
                resultType,
                error: streakError.message
              }, 'Failed to update model streak within transaction');
            }
          } else {
            log.debug({
              modelId: prediction.modelId,
              matchStatus,
              predictionStatus: prediction.status,
            }, 'Skipping streak update - match/prediction not valid for streak tracking');
          }

          scoredCount++;
          totalPointsAwarded += breakdown.total;

          log.debug({
            predictionId: prediction.id,
            modelId: prediction.modelId,
            points: breakdown.total,
          }, 'Scored prediction');

        } catch (predError: any) {
          failedCount++;
          log.error({
            predictionId: prediction.id,
            modelId: prediction.modelId,
            error: predError.message,
          }, 'Failed to score individual prediction');
          // Continue with other predictions - don't abort entire transaction
          // unless we want strict all-or-nothing (can be changed if needed)
        }
      }
    });

    return {
      success: true,
      scoredCount,
      failedCount,
      totalPointsAwarded,
    };

  } catch (error: any) {
    log.error({ error: error.message, stack: error.stack }, 'Transaction failed');
    return {
      success: false,
      scoredCount: 0,
      failedCount: 0,
      totalPointsAwarded: 0,
      error: error.message,
    };
  }
}

// Get predictions for a match with model details
export async function getPredictionsForMatchWithDetails(matchId: string) {
  const db = getDb();
  
  return db
    .select({
      predictionId: predictions.id,
      modelId: predictions.modelId,
      modelDisplayName: models.displayName,
      provider: models.provider,
      predictedHome: predictions.predictedHome,
      predictedAway: predictions.predictedAway,
      predictedResult: predictions.predictedResult,
      tendencyPoints: predictions.tendencyPoints,
      goalDiffBonus: predictions.goalDiffBonus,
      exactScoreBonus: predictions.exactScoreBonus,
      totalPoints: predictions.totalPoints,
      status: predictions.status,
      createdAt: predictions.createdAt,
      scoredAt: predictions.scoredAt,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(desc(predictions.totalPoints), models.displayName);
}

// Create a single prediction
export async function createPrediction(data: NewPrediction) {
  const db = getDb();
  return db.insert(predictions).values(data).returning();
}

// Create multiple predictions in a single query (batch insert)
export async function createPredictionsBatch(data: NewPrediction[]) {
  if (data.length === 0) return [];
  const db = getDb();
  return db.insert(predictions).values(data).returning();
}

// Get all predictions for a match
export async function getPredictionsForMatch(matchId: string): Promise<Prediction[]> {
  const db = getDb();
  return db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId))
    .orderBy(predictions.createdAt);
}

// Get predictions by model
export async function getModelPredictions(modelId: string, limit = 50) {
  const db = getDb();
  return db
    .select({
      prediction: predictions,
      match: matches,
      competition: competitions,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(predictions.modelId, modelId))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

// Update prediction scores after match finishes
export async function updatePredictionScores(
  predictionId: string,
  scores: {
    tendencyPoints: number;
    goalDiffBonus: number;
    exactScoreBonus: number;
    totalPoints: number;
  },
  tx?: any // Optional transaction context
) {
  const db = tx ?? getDb();
  try {
    return await db
      .update(predictions)
      .set({
        ...scores,
        status: 'scored',
        scoredAt: new Date(),
      })
      .where(eq(predictions.id, predictionId))
      .returning();
  } catch (error: any) {
    logQueryError('updatePredictionScores', error, { predictionId, scores });
    throw error;
  }
}

// Get all finished matches that have unscored predictions
export async function getMatchesNeedingRescore() {
  const db = getDb();
  
  // Find matches that are finished, have a score, and have at least one pending prediction
  const result = await db
    .select({
      id: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      kickoffTime: matches.kickoffTime,
    })
    .from(matches)
    .innerJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
        eq(predictions.status, 'pending')
      )
    )
    .groupBy(matches.id)
    .orderBy(desc(matches.kickoffTime));
    
  return result;
}

// Update match quotas after all predictions are in
export async function updateMatchQuotas(
  matchId: string,
  quotaHome: number,
  quotaDraw: number,
  quotaAway: number
) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      quotaHome,
      quotaDraw,
      quotaAway,
    })
    .where(eq(matches.id, matchId))
    .returning();
}

// Time range options for leaderboard filtering

// Get model stats for detail page
export async function getModelPredictionStats(modelId: string) {
  const db = getDb();
  
  const stats = await db
    .select({
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      scoredPredictions: sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END)`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`ROUND(AVG(${predictions.totalPoints})::numeric, 2)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)`,
      wrongTendencies: sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' AND ${predictions.tendencyPoints} IS NULL THEN 1 ELSE 0 END)`,
      maxPoints: sql<number>`MAX(${predictions.totalPoints})`,
      minPoints: sql<number>`MIN(${predictions.totalPoints})`,
    })
    .from(predictions)
    .where(eq(predictions.modelId, modelId))
    .groupBy();
  
  return stats[0] || null;
}

// Get model's rank among all models by average points
// Single database query: count how many models have better average points
// Performance: O(1) - database does the aggregation and counting in one pass
// Future optimization: Consider caching this for 5-10 minutes as rankings don't change frequently
export async function getModelRank(modelId: string) {
  const db = getDb();
  
  const rankResult = await db
    .select({
      rank: sql<number>`COALESCE(
        (SELECT COUNT(*) + 1 FROM (
          SELECT AVG(p.total_points) as avg_pts
          FROM predictions p
          INNER JOIN models m ON p.model_id = m.id
          WHERE m.active = true
          GROUP BY p.model_id
          HAVING AVG(p.total_points) > (
            SELECT AVG(p2.total_points)
            FROM predictions p2
            WHERE p2.model_id = ${modelId}
          )
        ) as better_models),
        1
      )`,
    })
    .from(predictions)
    .limit(1);
  
  return rankResult[0]?.rank ?? 1;
}

// Get model's rank for a specific competition by average points
export async function getModelRankByCompetition(modelId: string, competitionId: string) {
  const db = getDb();
  
  const rankResult = await db
    .select({
      rank: sql<number>`COALESCE(
        (SELECT COUNT(*) + 1 FROM (
          SELECT AVG(p.total_points) as avg_pts
          FROM predictions p
          INNER JOIN models m ON p.model_id = m.id
          INNER JOIN matches mt ON p.match_id = mt.id
          WHERE m.active = true 
            AND mt.competition_id = ${competitionId}
            AND p.status = 'scored'
          GROUP BY p.model_id
          HAVING AVG(p.total_points) > (
            SELECT AVG(p2.total_points)
            FROM predictions p2
            INNER JOIN matches mt2 ON p2.match_id = mt2.id
            WHERE p2.model_id = ${modelId}
              AND mt2.competition_id = ${competitionId}
              AND p2.status = 'scored'
          )
        ) as better_models),
        1
      )`,
    })
    .from(predictions)
    .limit(1);
  
  return rankResult[0]?.rank ?? null;
}

// Get model's stats by competition (for model profile page)
export async function getModelStatsByCompetitionWithRank(modelId: string) {
  const db = getDb();
  
  // Get stats grouped by competition
  const stats = await db
    .select({
      competitionId: matches.competitionId,
      competitionName: competitions.name,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(predictions.status, 'scored')
      )
    )
    .groupBy(matches.competitionId, competitions.name)
    .orderBy(desc(sql`COUNT(${predictions.id})`));
  
  // Get rank for each competition
  const statsWithRank = await Promise.all(
    stats.map(async (stat) => {
      const rank = await getModelRankByCompetition(modelId, stat.competitionId);
      return {
        ...stat,
        rank,
      };
    })
  );
  
  return statsWithRank;
}

// Get model's prediction breakdown by result type (Home Win, Draw, Away Win)
// Ensures all types (H, D, A) are returned, even if count is 0
export async function getModelResultTypeBreakdown(modelId: string) {
  const db = getDb();
  
  const breakdown = await db
    .select({
      resultType: predictions.predictedResult, // 'H', 'D', or 'A'
      count: sql<number>`COUNT(*)`,
      avgPoints: sql<number>`ROUND(AVG(${predictions.totalPoints})::numeric, 2)`,
      accuracy: sql<number>`ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / COUNT(*)::numeric, 1)`,
    })
    .from(predictions)
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(predictions.status, 'scored')
      )
    )
    .groupBy(predictions.predictedResult);
  
  // Ensure all result types are present (H, D, A)
  // Fill in missing types with zero values
  const resultTypeMap: Record<string, typeof breakdown[0]> = {};
  breakdown.forEach(b => {
    resultTypeMap[b.resultType || ''] = b;
  });
  
  const allTypes = ['H', 'D', 'A'];
  const completeBreakdown = allTypes.map(type => {
    if (resultTypeMap[type]) {
      return resultTypeMap[type];
    }
    // Return zero values for missing types
    return {
      resultType: type,
      count: 0,
      avgPoints: 0,
      accuracy: 0,
    };
  });
  
  return completeBreakdown;
}

// Get matches that need predictions (scheduled matches without predictions)
export async function getMatchesMissingPredictions(hoursAhead: number = 2): Promise<Match[]> {
  const db = getDb();
  
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  // Find matches with analysis and lineups but no predictions
  const results = await db
    .select({ match: matches })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, targetTime.toISOString()),
        eq(matchAnalysis.lineupsAvailable, true), // Has lineups
        isNull(predictions.id) // No predictions yet
      )
    )
    .groupBy(matches.id, matches.externalId, matches.competitionId, matches.homeTeam, 
             matches.awayTeam, matches.homeTeamLogo, matches.awayTeamLogo, matches.kickoffTime,
             matches.homeScore, matches.awayScore, matches.status, matches.matchMinute, 
             matches.round, matches.venue, matches.isUpset, matches.quotaHome, matches.quotaDraw,
             matches.quotaAway, matches.slug, matches.createdAt, matches.updatedAt)
    .orderBy(matches.kickoffTime);
  
  return results.map(r => r.match);
}

// Get finished matches with pending predictions (need scoring)
export async function getMatchesNeedingScoring(): Promise<Match[]> {
  const db = getDb();
  
  const results = await db
    .select({ match: matches })
    .from(matches)
    .innerJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        eq(matches.status, 'finished'),
        eq(predictions.status, 'pending') // Predictions not yet scored
      )
    )
    .groupBy(matches.id, matches.externalId, matches.competitionId, matches.homeTeam, 
             matches.awayTeam, matches.homeTeamLogo, matches.awayTeamLogo, matches.kickoffTime,
             matches.homeScore, matches.awayScore, matches.status, matches.matchMinute, 
             matches.round, matches.venue, matches.isUpset, matches.quotaHome, matches.quotaDraw,
             matches.quotaAway, matches.slug, matches.createdAt, matches.updatedAt)
    .orderBy(desc(matches.kickoffTime));
  
  return results.map(r => r.match);
}

/**
 * Get published blog posts (paginated)
 */
export async function getPublishedBlogPosts(limit: number = 20, offset: number = 0) {
  const db = getDb();
  
  const result = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, 'published'))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Get blog post by slug
 */
export async function getBlogPostBySlug(slug: string) {
  const db = getDb();
  
  const result = await db
    .select()
    .from(blogPosts)
    .where(and(
      eq(blogPosts.slug, slug),
      eq(blogPosts.status, 'published')
    ))
    .limit(1);

  return result[0] || null;
}

// Type for prediction with accuracy data
export interface PredictionWithAccuracy {
  modelName: string;
  predictedHome: number;
  predictedAway: number;
  predictedResult: 'H' | 'D' | 'A';
  actualHome: number;
  actualAway: number;
  actualResult: 'H' | 'D' | 'A';
  correctTendency: boolean;
  exactScore: boolean;
  totalPoints: number;
}

/**
 * Get predictions for a match with accuracy data
 * Used for post-match roundup generation
 */
export async function getMatchPredictionsWithAccuracy(matchId: string): Promise<PredictionWithAccuracy[]> {
  const db = getDb();
  
  // First get match data for actual results
  const matchResult = await db
    .select({
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchResult[0] || matchResult[0].homeScore === null || matchResult[0].awayScore === null) {
    // Match not finished yet - return empty
    return [];
  }

  const { homeScore, awayScore } = matchResult[0];
  
  // Determine actual result
  const actualResult: 'H' | 'D' | 'A' = 
    homeScore > awayScore ? 'H' : 
    homeScore < awayScore ? 'A' : 'D';

  // Get predictions with model details
  const predictionResults = await db
    .select({
      modelName: models.displayName,
      predictedHome: predictions.predictedHome,
      predictedAway: predictions.predictedAway,
      predictedResult: predictions.predictedResult,
      totalPoints: predictions.totalPoints,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(desc(predictions.totalPoints));

  // Calculate accuracy for each prediction
  return predictionResults.map((p) => {
    // Determine predicted result
    const predictedResult: 'H' | 'D' | 'A' = 
      p.predictedHome > p.predictedAway ? 'H' : 
      p.predictedHome < p.predictedAway ? 'A' : 'D';

    return {
      modelName: p.modelName,
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
      predictedResult,
      actualHome: homeScore,
      actualAway: awayScore,
      actualResult,
      correctTendency: p.predictedHome === homeScore && p.predictedAway === awayScore ? true : 
                       p.predictedHome !== p.predictedAway && homeScore !== awayScore ? 
                         p.predictedResult === actualResult : 
                         p.predictedResult === actualResult,
       exactScore: p.predictedHome === homeScore && p.predictedAway === awayScore,
       totalPoints: p.totalPoints || 0,
     };
   });
 }

// ============= MATCH ROUNDUPS =============

export interface MatchRoundupData {
  id: string;
  matchId: string;
  title: string;
  scoreboard: string;
  events: string | null;
  stats: string;
  modelPredictions: string;
  topPerformers: string;
  narrative: string;
  keywords: string | null;
  similarityHash: string | null;
  generationCost: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  generatedBy: string | null;
  status: string | null;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Get roundup for a match by match ID
 * Returns null if no roundup exists or table doesn't exist yet
 */
export async function getMatchRoundup(matchId: string): Promise<MatchRoundupData | null> {
  try {
    const db = getDb();

    const result = await db
      .select()
      .from(matchRoundups)
      .where(eq(matchRoundups.matchId, matchId))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error: any) {
    // Table doesn't exist yet (42P01 = undefined_table)
    if (error?.code === '42P01') {
      return null;
    }
    throw error;
  }
}

/**
 * Get roundup for a match by slug
 * Joins matches table to query by slug
 * Returns null if table doesn't exist yet
 */
export async function getMatchRoundupBySlug(competitionSlug: string, matchSlug: string): Promise<MatchRoundupData | null> {
  try {
    const db = getDb();

    const result = await db
      .select({
        roundup: matchRoundups,
      })
      .from(matchRoundups)
      .innerJoin(matches, eq(matchRoundups.matchId, matches.id))
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .where(
        and(
          eq(competitions.slug, competitionSlug),
          eq(matches.slug, matchSlug)
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0].roundup;
  } catch (error: any) {
    // Table doesn't exist yet (42P01 = undefined_table)
    if (error?.code === '42P01') {
      return null;
    }
    throw error;
  }
}
