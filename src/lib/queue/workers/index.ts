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

export function startAllWorkers(): Worker[] {
  if (workers.length > 0) {
    console.log('[Workers] Workers already started');
    return workers;
  }

  console.log('[Workers] Starting all workers...');

  workers = [
    createFixturesWorker(),
    createAnalysisWorker(),
    createLineupsWorker(),
    createPredictionsWorker(),
    createLiveScoreWorker(),
    createSettlementWorker(),
    createBackfillWorker(),
  ];

  console.log(`[Workers] ✓ Started ${workers.length} workers`);

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
