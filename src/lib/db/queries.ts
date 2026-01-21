import { getDb, competitions, matches, models, predictions, matchAnalysis, predictionAttempts } from './index';
import { eq, and, or, gte, lte, desc, sql, isNotNull, isNull, notInArray, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { NewCompetition, NewMatch, NewModel, NewPrediction, Match, MatchAnalysis, NewMatchAnalysis, Model, Competition } from './schema';
import type { ScoringBreakdown, EnhancedLeaderboardEntry } from '@/types';
import { withCache, cacheKeys, CACHE_TTL, cacheDelete } from '@/lib/cache/redis';

// ============= COMPETITIONS =============

export async function upsertCompetition(data: NewCompetition) {
  const db = getDb();
  // Invalidate cache on upsert
  await cacheDelete(cacheKeys.activeCompetitions());
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

export async function upsertMatch(data: Omit<NewMatch, 'id'> & { id?: string }) {
  const db = getDb();
  const id = data.id || uuidv4();
  return db
    .insert(matches)
    .values({ ...data, id })
    .onConflictDoUpdate({
      target: matches.externalId,
      set: {
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        status: data.status,
        updatedAt: new Date().toISOString(),
      },
    });
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

export async function getMatchesWithoutPredictions(): Promise<{ match: Match; predictedModelIds: Set<string> }[]> {
  const db = getDb();
  // Get matches that are scheduled and within the prediction window (12h before kickoff)
  const now = new Date();
  const predictionWindow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  
  // Single query with LEFT JOIN to get matches and their predictions in one go
  const matchesWithPredictions = await db
    .select({
      match: matches,
      modelId: predictions.modelId,
    })
    .from(matches)
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        lte(matches.kickoffTime, predictionWindow.toISOString()),
        gte(matches.kickoffTime, now.toISOString())
      )
    );

  // Group predictions by match
  const matchMap = new Map<string, { match: Match; predictedModelIds: Set<string> }>();
  
  for (const row of matchesWithPredictions) {
    if (!matchMap.has(row.match.id)) {
      matchMap.set(row.match.id, {
        match: row.match,
        predictedModelIds: new Set(),
      });
    }
    
    if (row.modelId) {
      matchMap.get(row.match.id)!.predictedModelIds.add(row.modelId);
    }
  }
  
  return Array.from(matchMap.values());
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

export async function getFinishedMatchesWithUnscoredPredictions() {
  const db = getDb();
  
  // Find finished matches that have predictions with pointsTotal = 0
  // This catches matches where scoring was missed or failed
  const result = await db
    .selectDistinct({
      id: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      kickoffTime: matches.kickoffTime,
    })
    .from(matches)
    .innerJoin(predictions, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
        eq(predictions.pointsTotal, 0)
      )
    )
    .orderBy(desc(matches.kickoffTime));
  
  return result;
}

export async function getMatchById(id: string) {
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

// Optimized: Single query for match with predictions
export async function getMatchWithPredictions(matchId: string) {
  const db = getDb();
  
  // Get match and competition in one query
  const matchResult = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  
  if (!matchResult[0]) return null;

  // Get predictions (can run in parallel with match query if needed)
  const matchPredictions = await db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);

  return {
    match: matchResult[0].match,
    competition: matchResult[0].competition,
    predictions: matchPredictions,
  };
}

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
      updatedAt: new Date().toISOString(),
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
  // Invalidate cache on model changes
  await cacheDelete(cacheKeys.activeModels());
  return db
    .update(models)
    .set({ active: false })
    .where(notInArray(models.id, activeModelIds));
}

export async function getModelById(id: string) {
  const db = getDb();
  const result = await db.select().from(models).where(eq(models.id, id)).limit(1);
  return result[0];
}

