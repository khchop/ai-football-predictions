/**
 * Workers Index
 * 
 * Starts all workers for the event-driven betting system.
 * Call startAllWorkers() from instrumentation.ts.
 */

import { Worker } from 'bullmq';
import { createFixturesWorker } from './fixtures.worker';
import { createAnalysisWorker } from './analysis.worker';
import { createLineupsWorker } from './lineups.worker';
import { createPredictionsWorker } from './predictions.worker';
import { createLiveScoreWorker } from './live-score.worker';
import { createSettlementWorker } from './settlement.worker';
import { createBackfillWorker } from './backfill.worker';

let workers: Worker[] = [];

/**
 * Attach event listeners to a worker for debugging
 */
function attachWorkerEvents(worker: Worker, name: string): void {
  worker.on('ready', () => {
    console.log(`[Worker:${name}] ✓ Ready and listening for jobs`);
  });

  worker.on('active', (job) => {
    console.log(`[Worker:${name}] ▶ Processing job: ${job.name} (id: ${job.id})`);
  });

  worker.on('completed', (job, result) => {
    const resultStr = typeof result === 'object' ? JSON.stringify(result) : result;
    console.log(`[Worker:${name}] ✓ Completed job: ${job.name} (id: ${job.id}) =>`, resultStr);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] ✗ Failed job: ${job?.name} (id: ${job?.id}):`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${name}] ⚠ Error:`, err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker:${name}] ⚠ Stalled job: ${jobId}`);
  });
}

export function startAllWorkers(): Worker[] {
  if (workers.length > 0) {
    console.log('[Workers] Workers already started');
    return workers;
  }

  console.log('[Workers] Starting all workers...');

  // Create workers with names for event logging
  const workerConfigs = [
    { name: 'fixtures', create: createFixturesWorker },
    { name: 'analysis', create: createAnalysisWorker },
    { name: 'lineups', create: createLineupsWorker },
    { name: 'predictions', create: createPredictionsWorker },
    { name: 'live-score', create: createLiveScoreWorker },
    { name: 'settlement', create: createSettlementWorker },
    { name: 'backfill', create: createBackfillWorker },
  ];

  workers = workerConfigs.map(({ name, create }) => {
    const worker = create();
    attachWorkerEvents(worker, name);
    console.log(`[Workers] Created worker: ${name}`);
    return worker;
  });

  console.log(`[Workers] ✓ Created ${workers.length} workers, waiting for ready events...`);

  // Handle graceful shutdown
  const cleanup = async () => {
    console.log('[Workers] Shutting down workers...');
    await Promise.all(workers.map(w => w.close()));
    console.log('[Workers] All workers shut down');
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
  console.log('[Workers] Stopping all workers...');
  await Promise.all(workers.map(w => w.close()));
  workers = [];
  console.log('[Workers] All workers stopped');
}
