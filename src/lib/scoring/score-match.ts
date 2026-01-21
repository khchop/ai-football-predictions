import {
  getPredictionsForMatch,
  updatePredictionScores,
  setMatchUpset,
  getMatchAnalysisByMatchId,
  saveMatchQuotas,
  updateModelStreak,
} from '@/lib/db/queries';
import { calculateQuotas, calculateQuotaScores } from '@/lib/utils/scoring';
import { isUpsetResult } from '@/lib/utils/upset';

/**
 * Score all predictions for a finished match using Kicktipp quota system.
 * This function is shared between update-live-scores and update-results cron jobs.
 */
export async function scorePredictionsForMatch(
  matchId: string,
  actualHome: number,
  actualAway: number
): Promise<void> {
  console.log(`[Scoring] Calculating quota-based scores for match ${matchId}`);
  
  try {
    // Get analysis data for upset detection (may not exist)
    const analysis = await getMatchAnalysisByMatchId(matchId);
    
    // Only use win percentages if analysis exists and has valid data
    const homeWinPct = (analysis?.homeWinPct != null && analysis.homeWinPct > 0) ? analysis.homeWinPct : null;
    const awayWinPct = (analysis?.awayWinPct != null && analysis.awayWinPct > 0) ? analysis.awayWinPct : null;

    // Determine if this was an upset (for display purposes, not scoring)
    let wasUpset = false;
    if (homeWinPct !== null && awayWinPct !== null) {
      wasUpset = isUpsetResult(homeWinPct, awayWinPct, actualHome, actualAway);
      if (wasUpset) {
        console.log(`[Scoring] Match was an UPSET! (home: ${homeWinPct}%, away: ${awayWinPct}%)`);
      }
    }
    await setMatchUpset(matchId, wasUpset);

    // Get all predictions for this match
    const matchPredictions = await getPredictionsForMatch(matchId);
    console.log(`[Scoring] Found ${matchPredictions.length} predictions to score`);

    if (matchPredictions.length === 0) {
      console.log(`[Scoring] No predictions to score for match ${matchId}`);
      return;
    }

    // Step 1: Calculate quotas based on prediction distribution
    const predictionData = matchPredictions.map(({ prediction }) => ({
      predictedHome: prediction.predictedHomeScore,
      predictedAway: prediction.predictedAwayScore,
    }));
    
    const quotas = calculateQuotas(predictionData);
    console.log(`[Scoring] Quotas: H=${quotas.home} D=${quotas.draw} A=${quotas.away}`);
    
    // Save quotas to match for display
    await saveMatchQuotas(matchId, quotas);

    // Step 2: Score each prediction using the calculated quotas
    let scoredCount = 0;
    let totalPoints = 0;

    for (const { prediction, model } of matchPredictions) {
      // Calculate quota-based scores
      const scores = calculateQuotaScores({
        predictedHome: prediction.predictedHomeScore,
        predictedAway: prediction.predictedAwayScore,
        actualHome,
        actualAway,
        quotaHome: quotas.home,
        quotaDraw: quotas.draw,
        quotaAway: quotas.away,
      });

      // Update prediction with scores
      await updatePredictionScores(prediction.id, scores);
      
      // Update model streak
      const isExact = scores.exactScoreBonus > 0;
      const isCorrectTendency = scores.tendencyPoints > 0;
      const streakResult: 'exact' | 'tendency' | 'wrong' = 
        isExact ? 'exact' : 
        isCorrectTendency ? 'tendency' : 'wrong';
      await updateModelStreak(model.id, streakResult);
      
      scoredCount++;
      totalPoints += scores.total;
      
      // Log notable scores
      if (scores.exactScoreBonus > 0) {
        console.log(`[Scoring] EXACT SCORE: ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} = ${scores.total} pts (tendency: ${scores.tendencyPoints})`);
      } else if (scores.tendencyPoints >= 5) {
        console.log(`[Scoring] HIGH QUOTA: ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} = ${scores.total} pts (rare prediction!)`);
      }
    }

    console.log(`[Scoring] Scored ${scoredCount} predictions, total ${totalPoints} points, avg ${(totalPoints / scoredCount).toFixed(2)}`);
  } catch (error) {
    console.error(`[Scoring] Error scoring match ${matchId}:`, error);
  }
}
