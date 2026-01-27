/**
 * Stats Worker
 * 
 * Processes stats calculation jobs:
 * - Calculates points for predictions after match completion
 * - Refreshes materialized views for leaderboards and standings
 * 
 * Triggered by match completion events via scoring worker.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import { STATS_JOB_IDS } from '../jobs/calculate-stats';
import { handleCalculatePoints, handleRefreshViews } from '../jobs/calculate-stats';
import { enqueueViewRefresh } from '../jobs/calculate-stats';
import { loggers } from '@/lib/logger/modules';

export function createStatsWorker() {
  return new Worker(
    QUEUE_NAMES.STATS,
    async (job: Job) => {
      const log = loggers.statsWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info('Processing stats job');
      
      try {
        switch (job.name) {
          case STATS_JOB_IDS.calculatePoints: {
            const { matchId } = job.data;
            const result = await handleCalculatePoints(matchId);
            
            if (result.success && result.pointsCalculated !== undefined) {
              log.info({ matchId, pointsCalculated: result.pointsCalculated }, 'Points calculation successful');
              
              await enqueueViewRefresh('all', { delay: 1000 });
              
              return {
                success: true,
                matchId,
                pointsCalculated: result.pointsCalculated,
              };
            } else {
              log.warn({ matchId, error: result.error }, 'Points calculation skipped or failed');
              
              if (result.error) {
                throw new Error(result.error);
              }
              
              return { success: false, matchId, skipped: true };
            }
          }
          
          case STATS_JOB_IDS.refreshViews: {
            const { scope } = job.data;
            const result = await handleRefreshViews(scope);
            
            if (result.success) {
              log.info({ scope, viewsRefreshed: result.viewsRefreshed }, 'View refresh successful');
              
              return {
                success: true,
                scope,
                viewsRefreshed: result.viewsRefreshed,
              };
            } else {
              log.warn({ scope, error: result.error }, 'View refresh failed');
              throw new Error(result.error);
            }
          }
          
          default:
            log.warn({ jobName: job.name }, 'Unknown job type');
            return { success: false, error: `Unknown job type: ${job.name}` };
        }
      } catch (error: any) {
        log.error({ err: error }, 'Stats job failed');
        
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            worker: 'stats',
            jobId: job.id,
            jobName: job.name,
          },
          extra: {
            matchId: job.data?.matchId,
            scope: job.data?.scope,
          },
        });
        
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );
}
