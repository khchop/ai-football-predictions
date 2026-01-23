/**
 * Queue Setup
 * 
 * Registers repeatable jobs at app startup.
 * Call this once when the app starts (from instrumentation.ts).
 */

import { fixturesQueue, backfillQueue, contentQueue, modelRecoveryQueue, JOB_TYPES } from './index';
import { loggers } from '@/lib/logger/modules';
import { startPeriodicMetricsLogging } from '@/lib/logger/metrics';

const log = loggers.queue;

export async function setupRepeatableJobs(): Promise<void> {
  log.info('Registering repeatable jobs');
  
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
    
    log.info({ schedule: 'every 6h', timezone: 'Europe/Berlin' }, 'Registered: fetch-fixtures');
  } catch (error: any) {
    // If job already exists, that's fine (happens on hot reload)
    if (error.message?.includes('already exists')) {
      log.info('fetch-fixtures already registered');
    } else {
      log.error({ error: error.message }, 'Failed to register fetch-fixtures');
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
    log.info({ schedule: 'every hour', timezone: 'Europe/Berlin' }, 'Registered: backfill-missing');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      log.info('backfill-missing already registered');
    } else {
      log.error({ error: error.message }, 'Failed to register backfill-missing');
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
    log.info({ delay: '5s' }, 'Scheduled: one-time startup backfill');
  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to schedule startup backfill');
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
    log.info({ schedule: 'every hour', timezone: 'Europe/Berlin' }, 'Registered: scan-matches');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      log.info('scan-matches already registered');
    } else {
      log.error({ error: error.message }, 'Failed to register scan-matches');
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
    log.info({ schedule: 'every 30 min', timezone: 'Europe/Berlin' }, 'Registered: model-recovery');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      log.info('model-recovery already registered');
    } else {
      log.error({ error: error.message }, 'Failed to register model-recovery');
      throw error;
    }
  }
  
  log.info('All repeatable jobs registered');
  startPeriodicMetricsLogging();
}

/**
 * Remove all repeatable jobs (for cleanup/testing)
 */
export async function removeRepeatableJobs(): Promise<void> {
  log.info('Removing repeatable jobs');
  
  // Remove from fixtures queue
  const fixturesRepeatableJobs = await fixturesQueue.getRepeatableJobs();
  for (const job of fixturesRepeatableJobs) {
    await fixturesQueue.removeRepeatableByKey(job.key);
    log.info({ queue: 'fixtures-queue', jobName: job.name, pattern: job.pattern }, 'Removed repeatable job');
  }
  
  // Remove from backfill queue
  const backfillRepeatableJobs = await backfillQueue.getRepeatableJobs();
  for (const job of backfillRepeatableJobs) {
    await backfillQueue.removeRepeatableByKey(job.key);
    log.info({ queue: 'backfill-queue', jobName: job.name, pattern: job.pattern }, 'Removed repeatable job');
  }
  
  // Remove from content queue
  const contentRepeatableJobs = await contentQueue.getRepeatableJobs();
  for (const job of contentRepeatableJobs) {
    await contentQueue.removeRepeatableByKey(job.key);
    log.info({ queue: 'content-queue', jobName: job.name, pattern: job.pattern }, 'Removed repeatable job');
  }
  
  // Remove from model recovery queue
  const modelRecoveryRepeatableJobs = await modelRecoveryQueue.getRepeatableJobs();
  for (const job of modelRecoveryRepeatableJobs) {
    await modelRecoveryQueue.removeRepeatableByKey(job.key);
    log.info({ queue: 'model-recovery-queue', jobName: job.name, pattern: job.pattern }, 'Removed repeatable job');
  }
  
  log.info('All repeatable jobs removed');
}
