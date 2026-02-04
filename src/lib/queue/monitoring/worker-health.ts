/**
 * Worker Health Monitoring
 *
 * Checks worker health using BullMQ's getWorkers() API and stalled job detection.
 * Alerts via Sentry when workers are unhealthy.
 */

import * as Sentry from '@sentry/nextjs';
import { loggers } from '@/lib/logger/modules';
import { getQueue, QUEUE_NAMES } from '../index';

export interface WorkerHealthStatus {
  queueName: string;
  workerCount: number;
  lastCheckAt: number;
  isHealthy: boolean;
  stalledJobCount: number;
  activeJobCount: number;
}

/**
 * Check worker health for a specific queue
 *
 * Health check is unhealthy if:
 * - No workers connected AND there are stalled jobs
 * - We allow 0 workers if queue is idle (no stalled jobs)
 *
 * @param queueName - The queue to check (e.g., QUEUE_NAMES.CONTENT)
 * @returns WorkerHealthStatus with health metrics
 */
export async function checkWorkerHealth(queueName: string): Promise<WorkerHealthStatus> {
  const queue = getQueue(queueName);
  const log = loggers.workers.child({ queueName });

  try {
    // Get connected workers
    const workers = await queue.getWorkers();

    // Get active jobs to check for stalled
    const activeJobs = await queue.getJobs(['active'], 0, 100);

    // Jobs active for > 5 minutes may be stalled (lockDuration is 2min for content)
    const stalledThresholdMs = 5 * 60 * 1000;
    const now = Date.now();
    const stalledJobs = activeJobs.filter((job) => {
      const processedOn = job.processedOn;
      return processedOn && now - processedOn > stalledThresholdMs;
    });

    // Health check logic:
    // - Unhealthy if no workers AND stalled jobs exist
    // - Healthy if workers exist OR no stalled jobs (idle queue is OK)
    const isHealthy = workers.length > 0 || stalledJobs.length === 0;

    if (!isHealthy) {
      log.error(
        {
          workerCount: workers.length,
          stalledJobCount: stalledJobs.length,
          activeJobCount: activeJobs.length,
        },
        'Worker health check failed'
      );

      Sentry.captureMessage(`Worker health check failed for ${queueName}`, {
        level: 'error',
        tags: { queue: queueName, feature: 'worker-heartbeat' },
        extra: {
          workerCount: workers.length,
          stalledJobCount: stalledJobs.length,
          stalledJobIds: stalledJobs.slice(0, 5).map((j) => j.id),
        },
      });
    } else {
      log.debug(
        {
          workerCount: workers.length,
          activeJobCount: activeJobs.length,
        },
        'Worker health check passed'
      );
    }

    return {
      queueName,
      workerCount: workers.length,
      lastCheckAt: now,
      isHealthy,
      stalledJobCount: stalledJobs.length,
      activeJobCount: activeJobs.length,
    };
  } catch (error) {
    log.error({ err: error }, 'Failed to check worker health');
    throw error;
  }
}
