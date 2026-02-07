/**
 * Post-Deploy Task Runner
 *
 * Automatically runs idempotent tasks on app startup.
 * Tasks are tracked in PostgreSQL to ensure they only run once.
 *
 * Adding a new task: Just add an object to the TASKS array with a unique ID.
 */

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';

const log = loggers.instrumentation.child({ component: 'post-deploy' });

interface PostDeployTask {
  id: string;       // Unique, never reused (e.g., "drop-lineup-columns-v1")
  name: string;     // Human-readable description
  run: () => Promise<void>;
}

interface TaskResult {
  ran: number;
  skipped: number;
  failed: number;
}

/**
 * Run all pending post-deploy tasks
 * Returns counts of ran/skipped/failed tasks
 */
export async function runPostDeployTasks(): Promise<TaskResult> {
  const result: TaskResult = { ran: 0, skipped: 0, failed: 0 };

  try {
    const db = getDb();

    // Ensure deploy_tasks table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deploy_tasks (
        id TEXT PRIMARY KEY,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        result TEXT
      )
    `);

    // Get all completed task IDs
    const completedRows = await db.execute<{ id: string }>(sql`
      SELECT id FROM deploy_tasks
    `);
    const completedIds = new Set(completedRows.rows.map(r => r.id));

    // Execute each task
    for (const task of TASKS) {
      if (completedIds.has(task.id)) {
        log.debug({ taskId: task.id, taskName: task.name }, 'Task already completed, skipping');
        result.skipped++;
        continue;
      }

      log.info({ taskId: task.id, taskName: task.name }, 'Running post-deploy task');

      try {
        await task.run();

        // Record success
        await db.execute(sql`
          INSERT INTO deploy_tasks (id, result)
          VALUES (${task.id}, 'success')
        `);

        log.info({ taskId: task.id, taskName: task.name }, 'Task completed successfully');
        result.ran++;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failure but don't throw - startup continues
        await db.execute(sql`
          INSERT INTO deploy_tasks (id, result)
          VALUES (${task.id}, ${errorMessage})
        `);

        log.error({ taskId: task.id, taskName: task.name, error: errorMessage }, 'Task failed');
        result.failed++;
      }
    }

    return result;
  } catch (error: any) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Post-deploy task runner failed');
    throw error;
  }
}

/**
 * Post-deploy tasks to run on startup
 * Add new tasks here - they will run once automatically
 */
const TASKS: PostDeployTask[] = [
  {
    id: 'drop-lineup-columns-v1',
    name: 'Drop lineup columns from match_analysis table',
    run: async () => {
      const db = getDb();

      // Execute all DROP COLUMN statements (matching drizzle/0013_drop_lineup_columns.sql)
      await db.execute(sql`
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_formation;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_formation;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_starting_xi;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_starting_xi;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS home_coach;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS away_coach;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_available;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS lineups_updated_at;
        ALTER TABLE match_analysis DROP COLUMN IF EXISTS raw_lineups_data;
      `);

      log.info('Dropped 9 lineup columns from match_analysis table');
    },
  },
  {
    id: 'deep-retroactive-backfill-90d-v1',
    name: 'Deep retroactive backfill (90 days)',
    run: async () => {
      // Dynamic import to avoid loading queue infrastructure at module level
      const { backfillQueue, JOB_TYPES } = await import('@/lib/queue');

      // Queue a single backfill job with 90-day retroactive window
      // 30s delay ensures workers are fully booted before this runs
      await backfillQueue.add(
        JOB_TYPES.BACKFILL_MISSING,
        { manual: true, retroDays: 90 },
        { jobId: 'deploy-deep-backfill-90d', delay: 30000, priority: 3 }
      );

      log.info('Queued deep retroactive backfill job (90 days)');
    },
  },
];
