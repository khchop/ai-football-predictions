/**
 * Predictions Worker
 * 
 * Generates predictions and bets for all active models for a match.
 * Runs at T-90m, T-30m, and T-5m (with final attempt forced).
 * 
 * CRITICAL: Refreshes odds immediately before generating predictions!
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { PredictMatchPayload } from '../types';
import { 
  getMatchById, 
  getMatchAnalysisByMatchId,
  getBetsForMatch,
  getCurrentSeason,
  getOrCreateModelBalance,
  createBetsWithBalanceUpdate,
} from '@/lib/db/queries';
import { getActiveProviders } from '@/lib/llm';
import { buildBatchPrompt } from '@/lib/football/prompt-builder';
import { parseBatchBettingResponse, BATCH_SYSTEM_PROMPT } from '@/lib/llm/prompt';
import { getBetOdds } from '@/lib/betting/odds-lookup';
import { getStandingsForLeagues, getStandingFromMap } from '@/lib/football/standings';
import type { NewBet } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

export function createPredictionsWorker() {
  return new Worker<PredictMatchPayload>(
    QUEUE_NAMES.PREDICTIONS,
    async (job: Job<PredictMatchPayload>) => {
      const { matchId, attempt, skipIfDone = false, force = false } = job.data;
      
      console.log(`[Predictions Worker] Attempt ${attempt} for match ${matchId} (skipIfDone: ${skipIfDone}, force: ${force})`);
      
      try {
        // Check if bets already exist
        if (skipIfDone) {
          const existingBets = await getBetsForMatch(matchId);
          if (existingBets.length > 0) {
            console.log(`[Predictions Worker] Bets already exist for match ${matchId}, skipping`);
            return { skipped: true, reason: 'bets_already_exist', betCount: existingBets.length };
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
        
        // Get analysis (odds refreshed by scheduler before this job runs)
        const analysis = await getMatchAnalysisByMatchId(matchId);
        if (!analysis) {
          console.log(`[Predictions Worker] No analysis for match ${matchId}`);
          return { skipped: true, reason: 'no_analysis' };
        }
        
        // Check if lineups are available
        if (!force && !analysis.lineupsAvailable) {
          console.log(`[Predictions Worker] Lineups not available for ${match.homeTeam} vs ${match.awayTeam}, skipping (attempt ${attempt})`);
          return { skipped: true, reason: 'lineups_not_available', attempt };
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
        
        // Get current season (returns string like '2024-2025')
        const seasonName = await getCurrentSeason();
        
        let successCount = 0;
        let failCount = 0;
        
        // Generate predictions for each model
        for (const provider of providers) {
          try {
            // Build prompt
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
            
            // Call LLM
            const rawResponse = await (provider as any).callAPI(BATCH_SYSTEM_PROMPT, prompt);
            
            // Parse response
            const parsed = parseBatchBettingResponse(rawResponse, [matchId]);
            
            if (!parsed.success || parsed.bets.length === 0) {
              console.error(`  ${provider.id}: Failed to parse bets - ${parsed.error}`);
              failCount++;
              continue;
            }
            
            const bet = parsed.bets[0];
            
            // Get odds for each bet
            const resultOdds = getBetOdds(analysis, 'result', bet.resultBet);
            const overUnderOdds = getBetOdds(analysis, 'over_under', bet.overUnderBet);
            const bttsOdds = getBetOdds(analysis, 'btts', bet.bttsBet);
            
            // Ensure model balance exists
            await getOrCreateModelBalance(provider.id, seasonName);
            
            // Create bets
            const betsToCreate: NewBet[] = [
              {
                id: uuidv4(),
                season: seasonName,
                modelId: provider.id,
                matchId,
                betType: 'result',
                selection: bet.resultBet,
                odds: resultOdds ?? 2.0,
                stake: 100,
                status: 'pending',
              },
              {
                id: uuidv4(),
                season: seasonName,
                modelId: provider.id,
                matchId,
                betType: 'over_under',
                selection: bet.overUnderBet,
                odds: overUnderOdds ?? 2.0,
                stake: 100,
                status: 'pending',
              },
              {
                id: uuidv4(),
                season: seasonName,
                modelId: provider.id,
                matchId,
                betType: 'btts',
                selection: bet.bttsBet,
                odds: bttsOdds ?? 2.0,
                stake: 100,
                status: 'pending',
              },
            ];
            
            const totalStake = 300; // 3 bets x 100
            
            // Create bets atomically
            await createBetsWithBalanceUpdate(betsToCreate, provider.id, seasonName, totalStake);
            
            successCount++;
            console.log(`  ✓ ${provider.id}: Created 3 bets`);
          } catch (error: any) {
            console.error(`  ✗ ${provider.id}: ${error.message}`);
            failCount++;
          }
        }
        
        console.log(`[Predictions Worker] ✓ ${match.homeTeam} vs ${match.awayTeam}: ${successCount} models succeeded, ${failCount} failed`);
        
        return {
          success: true,
          matchId,
          attempt,
          modelsSucceeded: successCount,
          modelsFailed: failCount,
          lineupsAvailable: analysis.lineupsAvailable,
        };
      } catch (error: any) {
        console.error(`[Predictions Worker] Error:`, error);
        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one match at a time (each match calls 30 models)
    }
  );
}