// Update model streak after a prediction is scored
// resultType: 'exact' (exact score), 'tendency' (correct result), 'wrong' (wrong result)
// Uses a transaction to prevent race conditions when multiple predictions are scored concurrently
export async function updateModelStreak(
  modelId: string,
  resultType: 'exact' | 'tendency' | 'wrong'
) {
  const db = getDb();
  
  // Use transaction with serializable isolation to prevent race conditions
  await db.transaction(async (tx) => {
    // Read current model state within transaction
    const modelResult = await tx
      .select()
      .from(models)
      .where(eq(models.id, modelId))
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
export async function recordModelSuccess(modelId: string): Promise<void> {
  const db = getDb();
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
// Auto-disables after 3 consecutive failures
export async function recordModelFailure(
  modelId: string,
  reason: string
): Promise<{ autoDisabled: boolean }> {
  const db = getDb();
  
  // Get current failure count
  const model = await db
    .select({ consecutiveFailures: models.consecutiveFailures })
    .from(models)
    .where(eq(models.id, modelId))
    .limit(1);
  
  const currentFailures = model[0]?.consecutiveFailures || 0;
  const newFailures = currentFailures + 1;
  const shouldAutoDisable = newFailures >= 3;
  
  await db
    .update(models)
    .set({
      consecutiveFailures: newFailures,
      lastFailureAt: new Date().toISOString(),
      failureReason: reason.substring(0, 500), // Truncate long error messages
      autoDisabled: shouldAutoDisable,
    })
    .where(eq(models.id, modelId));
  
  return { autoDisabled: shouldAutoDisable };
}

// Re-enable a model that was auto-disabled
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

// Check if a model should be skipped due to health issues
export function shouldSkipModelDueToHealth(model: Model): boolean {
  return model.autoDisabled === true;
}

// ============= PREDICTION ATTEMPT TRACKING =============

// Get missing model/match pairs for prediction
// Returns which models still need to generate predictions for which matches
// Excludes: matches with existing predictions, pairs with 3+ attempts
export async function getMissingModelPredictions(matchIds: string[], activeModelIds: string[]) {
  if (matchIds.length === 0 || activeModelIds.length === 0) return [];
  
  const db = getDb();
  
  // Get all existing successful predictions
  const existingPreds = await db
    .select({
      matchId: predictions.matchId,
      modelId: predictions.modelId,
    })
    .from(predictions)
    .where(inArray(predictions.matchId, matchIds));
  
  // Get attempt records for these matches (with 3+ failures)
  const failedAttempts = await db
    .select({
      matchId: predictionAttempts.matchId,
      modelId: predictionAttempts.modelId,
    })
    .from(predictionAttempts)
    .where(
      and(
        inArray(predictionAttempts.matchId, matchIds),
        gte(predictionAttempts.attemptCount, 3)
      )
    );
  
  // Build set of existing (match, model) pairs
  const existing = new Set(existingPreds.map(p => `${p.matchId}|${p.modelId}`));
  const failed = new Set(failedAttempts.map(p => `${p.matchId}|${p.modelId}`));
  
  // Generate all (match, model) combinations and filter
  const missing: Array<{ matchId: string; modelId: string }> = [];
  for (const matchId of matchIds) {
    for (const modelId of activeModelIds) {
      const key = `${matchId}|${modelId}`;
      if (!existing.has(key) && !failed.has(key)) {
        missing.push({ matchId, modelId });
      }
    }
  }
  
  return missing;
}

// Record a failed prediction attempt for a match/model pair
// Increments attempt count, records error and timestamp
export async function recordPredictionAttemptFailure(
  matchId: string,
  modelId: string,
  error: string
): Promise<void> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db
    .insert(predictionAttempts)
    .values({
      id,
      matchId,
      modelId,
      attemptCount: 1,
      lastAttemptAt: now,
      lastError: error.substring(0, 500), // Truncate long errors
    })
    .onConflictDoUpdate({
      target: [predictionAttempts.matchId, predictionAttempts.modelId],
      set: {
        attemptCount: sql`COALESCE(${predictionAttempts.attemptCount}, 0) + 1`,
        lastAttemptAt: now,
        lastError: error.substring(0, 500),
      },
    });
}

// Clear prediction attempt record (called on successful prediction)
// Removes the record to keep tracking table clean
export async function clearPredictionAttempt(
  matchId: string,
  modelId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(predictionAttempts)
    .where(
      and(
        eq(predictionAttempts.matchId, matchId),
        eq(predictionAttempts.modelId, modelId)
      )
    );
}

// Batch clear prediction attempts (for parallel processing optimization)
export async function clearPredictionAttemptsBatch(
  pairs: Array<{ matchId: string; modelId: string }>
): Promise<void> {
  if (pairs.length === 0) return;
  
  const db = getDb();
  // Build OR conditions for batch delete
  await db
    .delete(predictionAttempts)
    .where(
      or(
        ...pairs.map(p => 
          and(
            eq(predictionAttempts.matchId, p.matchId),
            eq(predictionAttempts.modelId, p.modelId)
          )
        )
      )
    );
}

// Get current attempt count for a match/model pair
export async function getPredictionAttemptCount(
  matchId: string,
  modelId: string
): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: predictionAttempts.attemptCount })
    .from(predictionAttempts)
    .where(
      and(
        eq(predictionAttempts.matchId, matchId),
        eq(predictionAttempts.modelId, modelId)
      )
    )
    .limit(1);
  
  return result[0]?.count || 0;
}

// Clean up old prediction attempt records (older than N days)
// Called periodically to keep table size manageable
export async function cleanupOldPredictionAttempts(daysOld: number = 7): Promise<number> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await db
    .delete(predictionAttempts)
    .where(lte(predictionAttempts.createdAt, cutoffDate.toISOString()));
  
  return result.rowCount || 0;
}

// ============= PREDICTIONS =============

