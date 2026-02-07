/**
 * DLQ Requeue Script
 *
 * Requeues failed jobs from Dead Letter Queue back to their respective queues.
 * Designed to requeue 343 preview jobs and 34 analysis jobs after root causes fixed.
 *
 * Usage:
 *   npx tsx scripts/requeue-dlq-jobs.ts --dry-run   # Test without modifying
 *   npx tsx scripts/requeue-dlq-jobs.ts              # Actually requeue
 *
 * Root causes fixed:
 *   - Previews: unique constraint added (quick-022)
 *   - Analysis: allowRetroactive flag support added (earlier fixes)
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getQueueConnection, getQueue, QUEUE_NAMES, closeQueueConnection } from '../src/lib/queue';
import { getDeadLetterJobs, getDeadLetterCount, deleteDeadLetterEntry } from '../src/lib/queue/dead-letter';
import type { GenerateContentPayload, AnalyzeMatchPayload } from '../src/lib/queue/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const REQUEUE_DELAY_MS = 50; // Small delay to avoid overwhelming Redis

// ============================================================================
// TYPES
// ============================================================================

interface RequeueStats {
  totalFound: number;
  contentQueue: {
    found: number;
    requeued: number;
    failed: number;
  };
  analysisQueue: {
    found: number;
    requeued: number;
    failed: number;
  };
  otherQueues: number;
  dlqRemaining: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse job data if it's a string (DLQ stores serialized data sometimes)
 */
function parseJobData(data: any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to parse job data:', err);
      return data;
    }
  }
  return data;
}

/**
 * Requeue a single content-queue (preview) entry
 */
async function requeuePreview(entry: any): Promise<boolean> {
  try {
    const contentQueue = getQueue(QUEUE_NAMES.CONTENT);
    const jobData = parseJobData(entry.data) as GenerateContentPayload;

    // Validate it's a preview job
    if (jobData.type !== 'match_preview') {
      console.log(`  [SKIP] Content job ${entry.jobId} is not a preview (type: ${jobData.type})`);
      return false;
    }

    const matchId = jobData.data.matchId;
    const jobId = `requeue-preview-${matchId}`;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would requeue preview for match ${matchId} with jobId ${jobId}`);
      return true;
    }

    // Add to queue with unique jobId to avoid collisions
    await contentQueue.add('generate-match-preview', jobData, { jobId });

    // Remove from DLQ
    await deleteDeadLetterEntry(entry.queueName, entry.jobId);

    console.log(`  ✓ Requeued preview for match ${matchId}`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to requeue preview ${entry.jobId}: ${error}`);
    return false;
  }
}

/**
 * Requeue a single analysis-queue entry
 */
async function requeueAnalysis(entry: any): Promise<boolean> {
  try {
    const analysisQueue = getQueue(QUEUE_NAMES.ANALYSIS);
    const jobData = parseJobData(entry.data) as AnalyzeMatchPayload;

    const matchId = jobData.matchId;
    const jobId = `requeue-analyze-${matchId}`;

    // CRITICAL: Add allowRetroactive flag since these matches are now past kickoff
    const requeueData = {
      ...jobData,
      allowRetroactive: true,
    };

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would requeue analysis for match ${matchId} with allowRetroactive=true`);
      return true;
    }

    // Add to queue with priority 3 (lower priority than fresh jobs)
    await analysisQueue.add('analyze-match', requeueData, {
      jobId,
      priority: 3,
    });

    // Remove from DLQ
    await deleteDeadLetterEntry(entry.queueName, entry.jobId);

    console.log(`  ✓ Requeued analysis for match ${matchId} (retroactive)`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to requeue analysis ${entry.jobId}: ${error}`);
    return false;
  }
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN REQUEUE LOGIC
// ============================================================================

