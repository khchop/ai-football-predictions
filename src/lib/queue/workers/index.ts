/**
 * Workers Index
 * 
 * Starts all workers for the predictions system with Kicktipp Quota Scoring.
 * Call startAllWorkers() from instrumentation.ts.
 */

import { Worker } from 'bullmq';
import { createFixturesWorker } from './fixtures.worker';
import { createAnalysisWorker } from './analysis.worker';
import { createLineupsWorker } from './lineups.worker';
import { createOddsWorker } from './odds.worker';
import { createPredictionsWorker } from './predictions.worker';
import { createLiveScoreWorker } from './live-score.worker';
import { createScoringWorker } from './scoring.worker';
import { createBackfillWorker } from './backfill.worker';
import { createContentWorker } from './content.worker';
import { createModelRecoveryWorker } from './model-recovery.worker';
import { addToDeadLetterQueue } from '../dead-letter';
import { loggers } from '@/lib/logger/modules';

let workers: Worker[] = [];

/**
 * Attach event listeners to a worker for debugging
 */
function attachWorkerEvents(worker: Worker, name: string): void {
  const log = loggers.workers.child({ worker: name });
  
  worker.on('ready', () => {
    log.info(`✓ Ready and listening for jobs`);
  });

  worker.on('active', (job) => {
    log.info({ jobId: job.id, jobName: job.name }, `▶ Processing job`);
  });

  worker.on('completed', (job, result) => {
    const resultStr = typeof result === 'object' ? JSON.stringify(result) : result;
    log.info({ jobId: job.id, jobName: job.name, result: resultStr }, `✓ Completed job`);
  });

   worker.on('failed', (job, err) => {
     log.error({ jobId: job?.id, jobName: job?.name, err }, `✗ Failed job`);
     
     // If job has exhausted all retry attempts, add to DLQ
     if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
       log.error({ jobId: job.id }, `Job exhausted all retries, adding to DLQ`);
       
       // Handle async DLQ addition with proper error handling
       addToDeadLetterQueue(job, err).catch((dlqError) => {
         log.error({ jobId: job.id, err: dlqError }, `Failed to add job to DLQ`);
       });
     }
   });

  worker.on('error', (err) => {
    log.error({ err }, `⚠ Error`);
  });

  worker.on('stalled', (jobId) => {
    log.warn({ jobId }, `⚠ Stalled job`);
  });
}

export function startAllWorkers(): Worker[] {
  const log = loggers.workers;
  
  if (workers.length > 0) {
    log.info('Workers already started');
    return workers;
  }

  log.info('Starting all workers...');

  // Create workers with names for event logging
  const workerConfigs = [
    { name: 'fixtures', create: createFixturesWorker },
    { name: 'analysis', create: createAnalysisWorker },
    { name: 'lineups', create: createLineupsWorker },
    { name: 'odds', create: createOddsWorker },
    { name: 'predictions', create: createPredictionsWorker },
    { name: 'live-score', create: createLiveScoreWorker },
    { name: 'scoring', create: createScoringWorker },
    { name: 'backfill', create: createBackfillWorker },
    { name: 'content', create: createContentWorker },
    { name: 'model-recovery', create: createModelRecoveryWorker },
  ];

  workers = workerConfigs.map(({ name, create }) => {
    const worker = create();
    attachWorkerEvents(worker, name);
    log.info({ worker: name }, `Created worker`);
    return worker;
  });

  log.info({ count: workers.length }, `✓ Created workers, waiting for ready events...`);

  // Handle graceful shutdown
  const cleanup = async () => {
    log.info('Shutting down workers...');
    await Promise.all(workers.map(w => w.close()));
    log.info('All workers shut down');
    workers = [];
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return workers;
}

export function getWorkers(): Worker[] {
  return workers;
}

export async function stopAllWorkers(): Promise<void> {
  const log = loggers.workers;
  log.info('Stopping all workers...');
  await Promise.all(workers.map(w => w.close()));
  workers = [];
  log.info('All workers stopped');
}
