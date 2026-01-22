/**
 * Queue Setup
 * 
 * Registers repeatable jobs at app startup.
 * Call this once when the app starts (from instrumentation.ts).
 */

import { matchQueue, JOB_TYPES } from './index';

export async function setupRepeatableJobs(): Promise<void> {
  console.log('[Queue Setup] Registering repeatable jobs...');
  
  try {
    // Fetch fixtures every 6 hours (00:00, 06:00, 12:00, 18:00 Berlin time)
    await matchQueue.add(
      JOB_TYPES.FETCH_FIXTURES,
      { manual: false },
      {
        repeat: {
          pattern: '0 0,6,12,18 * * *', // CRON: Every 6 hours at :00
          tz: 'Europe/Berlin',
        },
        jobId: 'fetch-fixtures-repeatable',
      }
    );
    
    console.log('[Queue Setup] ✓ Registered: fetch-fixtures (every 6h, Berlin TZ)');
  } catch (error: any) {
    // If job already exists, that's fine (happens on hot reload)
    if (error.message?.includes('already exists')) {
      console.log('[Queue Setup] fetch-fixtures already registered');
    } else {
      console.error('[Queue Setup] Failed to register fetch-fixtures:', error);
      throw error;
    }
  }
  
  console.log('[Queue Setup] All repeatable jobs registered');
}

/**
 * Remove all repeatable jobs (for cleanup/testing)
 */
export async function removeRepeatableJobs(): Promise<void> {
  console.log('[Queue Setup] Removing repeatable jobs...');
  
  const repeatableJobs = await matchQueue.getRepeatableJobs();
  
  for (const job of repeatableJobs) {
    await matchQueue.removeRepeatableByKey(job.key);
    console.log(`[Queue Setup] Removed: ${job.name} (${job.pattern})`);
  }
  
  console.log('[Queue Setup] All repeatable jobs removed');
}
