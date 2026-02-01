/**
 * Model Recovery Worker
 * 
 * Checks for auto-disabled models that have been in cooldown long enough
 * and attempts to re-enable them for the next prediction cycle.
 * 
 * Runs every 30 minutes.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import { recoverDisabledModels } from '@/lib/db/queries';
import { loggers } from '@/lib/logger/modules';

/**
 * Model Recovery Worker
 *
 * Checks for auto-disabled models that have been in cooldown long enough (1 hour)
 * and re-enables them with partial failure count reset (consecutiveFailures=2).
 *
 * This requires 3 more model-specific failures before re-disable (threshold is 5).
 *
 * Runs every 30 minutes.
 */
export function createModelRecoveryWorker() {
  return new Worker(
    QUEUE_NAMES.MODEL_RECOVERY,
    async (job: Job) => {
      const log = loggers.modelRecoveryWorker.child({ jobId: job.id, jobName: job.name });

      try {
        log.info('Starting model recovery check');

        const recoveredCount = await recoverDisabledModels();

        log.info({ recoveredCount }, 'Model recovery check completed');
        return { recoveredCount };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error({ error: errorMsg }, 'Model recovery check failed');

        Sentry.captureException(error, {
          level: 'error',
          tags: {
            worker: 'model-recovery',
          },
          extra: {
            jobId: job.id,
            errorMessage: errorMsg,
          },
        });

        throw error; // Re-throw for BullMQ retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  );
}
