/**
 * Model Recovery Worker
 * 
 * Checks for auto-disabled models that have been in cooldown long enough
 * and attempts to re-enable them for the next prediction cycle.
 * 
 * Runs every 30 minutes.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import { getAutoDisabledModels, reEnableModel } from '@/lib/db/queries';
import { loggers } from '@/lib/logger/modules';

const COOLDOWN_HOURS = 1; // Re-enable after 1 hour cooldown

export function createModelRecoveryWorker() {
  return new Worker(
    QUEUE_NAMES.MODEL_RECOVERY,
    async (job: Job) => {
      const log = loggers.modelRecoveryWorker.child({ jobId: job.id, jobName: job.name });
      
      try {
        log.info('Checking for models ready to re-enable...');
        
        const disabledModels = await getAutoDisabledModels();
        
        if (disabledModels.length === 0) {
          log.info('No disabled models found');
          return { recovered: 0, checked: 0, failed: 0, errors: [] };
        }
        
        const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
        const now = Date.now();
        let recovered = 0;
        let failed = 0;
        const errors: Array<{ modelId: string; displayName: string; error: string }> = [];
        
        for (const model of disabledModels) {
          const lastFailure = model.lastFailureAt ? new Date(model.lastFailureAt).getTime() : 0;
          const timeSinceFailure = now - lastFailure;
          
          if (timeSinceFailure >= cooldownMs) {
            try {
              // Attempt to re-enable this model
              await reEnableModel(model.id);
              log.info({ modelId: model.id, displayName: model.displayName, disabledMinutes: Math.round(timeSinceFailure / 60000) }, '✓ Re-enabled model');
              recovered++;
            } catch (error) {
              // Isolate failures - continue with other models
              failed++;
              const errorMsg = error instanceof Error ? error.message : String(error);
              errors.push({ modelId: model.id, displayName: model.displayName, error: errorMsg });
              log.warn({ modelId: model.id, displayName: model.displayName, error: errorMsg }, '✗ Failed to re-enable model');
            }
          } else {
            const remainingMin = Math.ceil((cooldownMs - timeSinceFailure) / 60000);
            log.debug({ modelId: model.id, displayName: model.displayName, remainingMinutes: remainingMin }, 'Model still in cooldown');
          }
        }
        
        log.info({ recovered, checked: disabledModels.length, failed }, 'Model recovery complete');
        return { recovered, checked: disabledModels.length, failed, errors };
      } catch (error) {
        // Outer catch for critical errors
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error({ error: errorMsg }, 'Model recovery worker failed');
        throw error; // Re-throw for BullMQ retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  );
}
