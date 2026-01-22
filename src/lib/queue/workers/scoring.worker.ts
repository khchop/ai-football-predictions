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
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { SettleMatchPayload } from '../types';
import { 
  getMatchById, 
  getPredictionsForMatch, 
  updatePredictionScores, 
  updateMatchQuotas 
} from '@/lib/db/queries';
import { calculateQuotas, calculateQuotaScores } from '@/lib/utils/scoring';

export function createScoringWorker() {
  return new Worker<SettleMatchPayload>(
    QUEUE_NAMES.SETTLEMENT, // Keep same queue name for backward compatibility
    async (job: Job<SettleMatchPayload>) => {
      const { matchId } = job.data;
      
      console.log(`[Scoring Worker] Scoring predictions for match ${matchId}`);
      
      try {
        // Get match with final score
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          console.log(`[Scoring Worker] Match ${matchId} not found`);
          return { skipped: true, reason: 'match_not_found' };
        }
        
        const { match } = matchData;
        
        if (match.status !== 'finished') {
          console.log(`[Scoring Worker] Match ${matchId} is ${match.status}, not finished yet`);
          return { skipped: true, reason: 'match_not_finished', status: match.status };
        }
        
        const { homeScore: actualHome, awayScore: actualAway } = match;
        
        if (actualHome === null || actualAway === null) {
          console.log(`[Scoring Worker] Match ${matchId} has no final score`);
          return { skipped: true, reason: 'no_final_score' };
        }
        
        // Get all predictions for this match
        const predictions = await getPredictionsForMatch(matchId);
        
        if (predictions.length === 0) {
          console.log(`[Scoring Worker] No predictions found for match ${matchId}`);
          return { skipped: true, reason: 'no_predictions' };
        }
        
        console.log(`  Found ${predictions.length} predictions`);
        
        // Step 1: Calculate quotas from prediction distribution
        // Quota = 30 / (# models with same tendency), clamped to [2-6]
        const quotas = calculateQuotas(predictions.map(p => ({
          predictedHome: p.predictedHome,
          predictedAway: p.predictedAway,
        })));
        
        console.log(`  Quotas: Home=${quotas.home}, Draw=${quotas.draw}, Away=${quotas.away}`);
        
        // Step 2: Save quotas to match for display
        await updateMatchQuotas(matchId, quotas.home, quotas.draw, quotas.away);
        
        // Step 3: Score each prediction using quota system
        let scoredCount = 0;
        let totalPointsAwarded = 0;
        
        for (const prediction of predictions) {
          // Skip already scored predictions
          if (prediction.status === 'scored') {
            continue;
          }
          
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
          await updatePredictionScores(prediction.id, {
            tendencyPoints: breakdown.tendencyPoints,
            goalDiffBonus: breakdown.goalDiffBonus,
            exactScoreBonus: breakdown.exactScoreBonus,
            totalPoints: breakdown.total,
          });
          
          scoredCount++;
          totalPointsAwarded += breakdown.total;
          
          if (breakdown.total > 0) {
            console.log(`  ✓ ${prediction.modelId}: ${prediction.predictedHome}-${prediction.predictedAway} = ${breakdown.total}pts (${breakdown.tendencyPoints}+${breakdown.goalDiffBonus}+${breakdown.exactScoreBonus})`);
          }
        }
        
        console.log(`[Scoring Worker] ✅ Scored ${scoredCount} predictions (${totalPointsAwarded} total points awarded)`);
        
        return { 
          success: true, 
          scoredCount, 
          totalPointsAwarded,
          quotas,
          finalScore: `${actualHome}-${actualAway}`,
        };
      } catch (error: any) {
        console.error(`[Scoring Worker] Error scoring match ${matchId}:`, error);
        return { 
          success: false, 
          error: error.message,
        };
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Can score multiple matches in parallel
    }
  );
}
