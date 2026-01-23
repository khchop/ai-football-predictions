/**
 * Worker Job Logging Helpers
 * 
 * Specialized logging for BullMQ job processing.
 */

import type { Job } from 'bullmq';
import pino from 'pino';
import { createLogger } from './index';
import { startTimer, type TimingResult } from './timing';

export interface WorkerLogContext {
  jobId: string;
  jobName: string;
  attemptsMade: number;
  maxAttempts: number;
  [key: string]: unknown;
}

/**
 * Create a logger for a specific job with job context
 */
export function createWorkerJobLogger(
  workerName: string,
  job: Job
): pino.Logger {
  return createLogger(`worker:${workerName}`).child({
    jobId: job.id,
    jobName: job.name,
    attemptsMade: job.attemptsMade,
    queueName: job.queueName,
  });
}

/**
 * Log job start and return timer
 */
export function logJobStart(logger: pino.Logger, data?: Record<string, unknown>): () => TimingResult {
  const stopTimer = startTimer();
  
  logger.info(data, 'Job started');
  
  return stopTimer;
}

/**
 * Log job completion with timing
 */
export function logJobComplete(
  logger: pino.Logger,
  stopTimer: () => TimingResult,
  result?: Record<string, unknown>
): void {
  const { durationMs, durationFormatted } = stopTimer();
  
  logger.info({
    ...result,
    durationMs,
    duration: durationFormatted,
  }, 'Job completed');
}

/**
 * Log job failure with timing and error
 */
export function logJobFailed(
  logger: pino.Logger,
  stopTimer: () => TimingResult,
  error: Error
): void {
  const { durationMs, durationFormatted } = stopTimer();
  
  logger.error({
    durationMs,
    duration: durationFormatted,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  }, 'Job failed');
}
