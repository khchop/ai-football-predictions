/**
 * Queue Setup
 * 
 * Registers repeatable jobs at app startup.
 * Call this once when the app starts (from instrumentation.ts).
 */

import { fixturesQueue, backfillQueue, contentQueue, modelRecoveryQueue, JOB_TYPES } from './index';

export async function setupRepeatableJobs(): Promise<void> {
  console.log('[Queue Setup] Registering repeatable jobs...');
  
  try {
    // Fetch fixtures every 6 hours (00:00, 06:00, 12:00, 18:00 Berlin time)
    await fixturesQueue.add(
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
  
  try {
    // Backfill missing data every hour
    await backfillQueue.add(
      JOB_TYPES.BACKFILL_MISSING,
      { manual: false, hoursAhead: 12 },
      {
        repeat: {
          pattern: '5 * * * *', // Every hour at :05 (offset from fixtures at :00)
          tz: 'Europe/Berlin',
        },
        jobId: 'backfill-missing-repeatable',
      }
    );
    console.log('[Queue Setup] ✓ Registered: backfill-missing (every hour, Berlin TZ)');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('[Queue Setup] backfill-missing already registered');
    } else {
      console.error('[Queue Setup] Failed to register backfill-missing:', error);
      throw error;
    }
  }
  
  // One-time immediate backfill on startup
  try {
    await backfillQueue.add(
      JOB_TYPES.BACKFILL_MISSING,
      { manual: false, hoursAhead: 24 }, // Look further ahead on startup
      {
        delay: 5000, // 5 second delay to let workers start
        jobId: `backfill-startup-${Date.now()}`, // Unique ID each startup
      }
    );
    console.log('[Queue Setup] ✓ Scheduled: one-time startup backfill (runs in 5s)');
  } catch (error: any) {
    console.error('[Queue Setup] Failed to schedule startup backfill:', error);
  }
  
  // Scan for matches needing previews every hour
  try {
    await contentQueue.add(
      'scan-matches',
      { type: 'scan_matches', data: {} },
      {
        repeat: {
          pattern: '10 * * * *', // Every hour at :10 (after backfill at :05)
          tz: 'Europe/Berlin',
        },
        jobId: 'scan-matches-repeatable',
      }
    );
    console.log('[Queue Setup] ✓ Registered: scan-matches (every hour, Berlin TZ)');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('[Queue Setup] scan-matches already registered');
    } else {
      console.error('[Queue Setup] Failed to register scan-matches:', error);
      throw error;
    }
  }
  
  // Check for disabled models to re-enable every 30 minutes
  try {
    await modelRecoveryQueue.add(
      JOB_TYPES.CHECK_MODEL_HEALTH,
      {},
      {
        repeat: {
          pattern: '15,45 * * * *', // Every 30 minutes at :15 and :45
          tz: 'Europe/Berlin',
        },
        jobId: 'model-recovery-repeatable',
      }
    );
    console.log('[Queue Setup] ✓ Registered: model-recovery (every 30 min, Berlin TZ)');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('[Queue Setup] model-recovery already registered');
    } else {
      console.error('[Queue Setup] Failed to register model-recovery:', error);
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
  
  // Remove from fixtures queue
  const fixturesRepeatableJobs = await fixturesQueue.getRepeatableJobs();
  for (const job of fixturesRepeatableJobs) {
    await fixturesQueue.removeRepeatableByKey(job.key);
    console.log(`[Queue Setup] Removed from fixtures-queue: ${job.name} (${job.pattern})`);
  }
  
  // Remove from backfill queue
  const backfillRepeatableJobs = await backfillQueue.getRepeatableJobs();
  for (const job of backfillRepeatableJobs) {
    await backfillQueue.removeRepeatableByKey(job.key);
    console.log(`[Queue Setup] Removed from backfill-queue: ${job.name} (${job.pattern})`);
  }
  
  // Remove from content queue
  const contentRepeatableJobs = await contentQueue.getRepeatableJobs();
  for (const job of contentRepeatableJobs) {
    await contentQueue.removeRepeatableByKey(job.key);
    console.log(`[Queue Setup] Removed from content-queue: ${job.name} (${job.pattern})`);
  }
  
  // Remove from model recovery queue
  const modelRecoveryRepeatableJobs = await modelRecoveryQueue.getRepeatableJobs();
  for (const job of modelRecoveryRepeatableJobs) {
    await modelRecoveryQueue.removeRepeatableByKey(job.key);
    console.log(`[Queue Setup] Removed from model-recovery-queue: ${job.name} (${job.pattern})`);
  }
  
  console.log('[Queue Setup] All repeatable jobs removed');
}
