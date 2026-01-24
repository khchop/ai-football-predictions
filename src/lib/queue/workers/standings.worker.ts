/**
 * Standings Worker
 * 
 * Updates league standings for all tracked competitions.
 * Runs once daily to refresh standings data from API-Football.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { UpdateStandingsPayload } from '../types';
import { updateStandingsIfStale } from '@/lib/football/standings';
import { loggers } from '@/lib/logger/modules';

export function createStandingsWorker() {
  return new Worker<UpdateStandingsPayload>(
    QUEUE_NAMES.STANDINGS,
    async (job: Job<UpdateStandingsPayload>) => {
      const { maxAgeHours = 24 } = job.data;
      const log = loggers.standingsWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info({ maxAgeHours }, 'Starting standings update...');
      
      try {
        // Update standings that are older than maxAgeHours
        const updated = await updateStandingsIfStale(maxAgeHours);
        
        log.info({ updated }, `✓ Standings update complete`);
        
        return {
          success: true,
          updated,
        };
      } catch (error: any) {
        log.error({ err: error }, `Error updating standings`);
        Sentry.captureException(error);
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only run one standings update at a time
    }
  );
}
