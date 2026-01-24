/**
 * Scoring Worker
 * 
 * Scores predictions after match finishes using Kicktipp Quota System:
 * 1. Calculate quotas from prediction distribution (2-6 points per tendency)
 * 2. Score each prediction: tendency + goal diff bonus + exact score bonus
 * 3. Update match with quotas for display
 * 
 * Triggered by live-score worker when match status becomes 'finished'.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { SettleMatchPayload } from '../types';
import { 
  getMatchById, 
  getPredictionsForMatch, 
  updatePredictionScores, 
  updateMatchQuotas 
} from '@/lib/db/queries';
import { calculateQuotas, calculateQuotaScores } from '@/lib/utils/scoring';
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
        
        // Get all predictions for this match
        const predictions = await getPredictionsForMatch(matchId);
        
         if (predictions.length === 0) {
           log.info(`No predictions found for match ${matchId}`);
           return { skipped: true, reason: 'no_predictions' };
         }
         
         log.info(`Found ${predictions.length} predictions`);
        
        // Step 1: Calculate quotas from prediction distribution
        // Quota = 30 / (# models with same tendency), clamped to [2-6]
        const quotas = calculateQuotas(predictions.map(p => ({
          predictedHome: p.predictedHome,
          predictedAway: p.predictedAway,
        })));
        
         log.info(`Quotas: Home=${quotas.home}, Draw=${quotas.draw}, Away=${quotas.away}`);
        
        // Step 2: Save quotas to match for display
        await updateMatchQuotas(matchId, quotas.home, quotas.draw, quotas.away);
        
         // Step 3: Score predictions in a database transaction for atomicity
         // This ensures all predictions for a match score together or all fail
         let scoredCount = 0;
         let failedCount = 0;
         let totalPointsAwarded = 0;
         const failedPredictions: Array<{ id: string; modelId: string; error: string }> = [];
         
         try {
           // Process all predictions within a single transaction
           // This prevents double-scoring if the job is retried mid-execution
           const { getDb } = await import('@/lib/db/index');
           const db = getDb();
           
           await db.transaction(async (tx) => {
             for (const prediction of predictions) {
               // Skip already scored predictions (idempotency check)
               if (prediction.status === 'scored') {
                 continue;
               }
               
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
                 
                  // Update prediction with scores within transaction
                  await updatePredictionScores(prediction.id, {
                    tendencyPoints: breakdown.tendencyPoints,
                    goalDiffBonus: breakdown.goalDiffBonus,
                    exactScoreBonus: breakdown.exactScoreBonus,
                    totalPoints: breakdown.total,
                  }, tx);
                 
                  scoredCount++;
                  totalPointsAwarded += breakdown.total;
                  
                  // Log all predictions for complete visibility (including zero points)
                  if (breakdown.total > 0) {
                    log.info({ 
                      modelId: prediction.modelId, 
                      predicted: `${prediction.predictedHome}-${prediction.predictedAway}`, 
                      points: breakdown.total, 
                      breakdown 
                    }, '✓ Scored prediction (points awarded)');
                  } else {
                    log.debug({ 
                      modelId: prediction.modelId, 
                      predicted: `${prediction.predictedHome}-${prediction.predictedAway}`, 
                      actual: `${actualHome}-${actualAway}`,
                      points: 0, 
                      breakdown 
                    }, 'Scored prediction (zero points - no match)');
                  }
               } catch (error: any) {
                 failedCount++;
                 log.error({ predictionId: prediction.id, modelId: prediction.modelId, error: error.message }, 'Failed to score prediction');
                 failedPredictions.push({
                   id: prediction.id,
                   modelId: prediction.modelId,
                   error: error.message,
                 });
                 // Continue with other predictions - don't fail the whole transaction
               }
             }
           });
         } catch (error: any) {
           log.error({ matchId, error: error.message }, 'Transaction error during scoring');
           throw error;
         }
        
         // Log results
         if (failedCount > 0) {
           log.warn(`Scored ${scoredCount} predictions, ${failedCount} failed (${totalPointsAwarded} total points awarded)`);
         } else {
           log.info(`✓ Scored ${scoredCount} predictions (${totalPointsAwarded} total points awarded)`);
         }
        
          // Return partial success if some predictions scored
          if (scoredCount > 0) {
            // Invalidate caches after successful scoring to ensure fresh data
            await invalidateMatchCaches(matchId);
            log.info(`✓ Invalidated caches for match ${matchId}`);
            
            // Generate post-match content (non-blocking)
            try {
              await generatePostMatchContent(matchId);
              log.info({ matchId }, 'Post-match content generation triggered');
            } catch (err) {
              log.warn({ matchId, err }, 'Post-match content generation failed (non-blocking)');
            }
            
            return { 
              success: true, 
              scoredCount,
              failedCount,
              failedPredictions: failedCount > 0 ? failedPredictions : undefined,
              totalPointsAwarded,
              quotas,
              finalScore: `${actualHome}-${actualAway}`,
            };
          }
        
        // Only throw if ALL predictions failed
        if (failedCount > 0 && scoredCount === 0) {
          throw new Error(`All ${failedCount} predictions failed to score for match ${matchId}`);
        }
        
        // This shouldn't happen but return success anyway
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
