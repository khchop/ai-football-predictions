/**
 * Backfill Settlement Script
 *
 * One-shot script to settle all finished matches from the last N days.
 * Covers both matches with pending predictions and matches with zero predictions.
 *
 * Usage: npx tsx scripts/backfill-settlement.ts [--days N]
 */

import 'dotenv/config';
import { getMatchesNeedingScoring, getFinishedMatchesWithZeroPredictions } from '@/lib/db/queries';
import { settlementQueue, JOB_TYPES, closeQueueConnection } from '@/lib/queue';

async function backfillSettlement() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 && args[daysIndex + 1]
    ? parseInt(args[daysIndex + 1], 10)
    : 7;

  if (isNaN(days) || days < 1) {
    console.error('❌ Invalid --days argument. Must be a positive integer.');
    process.exit(1);
  }

  console.log(`🔍 Checking for finished matches needing settlement (last ${days} days)...`);

  const stats = {
    matchesWithPendingPredictions: 0,
    matchesWithZeroPredictions: 0,
    jobsQueued: 0,
    duplicatesSkipped: 0,
    errors: [] as string[],
  };

  try {
    // 1. Find matches with pending (unscored) predictions
    console.log('\n📊 Finding matches with pending predictions...');
    const matchesNeedingScoring = await getMatchesNeedingScoring();
    stats.matchesWithPendingPredictions = matchesNeedingScoring.length;

    for (const match of matchesNeedingScoring) {
      try {
        const jobId = `settle-backfill-${match.id}`;
        const existingJob = await settlementQueue.getJob(jobId);

        if (existingJob) {
          stats.duplicatesSkipped++;
          continue;
        }

        await settlementQueue.add(
          JOB_TYPES.SETTLE_MATCH,
          {
            matchId: match.id,
            homeScore: match.homeScore ?? 0,
            awayScore: match.awayScore ?? 0,
            status: match.status,
          },
          {
            delay: 1000,
            priority: 1, // High priority - has predictions waiting
            jobId,
          }
        );

        stats.jobsQueued++;
        console.log(`  ✓ Queued: ${match.homeTeam} vs ${match.awayTeam} (${match.id})`);
      } catch (error: any) {
        const errorMsg = `Match ${match.id}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }

    // 2. Find matches with zero predictions (edge case)
    console.log(`\n🔎 Finding finished matches with zero predictions (last ${days} days)...`);
    const zeroPredictionMatches = await getFinishedMatchesWithZeroPredictions(days);
    stats.matchesWithZeroPredictions = zeroPredictionMatches.length;

    for (const match of zeroPredictionMatches) {
      try {
        const jobId = `settle-backfill-zero-${match.id}`;
        const existingJob = await settlementQueue.getJob(jobId);

        if (existingJob) {
          stats.duplicatesSkipped++;
          continue;
        }

        await settlementQueue.add(
          JOB_TYPES.SETTLE_MATCH,
          {
            matchId: match.id,
            homeScore: match.homeScore ?? 0,
            awayScore: match.awayScore ?? 0,
            status: match.status,
          },
          {
            delay: 1000,
            priority: 2, // Lower priority - scoring worker will handle conditional retry
            jobId,
          }
        );

        stats.jobsQueued++;
        console.log(`  ✓ Queued (zero-pred): ${match.homeTeam} vs ${match.awayTeam} (${match.id})`);
      } catch (error: any) {
        const errorMsg = `Match ${match.id}: ${error.message}`;
        stats.errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Matches with pending predictions: ${stats.matchesWithPendingPredictions}`);
    console.log(`Matches with zero predictions:    ${stats.matchesWithZeroPredictions}`);
    console.log(`Jobs queued:                      ${stats.jobsQueued}`);
    console.log(`Duplicates skipped:               ${stats.duplicatesSkipped}`);
    console.log(`Errors:                           ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('='.repeat(60));

    if (stats.jobsQueued === 0) {
      console.log('\n✅ No settlement jobs needed - all matches already settled or queued.');
    } else {
      console.log(`\n✅ Successfully queued ${stats.jobsQueued} settlement job(s).`);
      console.log('⏳ Waiting 2 seconds for jobs to be dispatched...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await closeQueueConnection();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    await closeQueueConnection();
    process.exit(1);
  }
}

backfillSettlement().catch(async (err) => {
  console.error('❌ Unhandled error:', err);
  await closeQueueConnection();
  process.exit(1);
});
