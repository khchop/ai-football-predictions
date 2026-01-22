/**
 * Odds Worker
 * 
 * Refreshes betting odds from API-Football for a match.
 * Runs at T-2h, T-95m, T-35m, and T-10m before kickoff to ensure fresh odds for predictions.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { RefreshOddsPayload } from '../types';
import { refreshOddsForMatch } from '@/lib/football/match-analysis';
import { getMatchById } from '@/lib/db/queries';

export function createOddsWorker() {
  return new Worker<RefreshOddsPayload>(
    QUEUE_NAMES.ODDS,
    async (job: Job<RefreshOddsPayload>) => {
      const { matchId, externalId } = job.data;
      
      console.log(`[Odds Worker] Refreshing odds for match ${matchId} (fixture: ${externalId})`);
      
      try {
        // Verify match still exists and is scheduled
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          console.log(`[Odds Worker] Match ${matchId} not found, skipping`);
          return { skipped: true, reason: 'match_not_found' };
        }
        
        const { match } = matchData;
        
        if (match.status !== 'scheduled') {
          console.log(`[Odds Worker] Match ${matchId} is ${match.status}, skipping`);
          return { skipped: true, reason: 'match_not_scheduled', status: match.status };
        }
        
        // Refresh odds (uses 10-min cache for efficiency)
        const fixtureId = parseInt(externalId, 10);
        const success = await refreshOddsForMatch(matchId, fixtureId);
        
        if (!success) {
          console.log(`[Odds Worker] No odds data available for ${match.homeTeam} vs ${match.awayTeam}`);
          return { success: false, reason: 'no_odds_available' };
        }
        
        console.log(`[Odds Worker] ✓ Odds refreshed for ${match.homeTeam} vs ${match.awayTeam}`);
        
        return { 
          success: true, 
          matchId,
        };
      } catch (error: any) {
        console.error(`[Odds Worker] Error refreshing odds for match ${matchId}:`, error);
        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Process 3 odds refreshes in parallel
    }
  );
}
