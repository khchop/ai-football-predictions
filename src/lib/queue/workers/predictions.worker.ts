/**
 * Predictions Worker
 * 
 * Generates score predictions for all active models for a match.
 * Uses Kicktipp Quota Scoring system.
 * Runs at T-30m (after lineups are available).
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { PredictMatchPayload } from '../types';
import { 
  getMatchById, 
  getMatchAnalysisByMatchId,
  getPredictionsForMatch,
  createPrediction,
} from '@/lib/db/queries';
import { getActiveProviders } from '@/lib/llm';
import { buildBatchPrompt } from '@/lib/football/prompt-builder';
import { parseBatchPredictionResponse, BATCH_SYSTEM_PROMPT } from '@/lib/llm/prompt';
import { getStandingsForLeagues, getStandingFromMap } from '@/lib/football/standings';
import { getResult } from '@/lib/utils/scoring';
import { v4 as uuidv4 } from 'uuid';

export function createPredictionsWorker() {
  return new Worker<PredictMatchPayload>(
    QUEUE_NAMES.PREDICTIONS,
    async (job: Job<PredictMatchPayload>) => {
      const { matchId, skipIfDone = false } = job.data;
      
      console.log(`[Predictions Worker] Generating predictions for match ${matchId}`);
      
      try {
        // Check if predictions already exist
        if (skipIfDone) {
          const existingPredictions = await getPredictionsForMatch(matchId);
          if (existingPredictions.length > 0) {
            console.log(`[Predictions Worker] Predictions already exist for match ${matchId}, skipping`);
            return { skipped: true, reason: 'predictions_already_exist', predictionCount: existingPredictions.length };
          }
        }
        
        // Get match data
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          console.log(`[Predictions Worker] Match ${matchId} not found`);
          return { skipped: true, reason: 'match_not_found' };
        }
        
        const { match, competition } = matchData;
        
        if (match.status !== 'scheduled') {
          console.log(`[Predictions Worker] Match ${matchId} is ${match.status}, skipping`);
          return { skipped: true, reason: 'match_not_scheduled', status: match.status };
        }
        
        // Get analysis (odds excluded from prompt, but analysis contains other stats)
        const analysis = await getMatchAnalysisByMatchId(matchId);
        if (!analysis) {
          console.log(`[Predictions Worker] No analysis for match ${matchId}`);
          return { skipped: true, reason: 'no_analysis' };
        }
        
        // Get standings
        let homeStanding = null;
        let awayStanding = null;
        
        if (competition.apiFootballId) {
          try {
            const standingsMap = await getStandingsForLeagues([competition.apiFootballId]);
            homeStanding = getStandingFromMap(match.homeTeam, competition.apiFootballId, standingsMap);
            awayStanding = getStandingFromMap(match.awayTeam, competition.apiFootballId, standingsMap);
          } catch (error: any) {
            console.error(`[Predictions Worker] Failed to get standings:`, error.message);
          }
        }
        
        // Get active providers
        const providers = getActiveProviders();
        console.log(`[Predictions Worker] Generating predictions from ${providers.length} models`);
        
        let successCount = 0;
        let failCount = 0;
        
        // Generate predictions for each model
        for (const provider of providers) {
          try {
            // Build prompt (WITHOUT ODDS - only stats, form, H2H, standings)
            const prompt = buildBatchPrompt([{
              matchId: match.id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              competition: competition.name,
              kickoffTime: match.kickoffTime,
              analysis,
              homeStanding,
              awayStanding,
            }]);
            
            // Call LLM with score prediction system prompt
            const rawResponse = await (provider as any).callAPI(BATCH_SYSTEM_PROMPT, prompt);
            
            // Parse simple JSON: [{match_id: "xxx", home_score: X, away_score: Y}]
            const parsed = parseBatchPredictionResponse(rawResponse, [matchId]);
            
            if (!parsed.success || parsed.predictions.length === 0) {
              console.error(`  ${provider.id}: Failed to parse prediction - ${parsed.error}`);
              failCount++;
              continue;
            }
            
            const prediction = parsed.predictions[0];
            
            // Determine result tendency (H/D/A)
            const result = getResult(prediction.homeScore, prediction.awayScore);
            
            // Save prediction
            await createPrediction({
              id: uuidv4(),
              matchId,
              modelId: provider.id,
              predictedHome: prediction.homeScore,
              predictedAway: prediction.awayScore,
              predictedResult: result,
              status: 'pending',
            });
            
            console.log(`  ✓ ${provider.id}: ${prediction.homeScore}-${prediction.awayScore}`);
            successCount++;
          } catch (error: any) {
            console.error(`  ${provider.id}: Error - ${error.message}`);
            failCount++;
          }
        }
        
        console.log(`[Predictions Worker] Complete: ${successCount} success, ${failCount} failed`);
        
        return { 
          success: true, 
          successCount, 
          failCount,
          totalModels: providers.length,
        };
      } catch (error: any) {
        console.error(`[Predictions Worker] Error processing match ${matchId}:`, error);
        return { 
          success: false, 
          error: error.message,
        };
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one match at a time (models run in parallel within)
    }
  );
}
