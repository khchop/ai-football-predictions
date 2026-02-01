/**
 * Scoring Worker
 *
 * Scores predictions after match finishes using Kicktipp Quota System:
 * 1. Calculate quotas from prediction distribution (2-6 points per tendency)
 * 2. Score each prediction: tendency + goal diff bonus + exact score bonus
 * 3. Update match with quotas for display
 *
 * Uses database transactions with FOR UPDATE locking to prevent race conditions
 * when concurrent settlement jobs attempt to score the same match.
 *
 * Triggered by live-score worker when match status becomes 'finished'.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, getContentQueue } from '../index';
import type { SettleMatchPayload, GenerateRoundupPayload } from '../types';
import {
  getMatchById,
  getPredictionsForMatch,
  updateMatchQuotas,
  scorePredictionsTransactional
} from '@/lib/db/queries';
import { calculateQuotas } from '@/lib/utils/scoring';
import { invalidateMatchCaches } from '@/lib/cache/redis';
import { generatePostMatchContent } from '@/lib/content/match-content';
import { loggers } from '@/lib/logger/modules';

export function createScoringWorker() {
  return new Worker<SettleMatchPayload>(
    QUEUE_NAMES.SETTLEMENT, // Keep same queue name for backward compatibility
    async (job: Job<SettleMatchPayload>) => {
      const { matchId } = job.data;
      const log = loggers.scoringWorker.child({ jobId: job.id, jobName: job.name });

      log.info(`Scoring predictions for match ${matchId}`);

      try {
        // Get match with final score
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          log.info(`Match ${matchId} not found`);
          return { skipped: true, reason: 'match_not_found' };
        }

        const { match } = matchData;

        if (match.status !== 'finished') {
          log.info(`Match ${matchId} is ${match.status}, not finished yet`);
          return { skipped: true, reason: 'match_not_finished', status: match.status };
        }

        const { homeScore: actualHome, awayScore: actualAway } = match;

        if (actualHome === null || actualAway === null) {
          log.info(`Match ${matchId} has no final score`);
          return { skipped: true, reason: 'no_final_score' };
        }

        // Get all predictions for this match (for quota calculation)
        const predictions = await getPredictionsForMatch(matchId);

        if (predictions.length === 0) {
          log.info(`No predictions found for match ${matchId}`);
          return { skipped: true, reason: 'no_predictions' };
        }

        log.info(`Found ${predictions.length} predictions`);

        // Step 1: Calculate quotas from prediction distribution
        // Quota = totalPredictions / predictionsForTendency, clamped to [2-6]
        const quotas = calculateQuotas(predictions.map(p => ({
          predictedHome: p.predictedHome,
          predictedAway: p.predictedAway,
        })));

        log.info(`Quotas: Home=${quotas.home}, Draw=${quotas.draw}, Away=${quotas.away}`);

        // Step 2: Save quotas to match for display
        await updateMatchQuotas(matchId, quotas.home, quotas.draw, quotas.away);

        // Step 3: Score all predictions in a single transaction with row-level locking
        // This prevents race conditions when concurrent settlement jobs run
        // (e.g., live-score worker + backfill job both triggering for same match)
        const result = await scorePredictionsTransactional(
          matchId,
          actualHome,
          actualAway,
          quotas
        );

        if (!result.success) {
          throw new Error(result.error || 'Settlement transaction failed');
        }

        const { scoredCount, failedCount, totalPointsAwarded } = result;

        // Log results
        if (failedCount > 0) {
          log.warn(`Scored ${scoredCount} predictions, ${failedCount} failed (${totalPointsAwarded} total points awarded)`);
        } else {
          log.info(`Scored ${scoredCount} predictions (${totalPointsAwarded} total points awarded)`);
        }

        // Step 4: Post-transaction operations (cache invalidation, stats, content)
        // IMPORTANT: These happen ONLY after transaction commits successfully
        if (scoredCount > 0) {
          // Invalidate caches after successful scoring to ensure fresh data
          await invalidateMatchCaches(matchId);
          log.info(`Invalidated caches for match ${matchId}`);

          // Generate post-match content (non-blocking)
          try {
            await generatePostMatchContent(matchId);
            log.info({ matchId }, 'Post-match content generation triggered');
          } catch (err) {
            log.warn({ matchId, err }, 'Post-match content generation failed (non-blocking)');
          }

          // NOTE: Roundup generation moved to stats worker (calculate-stats.ts)
          // Roundups now trigger AFTER stats calculation to ensure complete model data

          // Trigger stats calculation and view refresh (non-blocking)
          try {
            const { enqueuePointsCalculation } = await import('@/lib/queue/jobs/calculate-stats');
            await enqueuePointsCalculation(matchId, { priority: 'high', delay: 1000 });
            log.info({ matchId }, 'Stats calculation triggered');
          } catch (err) {
            log.warn({ matchId, err }, 'Stats calculation trigger failed (non-blocking)');
          }

          return {
            success: true,
            scoredCount,
            failedCount,
            totalPointsAwarded,
            quotas,
            finalScore: `${actualHome}-${actualAway}`,
          };
        }

        // No predictions scored (all already scored or none pending)
        return {
          success: true,
          scoredCount: 0,
          failedCount: 0,
          totalPointsAwarded: 0,
          quotas,
          finalScore: `${actualHome}-${actualAway}`,
        };
      } catch (error: any) {
        log.error({ err: error }, `Error scoring match ${matchId}`);

        Sentry.captureException(error, {
          level: 'error',
          tags: {
            worker: 'scoring',
            matchId,
          },
          extra: {
            jobId: job.id,
            matchId,
          },
        });

        // Throw error to enable BullMQ retry mechanism
        // BullMQ will retry with exponential backoff based on queue config
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Can score multiple matches in parallel
    }
  );
}

/**
 * Schedule post-match roundup generation after settlement
 * Uses 60-second delay to allow settlement to complete fully
 */
export async function schedulePostMatchRoundup(matchId: string, delayMs: number = 60000): Promise<void> {
  const log = loggers.scoringWorker.child({ matchId, delayMs });

  log.info('Scheduling post-match roundup generation');

  const contentQueue = getContentQueue();

  await contentQueue.add(
    'generate-roundup',
    {
      type: 'generate-roundup',
      data: {
        matchId,
        triggeredAt: new Date().toISOString(),
      },
    } as GenerateRoundupPayload,
    {
      jobId: `roundup-${matchId}`, // Prevent duplicates
      removeOnComplete: {
        age: 86400, // Keep for 24 hours
        count: 100,
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
      delay: delayMs, // Delay before job becomes available
    }
  );

  log.info({ matchId, delayMs }, 'Scheduled post-match roundup generation');
}
