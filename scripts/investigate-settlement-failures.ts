/**
 * Settlement Failure Investigation Script
 *
 * Investigates 43 failed settlement jobs to identify root cause.
 * Queries both DLQ and settlement queue for failed jobs, extracts failure patterns,
 * and exports results to JSON for analysis.
 *
 * Usage: npx tsx scripts/investigate-settlement-failures.ts
 * Output: scripts/output/settlement-investigation.json
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getQueueConnection, getSettlementQueue } from '../src/lib/queue';
import { getDeadLetterJobs, getDeadLetterCount } from '../src/lib/queue/dead-letter';

// ============================================================================
// TYPES
// ============================================================================

interface FailureEntry {
  jobId: string;
  matchId: string | null;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
  stackLines: string[];
  source: 'DLQ' | 'Queue';
}

interface FailureGroup {
  reason: string;
  count: number;
  matchIds: string[];
  example: FailureEntry;
}

interface InvestigationResults {
  timestamp: string;
  summary: {
    dlqCount: number;
    queueFailedCount: number;
    totalFailures: number;
  };
  failureGroups: FailureGroup[];
  allFailures: FailureEntry[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract first 3 lines of stack trace
 */
function extractStackLines(stackTrace: string | undefined): string[] {
  if (!stackTrace) return [];
  return stackTrace.split('\n').slice(0, 3).map(line => line.trim());
}

/**
 * Normalize error reason for grouping
 * Removes specific IDs/numbers to group similar errors
 */
function normalizeReason(reason: string): string {
  return reason
    .replace(/match [a-f0-9-]+/gi, 'match <ID>')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '<UUID>')
    .replace(/\d{4}-\d{2}-\d{2}/g, '<DATE>')
    .replace(/\d+/g, '<NUM>')
    .trim();
}

/**
 * Group failures by normalized reason
 */
function groupFailures(failures: FailureEntry[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();

  for (const failure of failures) {
    const normalizedReason = normalizeReason(failure.failedReason);

    if (!groups.has(normalizedReason)) {
      groups.set(normalizedReason, {
        reason: normalizedReason,
        count: 0,
        matchIds: [],
        example: failure,
      });
    }

    const group = groups.get(normalizedReason)!;
    group.count++;
    if (failure.matchId && !group.matchIds.includes(failure.matchId)) {
      group.matchIds.push(failure.matchId);
    }
  }

  // Sort by count descending
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

// ============================================================================
// MAIN INVESTIGATION
// ============================================================================

async function main() {
  console.log('\n=== Settlement Failure Investigation ===\n');

  // Ensure output directory exists
  const outputDir = path.resolve(process.cwd(), 'scripts/output');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    // Ignore if already exists
  }

  const failures: FailureEntry[] = [];

  // 1. Query DLQ
  console.log('Querying Dead Letter Queue...');
  const dlqCount = await getDeadLetterCount();
  const dlqJobs = await getDeadLetterJobs(100, 0);

  console.log(`  DLQ entries: ${dlqCount}`);
  console.log(`  DLQ jobs retrieved: ${dlqJobs.length}`);

  for (const job of dlqJobs) {
    failures.push({
      jobId: job.jobId,
      matchId: job.data?.matchId || null,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      stackLines: extractStackLines(job.stackTrace),
      source: 'DLQ',
    });
  }

  // 2. Query Settlement Queue failed jobs
  console.log('\nQuerying Settlement Queue failed jobs...');
  const settlementQueue = getSettlementQueue();
  const queueFailedJobs = await settlementQueue.getFailed(0, -1);
  const queueFailedCount = await settlementQueue.getFailedCount();

  console.log(`  Queue failed count: ${queueFailedCount}`);
  console.log(`  Queue failed jobs retrieved: ${queueFailedJobs.length}`);

  for (const job of queueFailedJobs) {
    failures.push({
      jobId: job.id || 'unknown',
      matchId: job.data?.matchId || null,
      failedReason: job.failedReason || 'Unknown error',
      attemptsMade: job.attemptsMade,
      timestamp: new Date(job.timestamp || Date.now()).toISOString(),
      stackLines: extractStackLines(job.stacktrace),
      source: 'Queue',
    });
  }

  // 3. Group failures by reason
  console.log('\nGrouping failures by reason...');
  const failureGroups = groupFailures(failures);

  // 4. Print summary
  console.log('\n' + '='.repeat(80));
  console.log('=== SUMMARY ===');
  console.log('='.repeat(80));
  console.log(`\nTotal failures: ${failures.length}`);
  console.log(`  - DLQ: ${dlqCount}`);
  console.log(`  - Queue failed: ${queueFailedCount}`);

  console.log('\n' + '-'.repeat(80));
  console.log('=== FAILURE REASON BREAKDOWN ===');
  console.log('-'.repeat(80));

  for (const group of failureGroups) {
    console.log(`\n[${group.count} failures] ${group.reason}`);
    console.log(`  Affected matches: ${group.matchIds.length} (${group.matchIds.slice(0, 3).join(', ')}${group.matchIds.length > 3 ? ', ...' : ''})`);
    console.log(`  Example: ${group.example.failedReason}`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log('=== ALL AFFECTED MATCH IDs ===');
  console.log('-'.repeat(80));

  const allMatchIds = Array.from(new Set(failures.map(f => f.matchId).filter(Boolean)));
  console.log(`Total unique matches: ${allMatchIds.length}`);
  console.log(allMatchIds.join('\n'));

  // 5. Export to JSON
  const outputPath = path.join(outputDir, 'settlement-investigation.json');
  const results: InvestigationResults = {
    timestamp: new Date().toISOString(),
    summary: {
      dlqCount,
      queueFailedCount,
      totalFailures: failures.length,
    },
    failureGroups,
    allFailures: failures,
  };

  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log('\n' + '='.repeat(80));
  console.log(`Results exported to: ${outputPath}`);
  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// EXECUTION
// ============================================================================

main()
  .catch(error => {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  })
  .finally(() => {
    // Allow connection pool to drain before exit
    setTimeout(() => process.exit(0), 100);
  });