export async function createPrediction(data: Omit<NewPrediction, 'id'>) {
  const db = getDb();
  const id = uuidv4();
  // Use onConflictDoNothing to prevent duplicate predictions for same match+model
  // The unique index idx_predictions_match_model enforces this constraint
  return db
    .insert(predictions)
    .values({ ...data, id })
    .onConflictDoNothing();
}

// Batch insert predictions (for parallel processing optimization)
export async function createPredictionsBatch(data: Array<Omit<NewPrediction, 'id'>>) {
  if (data.length === 0) return;
  
  const db = getDb();
  const values = data.map(d => ({
    ...d,
    id: uuidv4(),
  }));
  
  // Use onConflictDoNothing to prevent duplicate predictions for same match+model
  return db
    .insert(predictions)
    .values(values)
    .onConflictDoNothing();
}

export async function getPredictionsForMatch(matchId: string) {
  const db = getDb();
  return db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);
}

// Batch fetch predictions for multiple matches - eliminates N+1 queries
export async function getPredictionsForMatches(matchIds: string[]) {
  if (matchIds.length === 0) return [];
  
  const db = getDb();
  return db
    .select({
      matchId: predictions.matchId,
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(inArray(predictions.matchId, matchIds))
    .orderBy(predictions.matchId, models.displayName);
}

export async function getPredictionsByModel(modelId: string, limit: number = 100) {
  const db = getDb();
  return db
    .select({
      prediction: predictions,
      match: matches,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(eq(predictions.modelId, modelId))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

// ============= LEADERBOARD =============

export async function getLeaderboard() {
  const db = getDb();
  // Get all predictions for finished matches
  const finishedPredictions = await db
    .select({
      modelId: predictions.modelId,
      displayName: models.displayName,
      provider: models.provider,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      actualHomeScore: matches.homeScore,
      actualAwayScore: matches.awayScore,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  // Calculate stats per model
  const modelStats = new Map<string, {
    modelId: string;
    displayName: string;
    provider: string;
    totalPredictions: number;
    exactScores: number;
    correctResults: number;
    totalPoints: number;
  }>();

  for (const pred of finishedPredictions) {
    if (pred.actualHomeScore === null || pred.actualAwayScore === null) continue;

    const stats = modelStats.get(pred.modelId) || {
      modelId: pred.modelId,
      displayName: pred.displayName,
      provider: pred.provider,
      totalPredictions: 0,
      exactScores: 0,
      correctResults: 0,
      totalPoints: 0,
    };

    stats.totalPredictions++;

    const isExact = 
      pred.predictedHomeScore === pred.actualHomeScore && 
      pred.predictedAwayScore === pred.actualAwayScore;
    
    const predictedResult = pred.predictedHomeScore > pred.predictedAwayScore ? 'H' : 
                           pred.predictedHomeScore < pred.predictedAwayScore ? 'A' : 'D';
    const actualResult = pred.actualHomeScore > pred.actualAwayScore ? 'H' :
                        pred.actualHomeScore < pred.actualAwayScore ? 'A' : 'D';
    
    const isCorrectResult = predictedResult === actualResult;

    if (isExact) {
      stats.exactScores++;
      stats.totalPoints += 3;
    } else if (isCorrectResult) {
      stats.correctResults++;
      stats.totalPoints += 1;
    }

    modelStats.set(pred.modelId, stats);
  }

  // Convert to array and calculate percentages
  const leaderboard = Array.from(modelStats.values())
    .map(stats => ({
      ...stats,
      exactScorePercent: stats.totalPredictions > 0 
        ? Math.round((stats.exactScores / stats.totalPredictions) * 1000) / 10 
        : 0,
      correctResultPercent: stats.totalPredictions > 0 
        ? Math.round(((stats.exactScores + stats.correctResults) / stats.totalPredictions) * 1000) / 10 
        : 0,
      averagePoints: stats.totalPredictions > 0 
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100 
        : 0,
    }))
    .sort((a, b) => {
      // Sort by average points, then by total points, then by total predictions
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalPredictions - a.totalPredictions;
    });

  return leaderboard;
}

// Leaderboard with filters (date range, minimum predictions, active models only, competition)
export interface LeaderboardFilters {
  days?: number;           // 7, 30, or undefined (all time)
  minPredictions?: number; // Minimum predictions to appear (default 5)
  activeOnly?: boolean;    // Only show currently active models (default true)
  competitionId?: string;  // Filter by specific competition (e.g., "ucl", "epl")
}

export async function getLeaderboardFiltered(filters: LeaderboardFilters = {}) {
  const { days, minPredictions = 5, activeOnly = true, competitionId } = filters;
  const db = getDb();
  
  // Calculate date cutoff if days filter is set
  let dateCutoff: string | null = null;
  if (days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    dateCutoff = cutoffDate.toISOString();
  }

  // Build where conditions
  const conditions = [
    eq(matches.status, 'finished'),
    isNotNull(matches.homeScore),
    isNotNull(matches.awayScore),
  ];
  
  // Add date filter if specified
  if (dateCutoff) {
    conditions.push(sql`${matches.kickoffTime} >= ${dateCutoff}`);
  }
  
  // Add active models filter
  if (activeOnly) {
    conditions.push(eq(models.active, true));
  }
  
  // Add competition filter if specified
  if (competitionId) {
    conditions.push(eq(matches.competitionId, competitionId));
  }

  // Get all predictions for finished matches with filters
  const finishedPredictions = await db
    .select({
      modelId: predictions.modelId,
      displayName: models.displayName,
      provider: models.provider,
      modelActive: models.active,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      actualHomeScore: matches.homeScore,
      actualAwayScore: matches.awayScore,
      kickoffTime: matches.kickoffTime,
      // Streak data
      currentStreak: models.currentStreak,
      currentStreakType: models.currentStreakType,
      bestStreak: models.bestStreak,
      worstStreak: models.worstStreak,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(and(...conditions));

  // Calculate stats per model
  const modelStats = new Map<string, {
    modelId: string;
    displayName: string;
    provider: string;
    totalPredictions: number;
    exactScores: number;
    correctResults: number;
    totalPoints: number;
    currentStreak: number;
    currentStreakType: string;
    bestStreak: number;
    worstStreak: number;
  }>();

  for (const pred of finishedPredictions) {
    if (pred.actualHomeScore === null || pred.actualAwayScore === null) continue;

    const stats = modelStats.get(pred.modelId) || {
      modelId: pred.modelId,
      displayName: pred.displayName,
      provider: pred.provider,
      totalPredictions: 0,
      exactScores: 0,
      correctResults: 0,
      totalPoints: 0,
      currentStreak: pred.currentStreak || 0,
      currentStreakType: pred.currentStreakType || 'none',
      bestStreak: pred.bestStreak || 0,
      worstStreak: pred.worstStreak || 0,
    };

    stats.totalPredictions++;

    const isExact = 
      pred.predictedHomeScore === pred.actualHomeScore && 
      pred.predictedAwayScore === pred.actualAwayScore;
    
    const predictedResult = pred.predictedHomeScore > pred.predictedAwayScore ? 'H' : 
                           pred.predictedHomeScore < pred.predictedAwayScore ? 'A' : 'D';
    const actualResult = pred.actualHomeScore > pred.actualAwayScore ? 'H' :
                        pred.actualHomeScore < pred.actualAwayScore ? 'A' : 'D';
    
    const isCorrectResult = predictedResult === actualResult;

    if (isExact) {
      stats.exactScores++;
      stats.totalPoints += 3;
    } else if (isCorrectResult) {
      stats.correctResults++;
      stats.totalPoints += 1;
    }

    modelStats.set(pred.modelId, stats);
  }

  // If minPredictions is 0, include all active models (even those with no predictions)
  if (minPredictions === 0 && activeOnly) {
    const allActiveModels = await db
      .select({ 
        id: models.id, 
        displayName: models.displayName, 
        provider: models.provider,
        currentStreak: models.currentStreak,
        currentStreakType: models.currentStreakType,
        bestStreak: models.bestStreak,
        worstStreak: models.worstStreak,
      })
      .from(models)
      .where(eq(models.active, true));
    
    for (const model of allActiveModels) {
      if (!modelStats.has(model.id)) {
        modelStats.set(model.id, {
          modelId: model.id,
          displayName: model.displayName,
          provider: model.provider,
          totalPredictions: 0,
          exactScores: 0,
          correctResults: 0,
          totalPoints: 0,
          currentStreak: model.currentStreak || 0,
          currentStreakType: model.currentStreakType || 'none',
          bestStreak: model.bestStreak || 0,
          worstStreak: model.worstStreak || 0,
        });
      }
    }
  }

  // Convert to array, filter by min predictions, and calculate percentages
  const leaderboard = Array.from(modelStats.values())
    .filter(stats => stats.totalPredictions >= minPredictions)
    .map(stats => ({
      ...stats,
      // For backward compatibility, map correctResults to correctTendencies
      correctTendencies: stats.exactScores + stats.correctResults,
      exactScorePercent: stats.totalPredictions > 0 
        ? Math.round((stats.exactScores / stats.totalPredictions) * 1000) / 10 
        : 0,
      correctResultPercent: stats.totalPredictions > 0 
        ? Math.round(((stats.exactScores + stats.correctResults) / stats.totalPredictions) * 1000) / 10 
        : 0,
      averagePoints: stats.totalPredictions > 0 
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100 
        : 0,
    }))
    .sort((a, b) => {
      // Sort by average points, then by total points, then by total predictions
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalPredictions - a.totalPredictions;
    });

  return leaderboard;
}

// ============= STATS =============

// Optimized: Single query instead of 4 separate queries, with caching
export async function getOverallStats() {
  return withCache(
    cacheKeys.overallStats(),
    CACHE_TTL.STATS,
    async () => {
      const db = getDb();
      // Single query with subqueries instead of 4 separate queries
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

// ============= MATCH ANALYSIS =============

export async function upsertMatchAnalysis(data: NewMatchAnalysis) {
  const db = getDb();
  return db
    .insert(matchAnalysis)
    .values(data)
    .onConflictDoUpdate({
      target: matchAnalysis.matchId, // Fixed: was matchAnalysis.id
      set: {
        favoriteTeamId: data.favoriteTeamId,
        favoriteTeamName: data.favoriteTeamName,
        homeWinPct: data.homeWinPct,
        drawPct: data.drawPct,
        awayWinPct: data.awayWinPct,
        advice: data.advice,
        formHomePct: data.formHomePct,
        formAwayPct: data.formAwayPct,
        attackHomePct: data.attackHomePct,
        attackAwayPct: data.attackAwayPct,
        defenseHomePct: data.defenseHomePct,
        defenseAwayPct: data.defenseAwayPct,
        homeTeamForm: data.homeTeamForm,
        awayTeamForm: data.awayTeamForm,
        homeGoalsScored: data.homeGoalsScored,
        homeGoalsConceded: data.homeGoalsConceded,
        awayGoalsScored: data.awayGoalsScored,
        awayGoalsConceded: data.awayGoalsConceded,
        oddsHome: data.oddsHome,
        oddsDraw: data.oddsDraw,
        oddsAway: data.oddsAway,
        likelyScores: data.likelyScores,
        homeInjuriesCount: data.homeInjuriesCount,
        awayInjuriesCount: data.awayInjuriesCount,
        keyInjuries: data.keyInjuries,
        homeFormation: data.homeFormation,
        awayFormation: data.awayFormation,
        homeStartingXI: data.homeStartingXI,
        awayStartingXI: data.awayStartingXI,
        homeCoach: data.homeCoach,
        awayCoach: data.awayCoach,
        lineupsAvailable: data.lineupsAvailable,
        lineupsUpdatedAt: data.lineupsUpdatedAt,
        rawPredictionsData: data.rawPredictionsData,
        rawInjuriesData: data.rawInjuriesData,
        rawOddsData: data.rawOddsData,
        rawLineupsData: data.rawLineupsData,
        analysisUpdatedAt: data.analysisUpdatedAt,
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
  lineups: {
    homeFormation: string | null;
    awayFormation: string | null;
    homeStartingXI: string | null;
    awayStartingXI: string | null;
    homeCoach: string | null;
    awayCoach: string | null;
    lineupsAvailable: boolean;
    lineupsUpdatedAt: string;
    rawLineupsData: string | null;
  }
) {
  const db = getDb();
  return db
    .update(matchAnalysis)
    .set(lineups)
    .where(eq(matchAnalysis.matchId, matchId));
}

// Get matches that need analysis fetched (kickoff within 6 hours, no analysis yet)
export async function getMatchesNeedingAnalysis(): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  
  // Get matches with analysis status
  const matchesWithAnalysis = await db
    .select({
      match: matches,
      hasAnalysis: sql<boolean>`CASE WHEN ${matchAnalysis.id} IS NOT NULL THEN 1 ELSE 0 END`,
    })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, sixHoursFromNow.toISOString())
      )
    );

  // Filter to only matches without analysis
  return matchesWithAnalysis
    .filter(m => !m.hasAnalysis)
    .map(m => m.match);
}

// Get matches that need lineups fetched (kickoff within 1 hour, lineups not available)
export async function getMatchesNeedingLineups(): Promise<Array<Match & { analysisId: string }>> {
  const db = getDb();
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  
  const result = await db
    .select({
      match: matches,
      analysisId: matchAnalysis.id,
      lineupsAvailable: matchAnalysis.lineupsAvailable,
    })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, oneHourFromNow.toISOString()),
        eq(matchAnalysis.lineupsAvailable, false)
      )
    );

  return result.map(r => ({ ...r.match, analysisId: r.analysisId }));
}

// Get matches that need analysis refresh (within 2h of kickoff, analysis > 4h old)
// This ensures we have fresh odds/injuries data before generating predictions
export async function getMatchesNeedingAnalysisRefresh(): Promise<Array<Match & { analysisId: string }>> {
  const db = getDb();
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  
  const result = await db
    .select({
      match: matches,
      analysisId: matchAnalysis.id,
      analysisUpdatedAt: matchAnalysis.analysisUpdatedAt,
    })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, twoHoursFromNow.toISOString()),
        // Analysis is older than 4 hours (or never updated)
        or(
          isNull(matchAnalysis.analysisUpdatedAt),
          lte(matchAnalysis.analysisUpdatedAt, fourHoursAgo.toISOString())
        )
      )
    );

  return result.map(r => ({ ...r.match, analysisId: r.analysisId }));
}

// Get matches ready for prediction (kickoff within 90 min OR within 5 min if no predictions yet)
// 90 min window allows predictions when lineups are confirmed (~1 hour before kickoff)
// Optimized: Uses LEFT JOIN instead of correlated subquery for prediction count
export async function getMatchesReadyForPrediction(): Promise<Array<{
  match: Match;
  competition: { id: string; name: string };
  analysis: MatchAnalysis | null;
  hasPredictions: boolean;
}>> {
  const db = getDb();
  const now = new Date();
  const ninetyMinsFromNow = new Date(now.getTime() + 90 * 60 * 1000);
  const fiveMinsFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  // Optimized query: Use LEFT JOIN with predictions and filter using NOT EXISTS pattern
  // This avoids the correlated subquery which runs once per row
  const matchesInWindow = await db
    .select({
      match: matches,
      competition: competitions,
      analysis: matchAnalysis,
      // Use COALESCE with LEFT JOIN count - more efficient than correlated subquery
      predictionCount: sql<number>`COALESCE((
        SELECT COUNT(*) FROM predictions p WHERE p.match_id = ${matches.id}
      ), 0)::int`,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, ninetyMinsFromNow.toISOString())
      )
    );

  const result: Array<{
    match: Match;
    competition: { id: string; name: string };
    analysis: MatchAnalysis | null;
    hasPredictions: boolean;
  }> = [];

  for (const row of matchesInWindow) {
    // Check if we should generate predictions now
    const kickoff = new Date(row.match.kickoffTime);
    const isWithin5Mins = kickoff <= fiveMinsFromNow;
    const hasLineups = row.analysis?.lineupsAvailable === true;
    
    // Generate if:
    // 1. We have lineups (preferred), OR
    // 2. We're within 5 mins of kickoff (fallback)
    if (hasLineups || isWithin5Mins) {
      result.push({
        match: row.match,
        competition: { id: row.competition.id, name: row.competition.name },
        analysis: row.analysis,
        hasPredictions: (row.predictionCount || 0) > 0,
      });
    }
  }

  return result;
}

// ============= PREDICTION SCORING (QUOTA SYSTEM) =============

export async function updatePredictionScores(
  predictionId: string,
  scores: ScoringBreakdown
) {
  const db = getDb();
  // Map new quota-based scoring to existing columns:
  // - pointsResult: now stores tendencyPoints (2-6)
  // - pointsGoalDiff: stores goal diff bonus (0-1)
  // - pointsExactScore: stores exact score bonus (0-3)
  // - Unused columns (pointsOverUnder, pointsBtts, pointsUpsetBonus): set to 0
  return db
    .update(predictions)
    .set({
      pointsResult: scores.tendencyPoints,
      pointsGoalDiff: scores.goalDiffBonus,
      pointsExactScore: scores.exactScoreBonus,
      pointsOverUnder: 0, // No longer used
      pointsBtts: 0,      // No longer used
      pointsUpsetBonus: 0, // No longer used (replaced by quota system)
      pointsTotal: scores.total,
    })
    .where(eq(predictions.id, predictionId));
}

// Save calculated quotas to a match
export async function saveMatchQuotas(
  matchId: string,
  quotas: { home: number; draw: number; away: number }
) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      quotaHome: quotas.home,
      quotaDraw: quotas.draw,
      quotaAway: quotas.away,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(matches.id, matchId));
}

export async function setMatchUpset(matchId: string, isUpset: boolean) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      isUpset,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(matches.id, matchId));
}

