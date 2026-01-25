/**
 * Lineups Worker
 * 
 * Fetches confirmed team lineups from API-Football.
 * Runs at T-60m before each match. If lineups are found, triggers immediate prediction.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, JOB_TYPES, predictionsQueue } from '../index';
import type { FetchLineupsPayload } from '../types';
import { updateMatchLineups } from '@/lib/football/lineups';
import { loggers } from '@/lib/logger/modules';
import { getMatchWithRetry } from '@/lib/utils/retry-helpers';

export function createLineupsWorker() {
  return new Worker<FetchLineupsPayload>(
    QUEUE_NAMES.LINEUPS,
    async (job: Job<FetchLineupsPayload>) => {
      const { matchId, externalId, homeTeam, awayTeam } = job.data;
      const log = loggers.lineupsWorker.child({ jobId: job.id, jobName: job.name });
      
       log.info(`Fetching lineups for ${homeTeam} vs ${awayTeam} (match: ${matchId})`);
       
       try {
         // Verify match still exists and is scheduled
         const matchData = await getMatchWithRetry(matchId, 3, 2000, log);
         if (!matchData) {
           log.info(`Match ${matchId} not found after retries, skipping`);
           return { skipped: true, reason: 'match_not_found' };
         }
         
         const { match } = matchData;
         
         if (match.status !== 'scheduled') {
           log.info(`Match ${matchId} is ${match.status}, skipping`);
           return { skipped: true, reason: 'match_not_scheduled', status: match.status };
         }
        
        // Fetch and store lineups
        const fixtureId = parseInt(externalId, 10);
        const lineupsFound = await updateMatchLineups(matchId, fixtureId);
        
         if (!lineupsFound) {
           log.info(`Lineups not available yet for ${homeTeam} vs ${awayTeam}`);
           return { success: false, lineupsFound: false };
         }
        
         log.info(`✓ Lineups found for ${homeTeam} vs ${awayTeam}`);
        
        // Lineups are available! Trigger immediate high-priority prediction
        // This ensures we generate predictions as soon as lineups are confirmed
        try {
          await predictionsQueue.add(
            JOB_TYPES.PREDICT_MATCH,
            {
              matchId,
              attempt: 1,
              skipIfDone: true, // Don't regenerate if already predicted
              force: false,
            },
            {
              priority: 1, // High priority (lower number = higher priority)
              jobId: `predict-immediate-${matchId}`,
            }
          );
           log.info(`Queued immediate prediction for ${homeTeam} vs ${awayTeam}`);
          } catch (error: any) {
            // Job might already exist, that's fine
            if (!error.message?.includes('already exists')) {
              log.error({ 
                matchId, 
                externalId,
                err: error 
              }, `Failed to queue immediate prediction`);
            }
          }
        
        return { 
          success: true, 
          lineupsFound: true,
          matchId,
          immediatePredictionQueued: true,
        };
       } catch (error: any) {
           log.error({ 
             matchId, 
             externalId, 
             homeTeam, 
             awayTeam,
             attemptsMade: job.attemptsMade,
             err: error 
           }, `Error fetching lineups`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'lineups',
               matchId,
             },
             extra: {
               jobId: job.id,
               externalId,
               homeTeam,
               awayTeam,
               attempt: job.attemptsMade,
             },
           });
           
           throw error; // Let BullMQ handle retry
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Process 3 lineup fetches in parallel
    }
  );
}
