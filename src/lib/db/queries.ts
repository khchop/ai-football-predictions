import { getDb, competitions, matches, models, matchAnalysis, bets, modelBalances, seasons, predictions } from './index';
import { eq, and, desc, gte, lte, sql, inArray, ne, or, lt, not, isNull, isNotNull } from 'drizzle-orm';
import type { NewMatch, NewMatchAnalysis, NewBet, NewModelBalance, NewPrediction } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from '@/lib/logger/modules';

import type { NewCompetition, NewModel, Match, MatchAnalysis, Model, Competition, Bet, ModelBalance, Prediction } from './schema';
import type { ScoringBreakdown, EnhancedLeaderboardEntry } from '@/types';
import { withCache, cacheKeys, CACHE_TTL, cacheDelete } from '@/lib/cache/redis';
import { BETTING_CONSTANTS } from '@/lib/betting/constants';

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

export async function upsertMatch(data: Omit<NewMatch, 'id'> & { id?: string }) {
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
 * Used for SEO-friendly URLs: /predictions/{league-slug}/{match-slug}
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
  
  // Use atomic SQL to avoid race condition
  const result = await db
    .update(models)
    .set({
      consecutiveFailures: sql`COALESCE(${models.consecutiveFailures}, 0) + 1`,
      lastFailureAt: new Date().toISOString(),
      failureReason: reason.substring(0, 500), // Truncate long error messages
      // Auto-disable if failures >= 3 (evaluated atomically)
      autoDisabled: sql`CASE WHEN COALESCE(${models.consecutiveFailures}, 0) + 1 >= 3 THEN TRUE ELSE ${models.autoDisabled} END`,
    })
    .where(eq(models.id, modelId))
    .returning({ 
      newFailures: models.consecutiveFailures,
      autoDisabled: models.autoDisabled,
    });
  
  return { 
    autoDisabled: result[0]?.autoDisabled || false,
  };
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
      startingBalance: BETTING_CONSTANTS.STARTING_BALANCE,
      currentBalance: BETTING_CONSTANTS.STARTING_BALANCE,
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

// Create bets and update balance atomically (transaction)
export async function createBetsWithBalanceUpdate(
  betsData: NewBet[],
  modelId: string,
  season: string,
  totalStake: number
) {
  const db = getDb();
  
  return db.transaction(async (tx) => {
    // Verify balance exists
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
    
    // Insert all bets
    await tx.insert(bets).values(betsData);
    
    // Update balance with atomic SQL operations
    await tx
      .update(modelBalances)
      .set({
        currentBalance: sql`${modelBalances.currentBalance} - ${totalStake}`,
        totalWagered: sql`${modelBalances.totalWagered} + ${totalStake}`,
        totalBets: sql`${modelBalances.totalBets} + ${betsData.length}`,
        updatedAt: new Date().toISOString(),
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
      settledAt: new Date().toISOString(),
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
    const settledAt = new Date().toISOString();
    
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
          settled_at = ${settledAt}
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
          updatedAt: settledAt,
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
      updatedAt: new Date().toISOString(),
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

  const profit = (balance.currentBalance || 0) - (balance.startingBalance || BETTING_CONSTANTS.STARTING_BALANCE);
  const roi = balance.startingBalance ? (profit / balance.startingBalance) * 100 : 0;
  const winRate = balance.totalBets ? ((balance.winningBets || 0) / balance.totalBets) * 100 : 0;

  return {
    balance: balance.currentBalance || 0,
    startingBalance: balance.startingBalance || BETTING_CONSTANTS.STARTING_BALANCE,
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

// Get bets for a match with model details
export async function getBetsForMatchWithDetails(matchId: string) {
  const db = getDb();
  
  return db
    .select({
      betId: bets.id,
      modelId: bets.modelId,
      modelDisplayName: models.displayName,
      provider: models.provider,
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
    .innerJoin(models, eq(bets.modelId, models.id))
    .where(eq(bets.matchId, matchId))
    .orderBy(models.displayName, bets.betType);
}

// Get betting leaderboard for current season
export async function getBettingLeaderboard() {
  const db = getDb();
  const currentSeason = await getCurrentSeason();

  // Get all model balances with model details
  const leaderboardData = await db
    .select({
      modelId: modelBalances.modelId,
      displayName: models.displayName,
      provider: models.provider,
      active: models.active,
      currentBalance: modelBalances.currentBalance,
      startingBalance: modelBalances.startingBalance,
      totalWagered: modelBalances.totalWagered,
      totalWon: modelBalances.totalWon,
      totalBets: modelBalances.totalBets,
      winningBets: modelBalances.winningBets,
    })
    .from(modelBalances)
    .innerJoin(models, eq(modelBalances.modelId, models.id))
    .where(eq(modelBalances.season, currentSeason))
    .orderBy(desc(modelBalances.currentBalance));

  // Calculate derived stats
  return leaderboardData.map(row => {
    const profit = (row.currentBalance || 0) - (row.startingBalance || BETTING_CONSTANTS.STARTING_BALANCE);
    const roi = row.startingBalance ? (profit / row.startingBalance) * 100 : 0;
    const winRate = row.totalBets ? ((row.winningBets || 0) / row.totalBets) * 100 : 0;
    const averageOdds = row.winningBets && row.totalWon && row.winningBets > 0
      ? row.totalWon / row.winningBets
      : 0;

    return {
      modelId: row.modelId,
      displayName: row.displayName,
      provider: row.provider,
      active: row.active,
      balance: row.currentBalance || 0,
      profit: profit,
      roi: roi,
      totalBets: row.totalBets || 0,
      winningBets: row.winningBets || 0,
      losingBets: (row.totalBets || 0) - (row.winningBets || 0),
      winRate: winRate,
      totalWagered: row.totalWagered || 0,
      totalWon: row.totalWon || 0,
      averageOdds: averageOdds,
    };
  });
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
  // Return empty array - should use betting history instead
  return [];
}

export async function getModelStatsByCompetition(modelId: string) {
  // Return empty array - should use betting stats by competition instead
  return [];
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

// Get all bets for a match (simple, no joins)
export async function getBetsForMatch(matchId: string) {
  const db = getDb();
  
  return db
    .select()
    .from(bets)
    .where(eq(bets.matchId, matchId));
}

// ============= PREDICTIONS SYSTEM (Kicktipp Quota Scoring) =============

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
  }
) {
  const db = getDb();
  try {
    return await db
      .update(predictions)
      .set({
        ...scores,
        status: 'scored',
        scoredAt: new Date().toISOString(),
      })
      .where(eq(predictions.id, predictionId))
      .returning();
  } catch (error: any) {
    logQueryError('updatePredictionScores', error, { predictionId, scores });
    throw error;
  }
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

// Get leaderboard (by total points)
export async function getLeaderboard(limit = 30) {
  const db = getDb();
  return db
    .select({
      model: models,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)`,
      avgPoints: sql<number>`ROUND(AVG(${predictions.totalPoints})::numeric, 2)`,
    })
    .from(models)
    .leftJoin(predictions, and(
      eq(predictions.modelId, models.id),
      eq(predictions.status, 'scored')
    ))
    .where(eq(models.active, true))
    .groupBy(models.id)
    .orderBy(desc(sql`COALESCE(SUM(${predictions.totalPoints}), 0)`))
    .limit(limit);
}

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
