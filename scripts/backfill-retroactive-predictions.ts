/**
 * Retroactive Backfill Script
 *
 * One-shot script to backfill predictions for matches missing them from the last N days.
 * Queues analysis (if missing), predictions, and scoring jobs sequentially via BullMQ.
 *
 * Usage: npx tsx scripts/backfill-retroactive-predictions.ts [--days N]
 *
 * Purpose: After pipeline failures (server restarts, API issues, worker crashes),
 * matches from the last 7 days may have fewer than 42 predictions. This script
 * retroactively generates predictions using pre-match context (via API-Football
 * historical data) and immediately scores finished matches.
 */

import 'dotenv/config';
import { getDb } from '@/lib/db';
import { matches, matchAnalysis, predictions } from '@/lib/db/schema';
import { eq, and, gte, isNotNull, sql, count } from 'drizzle-orm';
import {
  analysisQueue,
  predictionsQueue,
  settlementQueue,
  JOB_TYPES,
  closeQueueConnection,
} from '@/lib/queue';
import type { Queue, Job } from 'bullmq';

interface MatchGap {
  matchId: string;
  status: string;
  kickoffTime: string;
  predictionCount: number;
  hasAnalysis: boolean;
  homeScore: number | null;
  awayScore: number | null;
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Find matches with fewer than 42 predictions from the last N days
 */
async function findMatchesMissingPredictions(days: number): Promise<MatchGap[]> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString();

  console.log(`🔍 Scanning matches from ${cutoff} onwards...`);

  // Query matches with LEFT JOIN to count predictions
  // Filter for matches with < 42 predictions AND valid status
  const gaps = await db
    .select({
      matchId: matches.id,
      status: matches.status,
      kickoffTime: matches.kickoffTime,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      externalId: matches.externalId,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      predictionCount: sql<number>`CAST(COUNT(DISTINCT ${predictions.id}) AS INTEGER)`,
      hasAnalysis: sql<boolean>`${matchAnalysis.favoriteTeamName} IS NOT NULL`,
    })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        gte(matches.kickoffTime, cutoff),
        isNotNull(matches.externalId), // Required for API-Football
        sql`${matches.status} IN ('scheduled', 'live', 'finished')` // Exclude cancelled/postponed
      )
    )
    .groupBy(
      matches.id,
      matches.status,
      matches.kickoffTime,
      matches.homeScore,
      matches.awayScore,
      matches.externalId,
      matches.homeTeam,
      matches.awayTeam,
      matchAnalysis.favoriteTeamName
    )
    .having(sql`COUNT(DISTINCT ${predictions.id}) < 42`);

  return gaps.map(g => ({
    matchId: g.matchId,
    status: g.status ?? 'scheduled',
    kickoffTime: g.kickoffTime,
    predictionCount: g.predictionCount,
    hasAnalysis: g.hasAnalysis,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    externalId: g.externalId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
  }));
}

/**
 * Queue retroactive analysis job with idempotent job ID
 */
async function generateRetroactiveAnalysis(
  matchId: string,
  externalId: string,
  homeTeam: string,
  awayTeam: string
): Promise<void> {
  const jobId = `analyze-retro-${matchId}`;
  const existingJob = await analysisQueue.getJob(jobId);

  // Remove stale completed/failed jobs
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
    } else if (['delayed', 'waiting', 'active'].includes(state)) {
      console.log(`  ⏭️  Analysis job already ${state}, skipping...`);
      return;
    }
  }

  await analysisQueue.add(
    JOB_TYPES.ANALYZE_MATCH,
    {
      matchId,
      externalId,
      homeTeam,
      awayTeam,
      allowRetroactive: true,
    },
    {
      jobId,
      delay: 1000,
      priority: 3,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30000,
      },
    }
  );

  console.log(`  ✓ Queued analysis job: ${jobId}`);
}

/**
 * Queue retroactive predictions job with idempotent job ID
 */
async function generateRetroactivePredictions(matchId: string): Promise<void> {
  const jobId = `predict-retro-${matchId}`;
  const existingJob = await predictionsQueue.getJob(jobId);

  // Remove stale completed/failed jobs
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
    } else if (['delayed', 'waiting', 'active'].includes(state)) {
      console.log(`  ⏭️  Predictions job already ${state}, skipping...`);
      return;
    }
  }

  await predictionsQueue.add(
    JOB_TYPES.PREDICT_MATCH,
    {
      matchId,
      attempt: 1 as const,
      skipIfDone: true,
      allowRetroactive: true,
    },
    {
      jobId,
      delay: 1000,
      priority: 3,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30000,
      },
    }
  );

  console.log(`  ✓ Queued predictions job: ${jobId}`);
}

/**
 * Queue settlement job for finished matches
 */
