/**
 * Model Stats Worker
 *
 * Aggregates daily per-model prediction stats and detects regressions.
 * Runs at 00:05 UTC via BullMQ cron (registered in setup.ts).
 *
 * Job types:
 *   - aggregate-daily-stats: Aggregates yesterday's per-model stats
 *   - check-regressions: Runs regression detection after aggregation
 *
 * Startup backfill: On 'ready', checks if yesterday was aggregated.
 * If not, triggers immediate backfill to handle missed cron windows from restarts.
 */

import { Worker, Job } from 'bullmq';
import { format, subDays } from 'date-fns';
import { eq } from 'drizzle-orm';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import { aggregateDailyStats, detectRegressions } from '@/lib/db/queries/model-stats';
import { getDb } from '@/lib/db';
import { llmModelStats } from '@/lib/db/schema';
import { loggers } from '@/lib/logger/modules';
import { sendRegressionAlert } from '@/lib/notifications/discord';

export function createModelStatsWorker() {
  const log = loggers.modelStatsWorker;

  const worker = new Worker(
    QUEUE_NAMES.MODEL_STATS,
    async (job: Job) => {
      const jobLog = log.child({ jobId: job.id, jobName: job.name });

      jobLog.info('Processing model stats job');

      try {
        switch (job.name) {
          case 'aggregate-daily-stats': {
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            jobLog.info({ date: yesterday }, 'Aggregating daily stats');

            await aggregateDailyStats(yesterday);
            jobLog.info({ date: yesterday }, 'Daily stats aggregation complete');

            // Run regression detection after aggregation
            const regressions = await detectRegressions();

            if (regressions.length > 0) {
              const criticalCount = regressions.filter(a => a.severity === 'critical').length;
              const warningCount = regressions.filter(a => a.severity === 'warning').length;

              log.error({
                type: 'model-regression',
                regressions: regressions.map(a => ({
                  modelId: a.modelId,
                  displayName: a.displayName,
                  previousRate: `${a.previousSuccessRate.toFixed(1)}%`,
                  currentRate: `${a.currentSuccessRate.toFixed(1)}%`,
                  drop: `${a.drop.toFixed(1)}%`,
                  severity: a.severity,
                })),
              }, `MODEL REGRESSION: ${criticalCount} critical, ${warningCount} warning`);

              // Send Discord alert for regressions
              await sendRegressionAlert(regressions);
            } else {
              jobLog.info('No regressions detected');
            }

            return {
              success: true,
              date: yesterday,
              regressionsDetected: regressions.length,
            };
          }

          case 'check-regressions': {
            jobLog.info('Running standalone regression check');

            const regressions = await detectRegressions();

            if (regressions.length > 0) {
              const criticalCount = regressions.filter(a => a.severity === 'critical').length;
              const warningCount = regressions.filter(a => a.severity === 'warning').length;

              log.error({
                type: 'model-regression',
                regressions: regressions.map(a => ({
                  modelId: a.modelId,
                  displayName: a.displayName,
                  previousRate: `${a.previousSuccessRate.toFixed(1)}%`,
                  currentRate: `${a.currentSuccessRate.toFixed(1)}%`,
                  drop: `${a.drop.toFixed(1)}%`,
                  severity: a.severity,
                })),
              }, `MODEL REGRESSION: ${criticalCount} critical, ${warningCount} warning`);

              // Send Discord alert for regressions
              await sendRegressionAlert(regressions);
            } else {
              jobLog.info('No regressions detected');
            }

            return {
              success: true,
              regressionsDetected: regressions.length,
            };
          }

          default:
            jobLog.warn({ jobName: job.name }, 'Unknown job type');
            return { success: false, error: `Unknown job type: ${job.name}` };
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        jobLog.error({ err: error }, 'Model stats job failed');
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Single aggregation at a time
    }
  );

  // Startup backfill: check if yesterday's stats exist, backfill if missing
  worker.on('ready', async () => {
    try {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const db = getDb();
      const existing = await db
        .select({ id: llmModelStats.id })
        .from(llmModelStats)
        .where(eq(llmModelStats.date, yesterday))
        .limit(1);

      if (existing.length === 0) {
        log.info({ date: yesterday }, 'Missing stats for yesterday, backfilling');
        await aggregateDailyStats(yesterday);
        await detectRegressions();
        log.info({ date: yesterday }, 'Startup backfill complete');
      } else {
        log.info({ date: yesterday }, 'Yesterday stats already exist, no backfill needed');
      }
    } catch (error) {
      log.error({ err: error }, 'Startup backfill check failed (non-fatal)');
    }
  });

  return worker;
}
