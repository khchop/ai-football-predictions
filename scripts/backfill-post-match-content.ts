import { getDb, matches, predictions, matchContent } from '@/lib/db';
import { eq, and, isNull, or } from 'drizzle-orm';
import { generatePostMatchContent } from '@/lib/content/match-content';
import { loggers } from '@/lib/logger/modules';

const log = loggers.content;

/**
 * One-time backfill script for ALL matches missing post-match content
 * No time limit - processes all finished matches with scored predictions
 */
async function backfillAllPostMatchContent() {
  const db = getDb();
  
  console.log('\n=== Starting Post-Match Content Backfill (All Time) ===\n');
  
  // Find ALL finished matches with scored predictions but missing post-match content
  const missingContent = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      kickoffTime: matches.kickoffTime,
    })
    .from(matches)
    .innerJoin(predictions, eq(matches.id, predictions.matchId))
    .leftJoin(matchContent, eq(matches.id, matchContent.matchId))
    .where(
      and(
        eq(matches.status, 'finished'),
        eq(predictions.status, 'scored'),
        or(
          isNull(matchContent.id),
          isNull(matchContent.postMatchContent)
        )
      )
    )
    .groupBy(matches.id)
    .orderBy(matches.kickoffTime);
  
  console.log(`Found ${missingContent.length} matches missing post-match content\n`);
  
  if (missingContent.length === 0) {
    console.log('✓ All matches have post-match content!\n');
    process.exit(0);
  }
  
  let successCount = 0;
  let failCount = 0;
  const failed: string[] = [];
  
  // Process in batches to avoid overwhelming API
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
  
  for (let i = 0; i < missingContent.length; i += BATCH_SIZE) {
    const batch = missingContent.slice(i, i + BATCH_SIZE);
    
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingContent.length / BATCH_SIZE)}:`);
    
    for (const match of batch) {
      try {
        console.log(`  - ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}...`);
        await generatePostMatchContent(match.matchId);
        successCount++;
        console.log(`    ✓ Generated`);
      } catch (error: any) {
        failCount++;
        failed.push(`${match.homeTeam} vs ${match.awayTeam}`);
        console.log(`    ✗ Error: ${error.message}`);
      }
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < missingContent.length) {
      console.log(`  Waiting 2s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log('\n=== Backfill Complete ===\n');
  console.log(`Total matches: ${missingContent.length}`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  
  if (failed.length > 0) {
    console.log('\nFailed matches:');
    failed.forEach(m => console.log(`  - ${m}`));
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

backfillAllPostMatchContent().catch((error) => {
  console.error('\n✗ Backfill script failed:', error);
  process.exit(1);
});