async function scoreFinishedMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: string
): Promise<void> {
  const jobId = `settle-retro-${matchId}`;
  const existingJob = await settlementQueue.getJob(jobId);

  // Remove stale completed/failed jobs
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
    } else if (['delayed', 'waiting', 'active'].includes(state)) {
      console.log(`  ⏭️  Settlement job already ${state}, skipping...`);
      return;
    }
  }

  await settlementQueue.add(
    JOB_TYPES.SETTLE_MATCH,
    {
      matchId,
      homeScore,
      awayScore,
      status,
    },
    {
      jobId,
      delay: 1000,
      priority: 2,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    }
  );

  console.log(`  ✓ Queued settlement job: ${jobId}`);
}

/**
 * Wait for a job to complete (poll every 2 seconds)
 */
async function waitForJobCompletion(
  queue: Queue,
  jobId: string,
  timeoutMs: number
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    const state = await job.getState();

    if (state === 'completed') {
      console.log(`  ✅ Job ${jobId} completed`);
      return;
    }

    if (state === 'failed') {
      const failedReason = job.failedReason || 'Unknown failure';
      throw new Error(`Job ${jobId} failed: ${failedReason}`);
    }

    // Still processing, wait and poll again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout reached
  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Main orchestration
 */
async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 && args[daysIndex + 1]
    ? parseInt(args[daysIndex + 1], 10)
    : 7;

  if (isNaN(days) || days < 0) {
    console.error('❌ Invalid --days argument. Must be a non-negative integer.');
    process.exit(1);
  }

  console.log('🔄 RETROACTIVE BACKFILL SCRIPT');
  console.log('='.repeat(60));
  console.log(`📅 Lookback window: ${days} days`);
  console.log('='.repeat(60));

  const stats = {
    matchesFound: 0,
    analysisQueued: 0,
    predictionsQueued: 0,
    scoringQueued: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: Find gaps
    const gaps = await findMatchesMissingPredictions(days);
    stats.matchesFound = gaps.length;

    if (gaps.length === 0) {
      console.log('\n✅ No matches missing predictions - all up to date!');
      return;
    }

    // Breakdown by status
    const statusBreakdown = gaps.reduce((acc, g) => {
      acc[g.status] = (acc[g.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\n📊 Found ${gaps.length} match(es) with < 42 predictions:`);
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
    console.log('');

    // Step 2: Process gaps SEQUENTIALLY
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      console.log(`\n[${i + 1}/${gaps.length}] ${gap.homeTeam} vs ${gap.awayTeam}`);
      console.log(`   Match ID: ${gap.matchId}`);
      console.log(`   Status: ${gap.status}`);
      console.log(`   Predictions: ${gap.predictionCount}/42`);
      console.log(`   Has Analysis: ${gap.hasAnalysis ? 'Yes' : 'No'}`);

      try {
        // 2a. Queue analysis if missing
        if (!gap.hasAnalysis) {
          if (!gap.externalId) {
            throw new Error('Cannot queue analysis: externalId is null');
          }
          await generateRetroactiveAnalysis(
            gap.matchId,
            gap.externalId,
            gap.homeTeam,
            gap.awayTeam
          );
          await waitForJobCompletion(analysisQueue, `analyze-retro-${gap.matchId}`, 120000);
          stats.analysisQueued++;
        }

        // 2b. Queue predictions
        await generateRetroactivePredictions(gap.matchId);
        await waitForJobCompletion(predictionsQueue, `predict-retro-${gap.matchId}`, 300000);
        stats.predictionsQueued++;

        // 2c. Queue scoring if finished
        if (gap.status === 'finished' && gap.homeScore !== null && gap.awayScore !== null) {
          await scoreFinishedMatch(gap.matchId, gap.homeScore, gap.awayScore, gap.status);
          await waitForJobCompletion(settlementQueue, `settle-retro-${gap.matchId}`, 60000);
          stats.scoringQueued++;
        }

        console.log(`   ✅ Match processing complete`);
      } catch (error: any) {
        const errorMsg = `${gap.matchId}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`   ❌ Error: ${error.message}`);
        console.log(`   ⏩ Continuing to next match...`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Matches with gaps found:      ${stats.matchesFound}`);
    console.log(`Analysis jobs queued:         ${stats.analysisQueued}`);
    console.log(`Predictions jobs queued:      ${stats.predictionsQueued}`);
    console.log(`Settlement jobs queued:       ${stats.scoringQueued}`);
    console.log(`Errors:                       ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('='.repeat(60));

    if (stats.predictionsQueued === 0) {
      console.log('\n✅ No backfill jobs needed - all matches up to date.');
    } else {
      console.log(`\n✅ Successfully processed ${stats.predictionsQueued} match(es).`);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    throw error;
  } finally {
    await closeQueueConnection();
  }
}

// Run main with error handling
main()
  .then(() => {
    console.log('\n🎉 Backfill complete!');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n💥 Unhandled error:', err);
    await closeQueueConnection();
    process.exit(1);
  });