// ============= ENHANCED LEADERBOARD (QUOTA SYSTEM) =============

export async function getEnhancedLeaderboard(): Promise<EnhancedLeaderboardEntry[]> {
  const db = getDb();
  
  // Get all predictions for finished matches with their scores
  // Note: pointsResult now stores tendencyPoints, pointsExactScore stores exact bonus
  const finishedPredictions = await db
    .select({
      modelId: predictions.modelId,
      displayName: models.displayName,
      provider: models.provider,
      pointsExactScore: predictions.pointsExactScore, // Now: exact score bonus (0 or 3)
      pointsResult: predictions.pointsResult,         // Now: tendency quota points (0 or 2-6)
      pointsGoalDiff: predictions.pointsGoalDiff,     // Goal diff bonus (0 or 1)
      pointsTotal: predictions.pointsTotal,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  // Aggregate stats per model
  const modelStats = new Map<string, EnhancedLeaderboardEntry>();

  for (const pred of finishedPredictions) {
    const stats = modelStats.get(pred.modelId) || {
      modelId: pred.modelId,
      displayName: pred.displayName,
      provider: pred.provider,
      totalPredictions: 0,
      totalPoints: 0,
      averagePoints: 0,
      // Quota system breakdown
      pointsTendency: 0,
      pointsGoalDiff: 0,
      pointsExactScore: 0,
      // Counts
      correctTendencies: 0,
      correctGoalDiffs: 0,
      exactScores: 0,
    };

    stats.totalPredictions++;
    stats.totalPoints += pred.pointsTotal || 0;
    
    // Quota system aggregation
    const tendencyPts = pred.pointsResult || 0; // tendencyPoints stored in pointsResult
    const goalDiffPts = pred.pointsGoalDiff || 0;
    const exactPts = pred.pointsExactScore || 0;
    
    stats.pointsTendency += tendencyPts;
    stats.pointsGoalDiff += goalDiffPts;
    stats.pointsExactScore += exactPts;

    // Count categories achieved
    if (tendencyPts > 0) stats.correctTendencies++;
    if (goalDiffPts > 0) stats.correctGoalDiffs++;
    if (exactPts > 0) stats.exactScores++;

    modelStats.set(pred.modelId, stats);
  }

  // Calculate averages and sort
  const leaderboard = Array.from(modelStats.values())
    .map(stats => ({
      ...stats,
      averagePoints: stats.totalPredictions > 0
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100
        : 0,
    }))
    .sort((a, b) => {
      // Sort by average points, then total points, then total predictions
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalPredictions - a.totalPredictions;
    });

  return leaderboard;
}

// Get match with analysis data - optimized to use fewer queries
export async function getMatchWithAnalysis(matchId: string) {
  const db = getDb();
  
  // Single query to get match, competition, and analysis using LEFT JOIN
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

  // Second query for predictions with models (can't easily combine with above due to 1:many)
  const matchPredictions = await db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);

  return {
    match: matchWithAnalysis[0].match,
    competition: matchWithAnalysis[0].competition,
    analysis: matchWithAnalysis[0].analysis,
    predictions: matchPredictions,
  };
}

// ============= MODEL DETAIL PAGE QUERIES =============

// Get model prediction history with match and competition details
export async function getModelPredictionHistory(
  modelId: string,
  options: { limit?: number; offset?: number; competitionId?: string } = {}
) {
  const { limit = 20, offset = 0, competitionId } = options;
  const db = getDb();
  
  const conditions = [
    eq(predictions.modelId, modelId),
    eq(matches.status, 'finished'),
  ];
  
  if (competitionId) {
    conditions.push(eq(matches.competitionId, competitionId));
  }
  
  return db
    .select({
      prediction: predictions,
      match: matches,
      competition: competitions,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(and(...conditions))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit)
    .offset(offset);
}

// Get model stats broken down by competition
export async function getModelStatsByCompetition(modelId: string) {
  const db = getDb();
  
  const results = await db
    .select({
      competitionId: competitions.id,
      competitionName: competitions.name,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      actualHomeScore: matches.homeScore,
      actualAwayScore: matches.awayScore,
      pointsTotal: predictions.pointsTotal,
      pointsExactScore: predictions.pointsExactScore,
      pointsResult: predictions.pointsResult,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  // Aggregate by competition
  const competitionStats = new Map<string, {
    competitionId: string;
    competitionName: string;
    totalPredictions: number;
    correctTendencies: number;
    exactScores: number;
    totalPoints: number;
  }>();

  for (const row of results) {
    const stats = competitionStats.get(row.competitionId) || {
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      totalPredictions: 0,
      correctTendencies: 0,
      exactScores: 0,
      totalPoints: 0,
    };

    stats.totalPredictions++;
    stats.totalPoints += row.pointsTotal || 0;
    
    // Count exact scores and correct tendencies
    if ((row.pointsExactScore || 0) > 0) {
      stats.exactScores++;
      stats.correctTendencies++; // Exact score includes correct tendency
    } else if ((row.pointsResult || 0) > 0) {
      stats.correctTendencies++;
    }

    competitionStats.set(row.competitionId, stats);
  }

  // Convert to array with calculated averages
  return Array.from(competitionStats.values())
    .map(stats => ({
      ...stats,
      averagePoints: stats.totalPredictions > 0
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100
        : 0,
      accuracy: stats.totalPredictions > 0
        ? Math.round((stats.correctTendencies / stats.totalPredictions) * 100)
        : 0,
    }))
    .sort((a, b) => b.totalPredictions - a.totalPredictions);
}

// Get model weekly performance for chart (max 90 days, weekly aggregates)
export async function getModelWeeklyPerformance(modelId: string, maxDays: number = 90) {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);
  
  const results = await db
    .select({
      kickoffTime: matches.kickoffTime,
      pointsTotal: predictions.pointsTotal,
      pointsResult: predictions.pointsResult,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(matches.status, 'finished'),
        gte(matches.kickoffTime, cutoffDate.toISOString())
      )
    )
    .orderBy(matches.kickoffTime);

  // Aggregate by week (Monday start)
  const weeklyStats = new Map<string, {
    weekStart: string;
    matchCount: number;
    totalPoints: number;
    correctTendencies: number;
  }>();

  for (const row of results) {
    const date = new Date(row.kickoffTime);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];

    const stats = weeklyStats.get(weekKey) || {
      weekStart: weekKey,
      matchCount: 0,
      totalPoints: 0,
      correctTendencies: 0,
    };

    stats.matchCount++;
    stats.totalPoints += row.pointsTotal || 0;
    if ((row.pointsResult || 0) > 0) {
      stats.correctTendencies++;
    }

    weeklyStats.set(weekKey, stats);
  }

  // Convert to array with calculated averages
  return Array.from(weeklyStats.values())
    .map(stats => ({
      ...stats,
      avgPoints: stats.matchCount > 0
        ? Math.round((stats.totalPoints / stats.matchCount) * 100) / 100
        : 0,
      accuracy: stats.matchCount > 0
        ? Math.round((stats.correctTendencies / stats.matchCount) * 100)
        : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// Get fun stats for model (most predicted score, best exact score hit)
export async function getModelFunStats(modelId: string) {
  const db = getDb();
  
  // Get all predictions for this model
  const allPredictions = await db
    .select({
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      actualHomeScore: matches.homeScore,
      actualAwayScore: matches.awayScore,
      pointsExactScore: predictions.pointsExactScore,
      processingTimeMs: predictions.processingTimeMs,
      status: matches.status,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(eq(predictions.modelId, modelId));

  // Count predicted scores
  const predictedScoreCounts = new Map<string, number>();
  // Count exact score hits
  const exactScoreHits = new Map<string, number>();
  let totalProcessingTime = 0;
  let processingTimeCount = 0;
  let totalExactScores = 0;

  for (const pred of allPredictions) {
    const predictedScore = `${pred.predictedHomeScore}-${pred.predictedAwayScore}`;
    predictedScoreCounts.set(predictedScore, (predictedScoreCounts.get(predictedScore) || 0) + 1);
    
    if (pred.processingTimeMs) {
      totalProcessingTime += pred.processingTimeMs;
      processingTimeCount++;
    }

    // Only count finished matches for exact scores
    if (pred.status === 'finished' && (pred.pointsExactScore || 0) > 0) {
      totalExactScores++;
      const actualScore = `${pred.actualHomeScore}-${pred.actualAwayScore}`;
      exactScoreHits.set(actualScore, (exactScoreHits.get(actualScore) || 0) + 1);
    }
  }

  // Find most predicted score
  let mostPredictedScore: { score: string; count: number } | null = null;
  for (const [score, count] of predictedScoreCounts) {
    if (!mostPredictedScore || count > mostPredictedScore.count) {
      mostPredictedScore = { score, count };
    }
  }

  // Find best exact score hit (most times hit)
  let bestExactScore: { score: string; count: number } | null = null;
  for (const [score, count] of exactScoreHits) {
    if (!bestExactScore || count > bestExactScore.count) {
      bestExactScore = { score, count };
    }
  }

  return {
    mostPredictedScore,
    bestExactScore,
    totalExactScores,
    avgProcessingTimeMs: processingTimeCount > 0
      ? Math.round(totalProcessingTime / processingTimeCount)
      : null,
  };
}

// Get overall model stats (for header display)
export async function getModelOverallStats(modelId: string) {
  const db = getDb();
  
  const results = await db
    .select({
      pointsTotal: predictions.pointsTotal,
      pointsResult: predictions.pointsResult,
      pointsExactScore: predictions.pointsExactScore,
      pointsGoalDiff: predictions.pointsGoalDiff,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  let totalPredictions = 0;
  let totalPoints = 0;
  let correctTendencies = 0;
  let exactScores = 0;
  let correctGoalDiffs = 0;

  for (const row of results) {
    totalPredictions++;
    totalPoints += row.pointsTotal || 0;
    
    if ((row.pointsExactScore || 0) > 0) {
      exactScores++;
      correctTendencies++;
      correctGoalDiffs++;
    } else {
      if ((row.pointsResult || 0) > 0) correctTendencies++;
      if ((row.pointsGoalDiff || 0) > 0) correctGoalDiffs++;
    }
  }

  return {
    totalPredictions,
    totalPoints,
    averagePoints: totalPredictions > 0
      ? Math.round((totalPoints / totalPredictions) * 100) / 100
      : 0,
    accuracy: totalPredictions > 0
      ? Math.round((correctTendencies / totalPredictions) * 100)
      : 0,
    exactScores,
    correctTendencies,
    correctGoalDiffs,
  };
}
