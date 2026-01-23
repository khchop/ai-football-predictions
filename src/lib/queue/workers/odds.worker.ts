/**
 * Odds Worker
 * 
 * Refreshes betting odds from API-Football for a match.
 * Runs at T-2h, T-95m, T-35m, and T-10m before kickoff to ensure fresh odds for predictions.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { RefreshOddsPayload } from '../types';
import { refreshOddsForMatch } from '@/lib/football/match-analysis';
import { getMatchById } from '@/lib/db/queries';
import { generatePreMatchContent } from '@/lib/content/match-content';
import { loggers } from '@/lib/logger/modules';

export function createOddsWorker() {
  return new Worker<RefreshOddsPayload>(
    QUEUE_NAMES.ODDS,
    async (job: Job<RefreshOddsPayload>) => {
      const { matchId, externalId } = job.data;
      const log = loggers.oddsWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Refreshing odds for match ${matchId} (fixture: ${externalId})`);
      
      try {
         // Verify match still exists and is scheduled
         const matchData = await getMatchById(matchId);
         if (!matchData) {
           log.info(`Match ${matchId} not found, skipping`);
           return { skipped: true, reason: 'match_not_found' };
         }
        
        const { match } = matchData;
        
         if (match.status !== 'scheduled') {
           log.info(`Match ${matchId} is ${match.status}, skipping`);
           return { skipped: true, reason: 'match_not_scheduled', status: match.status };
         }
        
        // Refresh odds (uses 10-min cache for efficiency)
        const fixtureId = parseInt(externalId, 10);
        const success = await refreshOddsForMatch(matchId, fixtureId);
        
         if (!success) {
           log.info(`No odds data available for ${match.homeTeam} vs ${match.awayTeam}`);
           return { success: false, reason: 'no_odds_available' };
         }
        
         log.info(`✓ Odds refreshed for ${match.homeTeam} vs ${match.awayTeam}`);
         
         // Generate pre-match content (non-blocking)
         try {
           await generatePreMatchContent(matchId);
           log.info({ matchId }, 'Pre-match content generation triggered');
         } catch (err) {
           log.warn({ matchId, err }, 'Pre-match content generation failed (non-blocking)');
         }
         
         return { 
           success: true, 
           matchId,
         };
       } catch (error: any) {
           log.error({ 
             matchId, 
             externalId,
             attemptsMade: job.attemptsMade,
             err: error 
           }, `Error refreshing odds`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'odds',
               matchId,
             },
             extra: {
               jobId: job.id,
               externalId,
               attempt: job.attemptsMade,
             },
           });
           
           throw error; // Let BullMQ handle retry
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process 1 at a time to avoid rate limits
    }
  );
}
