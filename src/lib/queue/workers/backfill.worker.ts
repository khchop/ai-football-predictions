/**
 * Backfill Worker
 * 
 * Periodically checks for matches with missing data and triggers
 * the appropriate jobs to fill in the gaps.
 * 
 * Runs every hour via repeatable job.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, JOB_TYPES, analysisQueue, oddsQueue, lineupsQueue, predictionsQueue, settlementQueue } from '../index';
import type { BackfillMissingPayload } from '../types';
import { 
  getMatchesMissingAnalysis,
  getMatchesMissingOdds,
  getMatchesMissingLineups,
  getMatchesMissingPredictions,
  getMatchesNeedingScoring,
} from '@/lib/db/queries';
import { checkAndFixStuckMatches, checkAndFixStuckLiveMatches } from '../catch-up';
import { loggers } from '@/lib/logger/modules';

export function createBackfillWorker() {
  return new Worker<BackfillMissingPayload>(
    QUEUE_NAMES.BACKFILL,
    async (job: Job<BackfillMissingPayload>) => {
      const { hoursAhead = 12, type } = job.data;
      const log = loggers.backfillWorker.child({ jobId: job.id, jobName: job.name });
      
      // ============ STUCK MATCHES RECOVERY ============
      // Check for matches stuck in 'scheduled' status that should be live
      // AND matches in 'live' status that have no active polling
      if (type === 'stuck-matches') {
        log.info('Starting stuck match recovery check...');
        
        try {
          const stuckScheduledFixed = await checkAndFixStuckMatches();
          const stuckLiveFixed = await checkAndFixStuckLiveMatches();
          const totalFixed = stuckScheduledFixed + stuckLiveFixed;
          
          if (totalFixed > 0) {
            log.info({ stuckScheduledFixed, stuckLiveFixed, totalFixed }, '✓ Recovered stuck matches - triggered live monitoring');
          } else {
            log.debug('No stuck matches found');
          }
          
          return {
            success: true,
            type: 'stuck-matches',
            stuckScheduledFixed,
            stuckLiveFixed,
            stuckFixed: totalFixed,
          };
        } catch (error: any) {
          log.error({ err: error }, 'Failed to check stuck matches');
          throw error;
        }
      }
      
      // ============ REGULAR BACKFILL ============
      log.info(`Checking for matches with missing data (next ${hoursAhead}h)...`);
      
      const MAX_ERRORS = 100;
      
      // Track actual windows used for debugging
      const analysisHoursAhead = Math.max(hoursAhead, 48); // ALWAYS check full 48h window for analysis
      const lineupsHoursAhead = 12; // Wider window for lineups (not 2h)
      const predictionsHoursAhead = 12; // Wider window for predictions (not 2h)

      const results = {
        analysisTriggered: 0,
        oddsTriggered: 0,
        lineupsTriggered: 0,
        predictionsTriggered: 0,
        scoringsTriggered: 0,
        errors: [] as string[],
        windows: { analysis: analysisHoursAhead, lineups: lineupsHoursAhead, predictions: predictionsHoursAhead },
      };
      
       // Helper to add errors with cap
       const addError = (message: string) => {
        if (results.errors.length < MAX_ERRORS) {
          results.errors.push(message);
        } else if (results.errors.length === MAX_ERRORS) {
          results.errors.push(`... and more errors (truncated at ${MAX_ERRORS})`);
        }
       };
      
      try {
        // 1. Find matches missing analysis (ALWAYS check full 48h window)
        const missingAnalysis = await getMatchesMissingAnalysis(analysisHoursAhead);
        
        for (const match of missingAnalysis) {
          if (!match.externalId) continue;
          
          try {
            // Check for failed jobs with same match ID and remove them
            // This allows us to retry with new configuration (5 attempts, 30s backoff, null safety)
            const oldJobIds = [
              `analyze-${match.id}`,
              `backfill-analyze-${match.id}`,
            ];
            
            for (const oldJobId of oldJobIds) {
              try {
                const oldJob = await analysisQueue.getJob(oldJobId);
                 if (oldJob && await oldJob.isFailed()) {
                   await oldJob.remove();
                   log.info(`Removed failed job ${oldJobId} for retry`);
                 }
              } catch (err) {
                // Job doesn't exist, that's fine
              }
            }
            
             // Check if job already exists (deterministic ID)
             const jobId = `analyze-${match.id}`;
             const existingJob = await analysisQueue.getJob(jobId);
             
             if (!existingJob) {
               // Create new job with deterministic ID
               await analysisQueue.add(
                 JOB_TYPES.ANALYZE_MATCH,
                 {
                   matchId: match.id,
                   externalId: match.externalId,
                   homeTeam: match.homeTeam,
                   awayTeam: match.awayTeam,
                 },
                 {
                   delay: 1000,
                   jobId,
                 }
               );
               results.analysisTriggered++;
             } else {
               log.debug(`Analysis job already exists for match ${match.id}`);
             }
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              addError(`Analysis ${match.id}: ${error.message}`);
            }
          }
        }

        // Log chain status for debugging - lineups/predictions will be backfilled after analysis completes
        if (results.analysisTriggered > 0) {
          log.info({ analysisTriggered: results.analysisTriggered }, 'Analysis jobs triggered - lineups/predictions will be backfilled on next cycle after analysis completes');
        }

        // 2. Find matches missing odds (has analysis but no odds, next 6h)
        const missingOdds = await getMatchesMissingOdds(6);
        
        for (const match of missingOdds) {
          if (!match.externalId) continue;
          
          try {
            // Check for failed odds jobs and remove them
            const oldOddsJobIds = [
              `refresh-odds-2h-${match.id}`,
              `refresh-odds-95m-${match.id}`,
              `refresh-odds-35m-${match.id}`,
              `refresh-odds-10m-${match.id}`,
              `backfill-odds-${match.id}`,
            ];
            
             for (const oldJobId of oldOddsJobIds) {
               try {
                 const oldJob = await oddsQueue.getJob(oldJobId);
                 if (oldJob && await oldJob.isFailed()) {
                   await oldJob.remove();
                   log.info(`Removed failed odds job ${oldJobId} for retry`);
                 }
              } catch (err) {
                // Job doesn't exist, that's fine
              }
            }
            
             // Check if job already exists (deterministic ID)
             const jobId = `refresh-odds-backfill-${match.id}`;
             const existingJob = await oddsQueue.getJob(jobId);
             
             if (!existingJob) {
               // Create new odds job with deterministic ID
               await oddsQueue.add(
                 JOB_TYPES.REFRESH_ODDS,
                 {
                   matchId: match.id,
                   externalId: match.externalId,
                 },
                 {
                   delay: 1000,
                   jobId,
                 }
               );
               results.oddsTriggered++;
             } else {
               log.debug(`Odds job already exists for match ${match.id}`);
             }
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              addError(`Odds ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 3. Find matches missing lineups (12h window, not 2h)
        const missingLineups = await getMatchesMissingLineups(lineupsHoursAhead);
        
        for (const match of missingLineups) {
          if (!match.externalId) continue;
          
          try {
            // Check for failed lineups jobs and remove them
            const oldLineupsJobIds = [
              `lineups-${match.id}`,
              `backfill-lineups-${match.id}`,
            ];
            
             for (const oldJobId of oldLineupsJobIds) {
               try {
                 const oldJob = await lineupsQueue.getJob(oldJobId);
                 if (oldJob && await oldJob.isFailed()) {
                   await oldJob.remove();
                   log.info(`Removed failed lineups job ${oldJobId} for retry`);
                 }
              } catch (err) {
                // Job doesn't exist, that's fine
              }
            }
            
             // Check if job already exists (deterministic ID)
             const jobId = `lineups-${match.id}`;
             const existingJob = await lineupsQueue.getJob(jobId);
             
             if (!existingJob) {
               // Create new lineups job with deterministic ID
               await lineupsQueue.add(
                 JOB_TYPES.FETCH_LINEUPS,
                 {
                   matchId: match.id,
                   externalId: match.externalId,
                   homeTeam: match.homeTeam,
                   awayTeam: match.awayTeam,
                 },
                 {
                   delay: 1000,
                   jobId,
                 }
               );
               results.lineupsTriggered++;
             } else {
               log.debug(`Lineups job already exists for match ${match.id}`);
             }
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              addError(`Lineups ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 4. Find matches missing predictions (12h window, not 2h)
        const missingPredictions = await getMatchesMissingPredictions(predictionsHoursAhead);
        
        for (const match of missingPredictions) {
          try {
            // Check for failed prediction jobs and remove them
            const oldPredictJobIds = [
              `predict-1-${match.id}`,
              `predict-2-${match.id}`,
              `predict-3-${match.id}`,
              `predict-immediate-${match.id}`,
              `backfill-predict-${match.id}`,
            ];
            
             for (const oldJobId of oldPredictJobIds) {
               try {
                 const oldJob = await predictionsQueue.getJob(oldJobId);
                 if (oldJob && await oldJob.isFailed()) {
                   await oldJob.remove();
                   log.info(`Removed failed prediction job ${oldJobId} for retry`);
                 }
              } catch (err) {
                // Job doesn't exist, that's fine
              }
            }
            
             // Check if job already exists (deterministic ID)
             const jobId = `predict-immediate-${match.id}`;
             const existingJob = await predictionsQueue.getJob(jobId);
             
             if (!existingJob) {
               // Create new prediction job with deterministic ID
               await predictionsQueue.add(
                 JOB_TYPES.PREDICT_MATCH,
                 {
                   matchId: match.id,
                   attempt: 1,
                   skipIfDone: true,
                   force: false,
                 },
                 {
                   delay: 1000,
                   jobId,
                 }
               );
               results.predictionsTriggered++;
             } else {
               log.debug(`Prediction job already exists for match ${match.id}`);
             }
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              addError(`Predict ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 5. Find finished matches with pending predictions (need scoring)
        const needingScoring = await getMatchesNeedingScoring();
        
        for (const match of needingScoring) {
          try {
            // Check for failed settlement jobs and remove them
            const oldSettlementJobIds = [
              `settle-${match.id}`,
              `backfill-settle-${match.id}`,
            ];
            
             for (const oldJobId of oldSettlementJobIds) {
               try {
                 const oldJob = await settlementQueue.getJob(oldJobId);
                 if (oldJob && await oldJob.isFailed()) {
                   await oldJob.remove();
                   log.info(`Removed failed settlement job ${oldJobId} for retry`);
                 }
              } catch (err) {
                // Job doesn't exist, that's fine
              }
            }
            
             // Check if job already exists (deterministic ID)
             const jobId = `settle-${match.id}`;
             const existingJob = await settlementQueue.getJob(jobId);
             
             if (!existingJob) {
               // Create new settlement job with deterministic ID
               await settlementQueue.add(
                 JOB_TYPES.SETTLE_MATCH,
                 {
                   matchId: match.id,
                   homeScore: match.homeScore ?? 0,
                   awayScore: match.awayScore ?? 0,
                   status: match.status,
                 },
                 {
                   delay: 1000,
                   priority: 1, // High priority - settle bets ASAP
                   jobId,
                 }
               );
               results.scoringsTriggered++;
             } else {
               log.debug(`Settlement job already exists for match ${match.id}`);
             }
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              addError(`Settlement ${match.id}: ${error.message}`);
            }
          }
        }
        
        // Log summary
        const total = results.analysisTriggered + results.oddsTriggered + 
                      results.lineupsTriggered + results.predictionsTriggered + results.scoringsTriggered;
        
         if (total > 0 || results.errors.length > 0) {
           log.info({ analysis: results.analysisTriggered, odds: results.oddsTriggered, lineups: results.lineupsTriggered, predictions: results.predictionsTriggered, scorings: results.scoringsTriggered }, `Triggered ${total} jobs`);
           
           if (results.errors.length > 0) {
             log.error({ errors: results.errors }, `${results.errors.length} errors`);
           }
         } else {
           log.info('No missing data found');
         }
        
        return results;
        
       } catch (error: any) {
          log.error({ err: error }, 'Fatal error');
          
          Sentry.captureException(error, {
            level: 'error',
            tags: {
              worker: 'backfill',
            },
            extra: {
              jobId: job.id,
              hoursAhead: job.data.hoursAhead,
              manual: job.data.manual,
            },
          });
          
          throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one backfill job at a time
    }
  );
}
