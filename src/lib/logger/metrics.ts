/**
 * Queue Metrics Collection and Logging
 * 
 * Periodically collects and logs queue metrics for monitoring.
 */

import { getAllQueues } from '@/lib/queue';
import { createLogger } from './index';
import { getMatchCoverage } from '@/lib/monitoring/pipeline-coverage';

const metricsLogger = createLogger('metrics');

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/**
 * Collect metrics from all queues
 */
export async function collectQueueMetrics(): Promise<QueueMetrics[]> {
  const queues = getAllQueues();
  const metrics: QueueMetrics[] = [];
  
  for (const queue of queues) {
    try {
      const counts = await queue.getJobCounts();
      metrics.push({
        name: queue.name,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
      });
    } catch (error) {
      metricsLogger.error(
        { queue: queue.name, error: error instanceof Error ? error.message : String(error) },
        'Failed to collect queue metrics'
      );
    }
  }
  
  return metrics;
}

/**
 * Log queue metrics snapshot (call periodically or on demand)
 */
export async function logQueueMetrics(): Promise<void> {
  try {
    const metrics = await collectQueueMetrics();
    
    const totals = metrics.reduce(
      (acc, m) => ({
        waiting: acc.waiting + m.waiting,
        active: acc.active + m.active,
        completed: acc.completed + m.completed,
        failed: acc.failed + m.failed,
        delayed: acc.delayed + m.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );
    
    metricsLogger.info({
      queues: metrics,
      totals,
      queueCount: metrics.length,
    }, 'Queue metrics snapshot');

    // Pipeline coverage metrics (MON-04)
    try {
      const coverage = await getMatchCoverage(6);
      metricsLogger.info({
        matchCoverage: {
          percentage: Math.round(coverage.percentage * 10) / 10,
          totalMatches: coverage.totalMatches,
          matchesWithoutPredictions: coverage.gaps.length,
        },
      }, 'Pipeline coverage metrics');
    } catch (coverageError) {
      metricsLogger.debug(
        { error: coverageError instanceof Error ? coverageError.message : String(coverageError) },
        'Failed to collect pipeline coverage metrics'
      );
    }
  } catch (error) {
    metricsLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to log queue metrics'
    );
  }
}

/**
 * Start periodic metrics logging (every 5 minutes)
 */
export function startPeriodicMetricsLogging(): NodeJS.Timer {
  const intervalMs = 5 * 60 * 1000; // 5 minutes
  
  metricsLogger.info({ intervalMinutes: 5 }, 'Starting periodic queue metrics logging');
  
  return setInterval(() => {
    logQueueMetrics().catch((error) => {
      metricsLogger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Periodic metrics logging failed'
      );
    });
  }, intervalMs);
}
