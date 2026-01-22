/**
 * Lineups Worker
 * 
 * Fetches confirmed team lineups from API-Football.
 * Runs at T-60m before each match. If lineups are found, triggers immediate prediction.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES, JOB_TYPES, predictionsQueue } from '../index';
import type { FetchLineupsPayload } from '../types';
import { updateMatchLineups } from '@/lib/football/lineups';
import { getMatchById } from '@/lib/db/queries';

export function createLineupsWorker() {
  return new Worker<FetchLineupsPayload>(
    QUEUE_NAMES.LINEUPS,
    async (job: Job<FetchLineupsPayload>) => {
      const { matchId, externalId, homeTeam, awayTeam } = job.data;
      
      console.log(`[Lineups Worker] Fetching lineups for ${homeTeam} vs ${awayTeam} (match: ${matchId})`);
      
      try {
        // Verify match still exists and is scheduled
        const matchData = await getMatchById(matchId);
        if (!matchData) {
          console.log(`[Lineups Worker] Match ${matchId} not found, skipping`);
          return { skipped: true, reason: 'match_not_found' };
        }
        
        const { match } = matchData;
        
        if (match.status !== 'scheduled') {
          console.log(`[Lineups Worker] Match ${matchId} is ${match.status}, skipping`);
          return { skipped: true, reason: 'match_not_scheduled', status: match.status };
        }
        
        // Fetch and store lineups
        const fixtureId = parseInt(externalId, 10);
        const lineupsFound = await updateMatchLineups(matchId, fixtureId);
        
        if (!lineupsFound) {
          console.log(`[Lineups Worker] Lineups not available yet for ${homeTeam} vs ${awayTeam}`);
          return { success: false, lineupsFound: false };
        }
        
        console.log(`[Lineups Worker] ✓ Lineups found for ${homeTeam} vs ${awayTeam}`);
        
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
          console.log(`[Lineups Worker] Queued immediate prediction for ${homeTeam} vs ${awayTeam}`);
        } catch (error: any) {
          // Job might already exist, that's fine
          if (!error.message?.includes('already exists')) {
            console.error(`[Lineups Worker] Failed to queue immediate prediction:`, error);
          }
        }
        
        return { 
          success: true, 
          lineupsFound: true,
          matchId,
          immediatePredictionQueued: true,
        };
      } catch (error: any) {
        console.error(`[Lineups Worker] Error fetching lineups for ${homeTeam} vs ${awayTeam}:`, error);
        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Process 3 lineup fetches in parallel
    }
  );
}
