/**
 * Queue Setup
 * 
 * Registers repeatable jobs at app startup.
 * Call this once when the app starts (from instrumentation.ts).
 */

import { fixturesQueue, backfillQueue, contentQueue, modelRecoveryQueue, JOB_TYPES } from './index';
import { loggers } from '@/lib/logger/modules';
import { startPeriodicMetricsLogging } from '@/lib/logger/metrics';
import { Queue } from 'bullmq';

const log = loggers.queue;

/**
 * Register a repeatable job, automatically removing old jobs with the same jobId
 * Prevents old cron patterns from persisting when pattern changes
 */
async function registerRepeatableJob(
  queue: Queue,
  jobName: string,
  data: any,
  options: {
    repeat: { pattern: string; tz: string };
    jobId: string;
  }
): Promise<void> {
  try {
    // Get existing repeatable jobs for this queue
    const existingJobs = await queue.getRepeatableJobs();
    
    // Find and remove any jobs with the same jobId (old pattern)
    for (const job of existingJobs) {
      if (job.id === options.jobId) {
        await queue.removeRepeatableByKey(job.key);
        log.info(
          { queue: queue.name, jobId: options.jobId, oldPattern: job.pattern },
          'Removed old repeatable job pattern'
        );
      }
    }
    
    // Add the new repeatable job
    await queue.add(jobName, data, options);
    log.info(
      { queue: queue.name, jobId: options.jobId, pattern: options.repeat.pattern },
      'Registered repeatable job'
    );
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      log.info({ jobId: options.jobId }, 'Job already exists');
    } else {
      log.error({ jobId: options.jobId, error: error.message }, 'Failed to register repeatable job');
      throw error;
    }
  }
}

export async function setupRepeatableJobs(): Promise<void> {
  log.info('Registering repeatable jobs');
  
  // Fetch fixtures every 6 hours (00:00, 06:00, 12:00, 18:00 Berlin time)
  await registerRepeatableJob(
    fixturesQueue,
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
  
  // Backfill missing data every hour
  await registerRepeatableJob(
    backfillQueue,
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
  await registerRepeatableJob(
    contentQueue,
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
  
  // Check for disabled models to re-enable every 30 minutes
  await registerRepeatableJob(
    modelRecoveryQueue,
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
