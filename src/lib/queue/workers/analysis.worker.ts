/**
 * Analysis Worker
 * 
 * Fetches match analysis (predictions, H2H, odds, injuries) from API-Football.
 * Runs at T-6h before each match.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { AnalyzeMatchPayload } from '../types';
import { fetchAndStoreAnalysis } from '@/lib/football/match-analysis';
import { getMatchById } from '@/lib/db/queries';

export function createAnalysisWorker() {
  return new Worker<AnalyzeMatchPayload>(
    QUEUE_NAMES.ANALYSIS,
    async (job: Job<AnalyzeMatchPayload>) => {
      const { matchId, externalId, homeTeam, awayTeam } = job.data;
      
      console.log(`[Analysis Worker] Analyzing ${homeTeam} vs ${awayTeam} (match: ${matchId})`);
      
      try {
        // Verify match still exists and is scheduled
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          console.log(`[Analysis Worker] Match ${matchId} not found, skipping`);
          return { skipped: true, reason: 'match_not_found' };
        }
        
        const { match } = matchData;
        
        if (match.status !== 'scheduled') {
          console.log(`[Analysis Worker] Match ${matchId} is ${match.status}, skipping`);
          return { skipped: true, reason: 'match_not_scheduled', status: match.status };
        }
        
        // Fetch and store analysis
        const fixtureId = parseInt(externalId, 10);
        const analysis = await fetchAndStoreAnalysis(matchId, fixtureId);
        
        if (!analysis) {
          console.log(`[Analysis Worker] No analysis data available for ${homeTeam} vs ${awayTeam}`);
          return { success: false, reason: 'no_data_available' };
        }
        
        console.log(`[Analysis Worker] ✓ Analysis complete for ${homeTeam} vs ${awayTeam}`);
        
        return { 
          success: true, 
          matchId,
          hasOdds: !!analysis.oddsHome,
          hasH2H: !!analysis.h2hTotal,
          hasInjuries: (analysis.homeInjuriesCount || 0) > 0 || (analysis.awayInjuriesCount || 0) > 0,
        };
      } catch (error: any) {
        console.error(`[Analysis Worker] Error analyzing ${homeTeam} vs ${awayTeam}:`, error);
        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one at a time to avoid API rate limits (each analysis = ~6 API calls)
    }
  );
}