async function main() {
  console.log('\n=== DLQ Requeue Script ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const stats: RequeueStats = {
    totalFound: 0,
    contentQueue: { found: 0, requeued: 0, failed: 0 },
    analysisQueue: { found: 0, requeued: 0, failed: 0 },
    otherQueues: 0,
    dlqRemaining: 0,
  };

  // Step 1: Get total DLQ count
  console.log('Step 1: Querying DLQ...');
  const totalCount = await getDeadLetterCount();
  console.log(`  Total DLQ entries: ${totalCount}\n`);

  if (totalCount === 0) {
    console.log('✓ DLQ is empty - nothing to requeue\n');
    return stats;
  }

  stats.totalFound = totalCount;

  // Step 2: Fetch all DLQ entries
  console.log('Step 2: Fetching all DLQ entries...');
  const allEntries = await getDeadLetterJobs(totalCount, 0);
  console.log(`  Retrieved ${allEntries.length} entries\n`);

  // Step 3: Categorize by queue
  console.log('Step 3: Categorizing entries by queue...');
  const contentEntries = allEntries.filter(e => e.queueName === QUEUE_NAMES.CONTENT);
  const analysisEntries = allEntries.filter(e => e.queueName === QUEUE_NAMES.ANALYSIS);
  const otherEntries = allEntries.filter(e =>
    e.queueName !== QUEUE_NAMES.CONTENT && e.queueName !== QUEUE_NAMES.ANALYSIS
  );

  stats.contentQueue.found = contentEntries.length;
  stats.analysisQueue.found = analysisEntries.length;
  stats.otherQueues = otherEntries.length;

  console.log(`  Content queue (previews): ${contentEntries.length}`);
  console.log(`  Analysis queue: ${analysisEntries.length}`);
  console.log(`  Other queues (will skip): ${otherEntries.length}\n`);

  if (otherEntries.length > 0) {
    console.log('  Other queue entries:');
    otherEntries.forEach(e => {
      console.log(`    - ${e.queueName}: ${e.jobId} (${e.jobType})`);
    });
    console.log();
  }

  // Step 4: Requeue content-queue (preview) entries
  if (contentEntries.length > 0) {
    console.log(`Step 4: Requeuing ${contentEntries.length} preview jobs...`);
    for (const entry of contentEntries) {
      const success = await requeuePreview(entry);
      if (success) {
        stats.contentQueue.requeued++;
      } else {
        stats.contentQueue.failed++;
      }

      // Rate limiting
      if (!DRY_RUN) {
        await sleep(REQUEUE_DELAY_MS);
      }
    }
    console.log();
  }

  // Step 5: Requeue analysis-queue entries
  if (analysisEntries.length > 0) {
    console.log(`Step 5: Requeuing ${analysisEntries.length} analysis jobs...`);
    for (const entry of analysisEntries) {
      const success = await requeueAnalysis(entry);
      if (success) {
        stats.analysisQueue.requeued++;
      } else {
        stats.analysisQueue.failed++;
      }

      // Rate limiting
      if (!DRY_RUN) {
        await sleep(REQUEUE_DELAY_MS);
      }
    }
    console.log();
  }

  // Step 6: Check DLQ remaining count
  if (!DRY_RUN) {
    console.log('Step 6: Checking DLQ after requeue...');
    stats.dlqRemaining = await getDeadLetterCount();
    console.log(`  DLQ entries remaining: ${stats.dlqRemaining}\n`);
  }

  return stats;
}

// ============================================================================
// EXECUTION
// ============================================================================

main()
  .then(stats => {
    console.log('='.repeat(80));
    console.log('=== DLQ REQUEUE SUMMARY ===');
    console.log('='.repeat(80));
    console.log(`\nTotal DLQ entries found: ${stats.totalFound}`);
    console.log('\nContent queue (previews):');
    console.log(`  Found: ${stats.contentQueue.found}`);
    console.log(`  Requeued: ${stats.contentQueue.requeued}`);
    console.log(`  Failed/Skipped: ${stats.contentQueue.failed}`);
    console.log('\nAnalysis queue:');
    console.log(`  Found: ${stats.analysisQueue.found}`);
    console.log(`  Requeued: ${stats.analysisQueue.requeued}`);
    console.log(`  Failed/Skipped: ${stats.analysisQueue.failed}`);
    console.log(`\nOther queues (skipped): ${stats.otherQueues}`);

    if (!DRY_RUN) {
      console.log(`\nDLQ entries remaining: ${stats.dlqRemaining}`);
    } else {
      console.log('\n🔍 DRY RUN COMPLETE - Run without --dry-run to actually requeue');
    }

    console.log('\n' + '='.repeat(80) + '\n');
  })
  .catch(error => {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    // Close Redis connection
    await closeQueueConnection();
    process.exit(0);
  });
