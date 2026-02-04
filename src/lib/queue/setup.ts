/**
 * Queue Setup
 * 
 * Registers repeatable jobs at app startup.
 * Call this once when the app starts (from instrumentation.ts).
 */

import { fixturesQueue, backfillQueue, contentQueue, modelRecoveryQueue, standingsQueue, JOB_TYPES } from './index';
import { loggers } from '@/lib/logger/modules';
import { startPeriodicMetricsLogging } from '@/lib/logger/metrics';
import { Queue } from 'bullmq';

const log = loggers.queue;

// ============================================================================
// CRON PATTERN VALIDATION
// ============================================================================

/**
 * Validate cron pattern format at startup
 * Prevents silent failures from invalid cron patterns
 */
function validateCronPattern(pattern: string, jobName: string): void {
  const parts = pattern.trim().split(/\s+/);
  
  // Standard cron format: minute hour day month dayOfWeek
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron pattern "${pattern}" for job "${jobName}": ` +
      `Expected 5 fields (minute hour day month dayOfWeek), got ${parts.length}`
    );
  }
  
  // Validate each field
  const FIELD_RANGES = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12 },
    { name: 'dayOfWeek', min: 0, max: 6 },
  ];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const field = FIELD_RANGES[i];
    
    // Allow wildcards and question marks
    if (part === '*' || part === '?') {
      continue;
    }
    
    // Check for ranges (e.g., "5-10")
    if (part.includes('-') && !part.startsWith('-')) {
      const [start, end] = part.split('-');
      if (!isValidCronNumber(start, field.min, field.max) || !isValidCronNumber(end, field.min, field.max)) {
        throw new Error(
          `Invalid ${field.name} range "${part}" in cron pattern "${pattern}": ` +
          `Expected values between ${field.min}-${field.max}`
        );
      }
      continue;
    }
    
    // Check for lists (e.g., "1,2,3")
    if (part.includes(',')) {
      for (const num of part.split(',')) {
        if (!isValidCronNumber(num, field.min, field.max)) {
          throw new Error(
            `Invalid ${field.name} value "${num}" in cron pattern "${pattern}": ` +
            `Expected values between ${field.min}-${field.max}`
          );
        }
      }
      continue;
    }
    
    // Check for step values (e.g., "*/5")
    if (part.includes('/')) {
      const [expr, step] = part.split('/');
      if (!isValidCronNumber(step, 1, field.max)) {
        throw new Error(
          `Invalid step value "${step}" in cron pattern "${pattern}": ` +
          `Expected positive number, got "${step}"`
        );
      }
      continue;
    }
    
    // Simple number
    if (!isValidCronNumber(part, field.min, field.max)) {
      throw new Error(
        `Invalid ${field.name} value "${part}" in cron pattern "${pattern}": ` +
        `Expected values between ${field.min}-${field.max}`
      );
    }
  }
}

function isValidCronNumber(str: string, min: number, max: number): boolean {
  const num = parseInt(str, 10);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Register a repeatable job, automatically removing old jobs with the same jobId
 * Prevents old cron patterns from persisting when pattern changes
 * Validates cron pattern before registering
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
    // Validate cron pattern before registering (fail fast on invalid patterns)
    validateCronPattern(options.repeat.pattern, `${queue.name}:${options.jobId}`);
    
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
  
  // Fetch fixtures every 3 hours to ensure new matches are discovered early
  await registerRepeatableJob(
    fixturesQueue,
    JOB_TYPES.FETCH_FIXTURES,
    { manual: false },
    {
      repeat: {
        pattern: '0 0,3,6,9,12,15,18,21 * * *', // CRON: Every 3 hours at :00
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
  
  // Update league standings once daily at 4:00 AM
  await registerRepeatableJob(
    standingsQueue,
    JOB_TYPES.UPDATE_STANDINGS,
    { maxAgeHours: 24 },
    {
      repeat: {
        pattern: '0 4 * * *', // Daily at 4:00 AM (after most matches have finished)
        tz: 'Europe/Berlin',
      },
      jobId: 'update-standings-repeatable',
    }
  );
  
  // Check for stuck matches every 2 minutes
  // Recovers matches that should be live but are stuck in 'scheduled' status
  await registerRepeatableJob(
    backfillQueue,
    JOB_TYPES.BACKFILL_MISSING,
    { manual: false, type: 'stuck-matches' },
    {
      repeat: {
        pattern: '*/2 * * * *', // Every 2 minutes
        tz: 'Europe/Berlin',
      },
      jobId: 'check-stuck-matches-repeatable',
    }
  );
  
   // One-time immediate backfill on startup (use fixed ID to prevent accumulation)
   const STARTUP_BACKFILL_JOB_ID = 'backfill-startup-once';
   try {
     // Clean up any existing startup backfill job before adding new one
     try {
       const existingJob = await backfillQueue.getJob(STARTUP_BACKFILL_JOB_ID);
       if (existingJob) {
         await existingJob.remove();
         log.debug({}, 'Removed old startup backfill job');
       }
     } catch (error) {
       // Job doesn't exist, that's fine
     }
     
     await backfillQueue.add(
       JOB_TYPES.BACKFILL_MISSING,
       { manual: false, hoursAhead: 24 }, // Look further ahead on startup
       {
         delay: 5000, // 5 second delay to let workers start
         jobId: STARTUP_BACKFILL_JOB_ID, // Fixed ID prevents accumulation on restart
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
   
   // Scan for matches missing content sections (backfill) every hour at :15
   await registerRepeatableJob(
     contentQueue,
     'scan-match-content',
     { type: 'scan_match_content', data: {} },
     {
       repeat: {
         pattern: '15 * * * *', // Every hour at :15 (after scan-matches at :10)
         tz: 'Europe/Berlin',
       },
       jobId: 'scan-match-content-repeatable',
     }
   );
   
   // One-time immediate content backfill on startup (after 15s delay)
   const STARTUP_CONTENT_BACKFILL_JOB_ID = 'content-backfill-startup-once';
   try {
     // Clean up any existing startup content backfill job
     try {
       const existingJob = await contentQueue.getJob(STARTUP_CONTENT_BACKFILL_JOB_ID);
       if (existingJob) {
         await existingJob.remove();
         log.debug({}, 'Removed old startup content backfill job');
       }
     } catch (error) {
       // Job doesn't exist, that's fine
     }
     
     await contentQueue.add(
       'scan-match-content',
       { type: 'scan_match_content', data: {} },
       {
         delay: 15000, // 15 second delay to let workers start
         jobId: STARTUP_CONTENT_BACKFILL_JOB_ID, // Fixed ID prevents accumulation
       }
     );
     log.info({ delay: '15s' }, 'Scheduled: one-time startup content backfill');
   } catch (error: any) {
     log.error({ error: error.message }, 'Failed to schedule startup content backfill');
   }
   
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
   
   // Generate league roundups every Monday at 08:00 (after weekend matches finish)
   await registerRepeatableJob(
     contentQueue,
     'scan-league-roundups',
     { type: 'scan_league_roundups', data: {} },
     {
       repeat: {
         pattern: '0 8 * * 1', // Every Monday at 08:00
         tz: 'Europe/Berlin',
       },
       jobId: 'league-roundups-weekly',
     }
   );
   
   // Generate monthly model performance report on the 1st of every month at 09:00
   await registerRepeatableJob(
     contentQueue,
     'generate-model-report',
     {
       type: 'model_report',
       data: {
         period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
       }
     },
     {
       repeat: {
         pattern: '0 9 1 * *', // 1st of every month at 09:00
         tz: 'Europe/Berlin',
       },
       jobId: 'model-report-monthly',
     }
   );

   // ============================================================================
   // MONITORING JOBS
   // ============================================================================

   // Worker health check every 5 minutes
   // Detects dead workers and stalled jobs before jobs pile up
   await registerRepeatableJob(
     contentQueue,
     'worker-health-check',
     {
       type: 'worker_health_check',
       data: { queueName: 'content-queue' }
     },
     {
       repeat: {
         pattern: '*/5 * * * *', // Every 5 minutes
         tz: 'Europe/Berlin',
       },
       jobId: 'worker-health-check-repeatable',
     }
   );

   // Content completeness check every hour at :45
   // Detects finished matches missing content before users notice gaps
   await registerRepeatableJob(
     contentQueue,
     'content-completeness-check',
     {
       type: 'content_completeness_check',
       data: {}
     },
     {
       repeat: {
         pattern: '45 * * * *', // Every hour at :45 (after other scans at :10, :15)
         tz: 'Europe/Berlin',
       },
       jobId: 'content-completeness-check-repeatable',
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
  
  // Remove from standings queue
  const standingsRepeatableJobs = await standingsQueue.getRepeatableJobs();
  for (const job of standingsRepeatableJobs) {
    await standingsQueue.removeRepeatableByKey(job.key);
    log.info({ queue: 'standings-queue', jobName: job.name, pattern: job.pattern }, 'Removed repeatable job');
  }
  
  log.info('All repeatable jobs removed');
}
