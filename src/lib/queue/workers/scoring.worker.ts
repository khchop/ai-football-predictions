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
  updateMatchQuotas,
  updateModelStreak
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
            // Process all predictions independently
            // Each prediction update is its own transaction, ensuring if one fails,
            // others can still succeed. Idempotency check prevents double-scoring on retries.
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
                
                // Diagnostic logging for debugging scoring failures
                log.info({
                  predictionId: prediction.id,
                  modelId: prediction.modelId,
                  scores: {
                    tendencyPoints: breakdown.tendencyPoints,
                    goalDiffBonus: breakdown.goalDiffBonus,
                    exactScoreBonus: breakdown.exactScoreBonus,
                    totalPoints: breakdown.total,
                  },
                }, 'Updating prediction scores');

                Sentry.addBreadcrumb({
                  category: 'scoring',
                  message: `Scoring prediction ${prediction.id}`,
                  level: 'info',
                  data: {
                    predictionId: prediction.id,
                    modelId: prediction.modelId,
                    tendencyPoints: breakdown.tendencyPoints,
                    totalPoints: breakdown.total,
                  },
                });
                
                // Update prediction with scores (each is its own implicit transaction)
                await updatePredictionScores(prediction.id, {
                  tendencyPoints: breakdown.tendencyPoints,
                  goalDiffBonus: breakdown.goalDiffBonus,
                  exactScoreBonus: breakdown.exactScoreBonus,
                  totalPoints: breakdown.total,
                });
                
                // Update model streak based on result type
                let resultType: 'exact' | 'tendency' | 'wrong' = 'wrong';
                if (breakdown.total > 0) {
                  // Correct prediction - determine if exact or just tendency
                  if (breakdown.exactScoreBonus > 0) {
                    resultType = 'exact';
                  } else {
                    resultType = 'tendency';
                  }
                }
                
                // Update streak in separate try/catch to avoid marking prediction as failed if streak update fails
                try {
                  await updateModelStreak(prediction.modelId, resultType);
                } catch (streakError: any) {
                  log.warn({ 
                    modelId: prediction.modelId, 
                    resultType, 
                    error: streakError.message,
                    detail: streakError.detail,
                  }, 'Failed to update model streak (prediction was scored successfully)');
                  // Don't re-throw - prediction score is valid, streak update is supplementary
                }
                
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
                log.error({ 
                  predictionId: prediction.id, 
                  modelId: prediction.modelId, 
                  error: error.message,
                  stack: error.stack,
                  code: error.code,
                  detail: error.detail,
                }, 'Failed to score prediction');
                failedPredictions.push({
                  id: prediction.id,
                  modelId: prediction.modelId,
                  error: error.message,
                });
                // Continue with other predictions - don't stop if one fails
              }
            }
          } catch (error: any) {
            log.error({ matchId, error: error.message }, 'Error during prediction scoring loop');
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
               failedPredictions: failedCount > 0 ? failedPredictions : undefined,
               totalPointsAwarded,
               quotas,
               finalScore: `${actualHome}-${actualAway}`,
             };
           }
        
         // Only throw if ALL predictions failed
         if (failedCount > 0 && scoredCount === 0) {
           const errorSamples = failedPredictions.slice(0, 3)
             .map(fp => `${fp.modelId}: ${fp.error}`)
             .join('; ');
           throw new Error(`All ${failedCount} predictions failed for match ${matchId}. Errors: ${errorSamples}`);
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
