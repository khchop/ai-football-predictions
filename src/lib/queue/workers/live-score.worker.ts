/**
 * Live Score Worker
 * 
 * Monitors a single match during the game, updating scores and status.
 * Self-schedules next poll every 60 seconds until match finishes.
 * Triggers settlement when match ends.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, JOB_TYPES, liveQueue, settlementQueue, getQueue } from '../index';
import type { MonitorLivePayload } from '../types';
import { getMatchById, updateMatchResult } from '@/lib/db/queries';
import { getFixtureById, mapFixtureStatus, formatMatchMinute } from '@/lib/football/api-football';
import { loggers } from '@/lib/logger/modules';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_POLLS = 150; // Stop after 150 polls (2.5 hours) to prevent infinite loops

// Use consistent job ID for deduplication (no poll count in ID)
function getLiveJobId(matchId: string): string {
  return `live-${matchId}`;
}

// Helper to safely schedule next poll with deduplication check
async function scheduleNextPoll(
  matchId: string,
  externalId: string,
  kickoffTime: string,
  pollCount: number,
  log: any
): Promise<boolean> {
  const nextJobId = getLiveJobId(matchId);
  
  try {
    // Check if job already exists (active, waiting, or delayed)
    const existingJob = await liveQueue.getJob(nextJobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        log.debug({ matchId, state }, 'Next poll already scheduled, skipping duplicate');
        return false;
      }
    }
    
    await liveQueue.add(
      JOB_TYPES.MONITOR_LIVE,
      {
        matchId,
        externalId,
        kickoffTime,
        pollCount: pollCount + 1,
      },
      {
        delay: POLL_INTERVAL_MS,
        jobId: nextJobId,
      }
    );
    return true;
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      log.debug({ matchId }, 'Next poll job already exists');
      return false;
    }
    log.error({ matchId, err }, 'Failed to schedule next poll');
    return false;
  }
}

export function createLiveScoreWorker() {
  return new Worker<MonitorLivePayload>(
    QUEUE_NAMES.LIVE,
    async (job: Job<MonitorLivePayload>) => {
      const { matchId, externalId, pollCount = 0 } = job.data;
      const log = loggers.liveScoreWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Poll ${pollCount + 1} for match ${matchId}`);
      
      try {
         // Safety: Stop if too many polls
         if (pollCount >= MAX_POLLS) {
           log.info(`Max polls reached (${MAX_POLLS}) for match ${matchId}, stopping`);
           return { stopped: true, reason: 'max_polls_reached', pollCount };
         }
        
         // Get match data
         const matchData = await getMatchById(matchId);
         if (!matchData) {
           log.info(`Match ${matchId} not found`);
           return { stopped: true, reason: 'match_not_found' };
         }
        
        const { match } = matchData;
        
         // If match already finished, stop polling
         if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'postponed') {
           log.info(`Match ${matchId} is ${match.status}, stopping polls`);
           return { stopped: true, reason: 'match_already_finished', status: match.status };
         }
        
         // Fetch fixture from API
         const fixtureId = parseInt(externalId, 10);
         const fixture = await getFixtureById(fixtureId);
         
          if (!fixture) {
            log.warn({ matchId, externalId }, 'No fixture data from API, throwing for BullMQ retry');
            throw new Error(`No fixture data for match ${matchId} (fixture ${externalId})`);
          }
        
        // Extract data from fixture
        const newStatus = mapFixtureStatus(fixture.fixture.status.short);
        const matchMinute = formatMatchMinute(fixture.fixture.status);
        const homeScore = fixture.goals.home ?? 0;
        const awayScore = fixture.goals.away ?? 0;
        
        // Check if anything changed
        const statusChanged = newStatus !== match.status;
        const scoreChanged = homeScore !== match.homeScore || awayScore !== match.awayScore;
        const minuteChanged = matchMinute !== match.matchMinute;
        
         if (statusChanged || scoreChanged || minuteChanged) {
           await updateMatchResult(matchId, homeScore, awayScore, newStatus, matchMinute);
           log.info(`${match.homeTeam} vs ${match.awayTeam}: ${homeScore}-${awayScore} (${matchMinute}, ${newStatus})`);
         }
        
         // Check if match finished
         if (newStatus === 'finished') {
           log.info(`✓ Match ${matchId} finished! Triggering settlement...`);
          
          // Trigger settlement job
          await settlementQueue.add(
            JOB_TYPES.SETTLE_MATCH,
            {
              matchId,
              homeScore,
              awayScore,
              status: newStatus,
            },
            {
              priority: 1, // High priority
              jobId: `settle-${matchId}`,
            }
          );
          
          return {
            success: true,
            finished: true,
            finalScore: `${homeScore}-${awayScore}`,
            pollCount: pollCount + 1,
            settlementTriggered: true,
          };
        }
        
         // Match still ongoing - schedule next poll with deduplication
         const nextPollScheduled = await scheduleNextPoll(matchId, externalId, match.kickoffTime, pollCount, log);
         
         return {
           success: true,
           finished: false,
           currentScore: `${homeScore}-${awayScore}`,
           status: newStatus,
           minute: matchMinute,
           pollCount: pollCount + 1,
           nextPollScheduled,
         };
       } catch (error: any) {
           log.error({ matchId, externalId, pollCount, err: error }, `Error polling live score`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'live-score',
               matchId,
             },
             extra: {
               jobId: job.id,
               externalId,
               pollCount,
               kickoffTime: job.data.kickoffTime,
             },
           });
          
          // Throw error to enable BullMQ retry mechanism
          // BullMQ will retry with exponential backoff based on queue config
          // For transient errors, BullMQ retry handles the recovery
          // For non-retryable errors, they'll be moved to DLQ after max retries
          throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 10, // Monitor up to 10 matches simultaneously
    }
  );
}
