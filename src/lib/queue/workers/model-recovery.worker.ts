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

const COOLDOWN_HOURS = 1; // Re-enable after 1 hour cooldown

export function createModelRecoveryWorker() {
  return new Worker(
    QUEUE_NAMES.MODEL_RECOVERY,
    async (job: Job) => {
      console.log('[Model Recovery] Checking for models ready to re-enable...');
      
      const disabledModels = await getAutoDisabledModels();
      
      if (disabledModels.length === 0) {
        console.log('[Model Recovery] No disabled models found');
        return { recovered: 0, checked: 0 };
      }
      
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      const now = Date.now();
      let recovered = 0;
      
      for (const model of disabledModels) {
        const lastFailure = model.lastFailureAt ? new Date(model.lastFailureAt).getTime() : 0;
        const timeSinceFailure = now - lastFailure;
        
        if (timeSinceFailure >= cooldownMs) {
          await reEnableModel(model.id);
          console.log(`[Model Recovery] ✓ Re-enabled ${model.displayName} (was disabled for ${Math.round(timeSinceFailure / 60000)} min)`);
          recovered++;
        } else {
          const remainingMin = Math.ceil((cooldownMs - timeSinceFailure) / 60000);
          console.log(`[Model Recovery] ${model.displayName}: ${remainingMin} min until re-enable`);
        }
      }
      
      console.log(`[Model Recovery] Complete: ${recovered}/${disabledModels.length} models re-enabled`);
      return { recovered, checked: disabledModels.length };
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  );
}
