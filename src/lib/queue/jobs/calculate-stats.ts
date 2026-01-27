/**
 * Stats Calculation Jobs
 * 
 * Defines job types and enqueue functions for:
 * - Points calculation after match completion
 * - Materialized view refreshes
 */

import { getStatsQueue, QUEUE_NAMES } from '../index';
import { loggers } from '@/lib/logger/modules';

export interface CalculateStatsJob {
  matchId: string;
  priority?: 'high' | 'normal';
}

export interface RefreshViewsJob {
  scope: 'all' | 'leaderboard' | 'standings';
  delay?: number;
}

export const STATS_QUEUE_NAME = 'stats-calculation';

export const STATS_JOB_IDS = {
  calculatePoints: 'calculate-points',
  refreshViews: 'refresh-views',
} as const;

const log = loggers.queue;

/**
 * Enqueue points calculation for a match
 * Should be called when a match is scored to calculate and award points
 */
export async function enqueuePointsCalculation(
  matchId: string,
  options?: {
    priority?: 'high' | 'normal';
    delay?: number;
  }
): Promise<void> {
  const queue = getStatsQueue();
  
  const jobId = `points-${matchId}-${Date.now()}`;
  
  log.info({ matchId, jobId, options }, 'Enqueuing points calculation');
  
  await queue.add(
    STATS_JOB_IDS.calculatePoints,
    { matchId, priority: options?.priority } satisfies CalculateStatsJob,
    {
      jobId,
      priority: options?.priority === 'high' ? 1 : 0,
      delay: options?.delay ?? 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

/**
 * Enqueue materialized view refresh
 * Should be called after points calculation completes to refresh cached views
 */
export async function enqueueViewRefresh(
  scope: 'all' | 'leaderboard' | 'standings' = 'all',
  options?: {
    delay?: number;
  }
): Promise<void> {
  const queue = getStatsQueue();
  
  const jobId = `refresh-views-${scope}-${Date.now()}`;
  
  log.info({ scope, jobId, options }, 'Enqueuing view refresh');
  
  await queue.add(
    STATS_JOB_IDS.refreshViews,
    { scope } satisfies RefreshViewsJob,
    {
      jobId,
      delay: options?.delay ?? 0,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 10000,
      },
    }
  );
}

/**
 * Handle calculate points job
 * Verifies match is completed and calculates points with row locking
 */
export async function handleCalculatePoints(matchId: string): Promise<{
  success: boolean;
  pointsCalculated?: number;
  error?: string;
}> {
  const log = loggers.scoringWorker.child({ matchId, operation: 'calculatePoints' });
  
  try {
    log.info('Starting points calculation');
    
    const { getMatchById, getPredictionsForMatch, updatePredictionScores, updateMatchQuotas, updateModelStreak } = await import('@/lib/db/queries');
    const { calculateQuotas, calculateQuotaScores } = await import('@/lib/utils/scoring');
    const { invalidateMatchCaches } = await import('@/lib/cache/redis');
    
    const matchData = await getMatchById(matchId);
    if (!matchData) {
      return { success: false, error: 'Match not found' };
    }
    
    const { match } = matchData;
    
    if (match.status !== 'finished') {
      return { success: false, error: `Match is ${match.status}, not finished` };
    }
    
    if (match.homeScore === null || match.awayScore === null) {
      return { success: false, error: 'Match has no final score' };
    }
    
    const predictions = await getPredictionsForMatch(matchId);
    
    if (predictions.length === 0) {
      return { success: true, pointsCalculated: 0 };
    }
    
    const quotas = calculateQuotas(predictions.map(p => ({
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
    })));
    
    await updateMatchQuotas(matchId, quotas.home, quotas.draw, quotas.away);
    
    let pointsCalculated = 0;
    let scoredCount = 0;
    
    for (const prediction of predictions) {
      if (prediction.status === 'scored') {
        continue;
      }
      
      const breakdown = calculateQuotaScores({
        predictedHome: prediction.predictedHome,
        predictedAway: prediction.predictedAway,
        actualHome: match.homeScore,
        actualAway: match.awayScore,
        quotaHome: quotas.home,
        quotaDraw: quotas.draw,
        quotaAway: quotas.away,
      });
      
      await updatePredictionScores(prediction.id, {
        tendencyPoints: breakdown.tendencyPoints,
        goalDiffBonus: breakdown.goalDiffBonus,
        exactScoreBonus: breakdown.exactScoreBonus,
        totalPoints: breakdown.total,
      });
      
      let resultType: 'exact' | 'tendency' | 'wrong' = 'wrong';
      if (breakdown.total > 0) {
        resultType = breakdown.exactScoreBonus > 0 ? 'exact' : 'tendency';
      }
      
      try {
        await updateModelStreak(prediction.modelId, resultType);
      } catch (streakError: any) {
        log.warn({ modelId: prediction.modelId, error: streakError.message }, 'Failed to update model streak');
      }
      
      scoredCount++;
      pointsCalculated += breakdown.total;
    }
    
    await invalidateMatchCaches(matchId);
    
    log.info({ scoredCount, pointsCalculated }, 'Points calculation complete');
    
    return { success: true, pointsCalculated };
  } catch (error: any) {
    log.error({ error: error.message }, 'Points calculation failed');
    return { success: false, error: error.message };
  }
}

/**
 * Handle view refresh job
 * Refreshes materialized views for leaderboards and standings
 */
export async function handleRefreshViews(
  scope: 'all' | 'leaderboard' | 'standings'
): Promise<{
  success: boolean;
  viewsRefreshed?: string[];
  error?: string;
}> {
  const log = loggers.db.child({ operation: 'refreshViews', scope });
  
  try {
    log.info('Starting view refresh');
    
    const { getDb } = await import('@/lib/db');
    const { cacheDeletePattern, cacheDelete, cacheKeys } = await import('@/lib/cache/redis');
    
    const db = getDb();
    const viewsRefreshed: string[] = [];
    
    if (scope === 'all' || scope === 'leaderboard') {
      await cacheDeletePattern('db:leaderboard:*');
      await cacheDelete(cacheKeys.overallStats());
      await cacheDelete(cacheKeys.topPerformingModel());
      viewsRefreshed.push('leaderboard');
    }
    
    if (scope === 'all' || scope === 'standings') {
      await cacheDeletePattern('api:standings:*');
      viewsRefreshed.push('standings');
    }
    
    log.info({ viewsRefreshed }, 'View refresh complete');
    
    return { success: true, viewsRefreshed };
  } catch (error: any) {
    log.error({ error: error.message }, 'View refresh failed');
    return { success: false, error: error.message };
  }
}
