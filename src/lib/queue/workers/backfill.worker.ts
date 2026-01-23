/**
 * Backfill Worker
 * 
 * Periodically checks for matches with missing data and triggers
 * the appropriate jobs to fill in the gaps.
 * 
 * Runs every hour via repeatable job.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES, JOB_TYPES, analysisQueue, oddsQueue, lineupsQueue, predictionsQueue, settlementQueue } from '../index';
import type { BackfillMissingPayload } from '../types';
import { 
  getMatchesMissingAnalysis,
  getMatchesMissingOdds,
  getMatchesMissingLineups,
  getMatchesMissingPredictions,
  getMatchesNeedingScoring,
} from '@/lib/db/queries';
import { loggers } from '@/lib/logger/modules';

export function createBackfillWorker() {
  return new Worker<BackfillMissingPayload>(
    QUEUE_NAMES.BACKFILL,
    async (job: Job<BackfillMissingPayload>) => {
      const { hoursAhead = 12 } = job.data;
      const log = loggers.backfillWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Checking for matches with missing data (next ${hoursAhead}h)...`);
      
      const results = {
        analysisTriggered: 0,
        oddsTriggered: 0,
        lineupsTriggered: 0,
        predictionsTriggered: 0,
        scoringsTriggered: 0,
        errors: [] as string[],
      };
      
      try {
        // 1. Find matches missing analysis (check full range)
        const missingAnalysis = await getMatchesMissingAnalysis(hoursAhead);
        
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
            
            // Create new job with timestamp to avoid ID collision
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
                jobId: `backfill-analyze-${match.id}-${Date.now()}`,
              }
            );
            results.analysisTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Analysis ${match.id}: ${error.message}`);
            }
          }
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
            
            // Create new odds job with timestamp
            await oddsQueue.add(
              JOB_TYPES.REFRESH_ODDS,
              {
                matchId: match.id,
                externalId: match.externalId,
              },
              {
                delay: 1000,
                jobId: `backfill-odds-${match.id}-${Date.now()}`,
              }
            );
            results.oddsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Odds ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 3. Find matches missing lineups (next 2h, has analysis)
        const missingLineups = await getMatchesMissingLineups(2);
        
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
            
            // Create new lineups job with timestamp
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
                jobId: `backfill-lineups-${match.id}-${Date.now()}`,
              }
            );
            results.lineupsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Lineups ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 4. Find matches missing predictions (next 2h, has lineups, no predictions)
        const missingPredictions = await getMatchesMissingPredictions(2);
        
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
            
            // Create new prediction job with timestamp
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
                jobId: `backfill-predict-${match.id}-${Date.now()}`,
              }
            );
            results.predictionsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Predict ${match.id}: ${error.message}`);
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
            
            // Create new settlement job with timestamp
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
                jobId: `backfill-settle-${match.id}-${Date.now()}`,
              }
            );
            results.scoringsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Settlement ${match.id}: ${error.message}`);
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
         throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one backfill job at a time
    }
  );
}
