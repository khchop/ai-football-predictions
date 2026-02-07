import { getDb, matches, matchPreviews, competitions, matchAnalysis } from '@/lib/db';
import { eq, isNotNull } from 'drizzle-orm';
import { generateMatchPreview } from '@/lib/content/generator';
import { getMatchBetsForPreview } from '@/lib/content/queries';

/**
 * One-time backfill script to regenerate ALL existing match previews
 * with the new anti-hallucination prompt from quick-029.
 *
 * Purpose: Remove hallucinated content (wrong standings, fictional players,
 * made-up tactics) from existing database previews. New prompt focuses on
 * odds, AI predictions, and observable data only.
 */
async function backfillMatchPreviews() {
  const db = getDb();

  console.log('\n=== Starting Match Preview Backfill (Anti-Hallucination) ===\n');

  // Find ALL matches that have existing previews
  const matchesWithPreviews = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      kickoffTime: matches.kickoffTime,
      venue: matches.venue,
      competitionName: competitions.name,
      analysis: matchAnalysis,
    })
    .from(matches)
    .innerJoin(matchPreviews, eq(matches.id, matchPreviews.matchId))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .orderBy(matches.kickoffTime);

  console.log(`Found ${matchesWithPreviews.length} matches with existing previews\n`);

  if (matchesWithPreviews.length === 0) {
    console.log('✓ No previews to regenerate!\n');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;
  const failed: string[] = [];

  // Process in batches to avoid overwhelming API
  // Batch size 3 (not 5) - previews use structured JSON output, heavier than post-match
  const BATCH_SIZE = 3;
  const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds between batches

  for (let i = 0; i < matchesWithPreviews.length; i += BATCH_SIZE) {
    const batch = matchesWithPreviews.slice(i, i + BATCH_SIZE);

    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(matchesWithPreviews.length / BATCH_SIZE)}:`);

    for (const match of batch) {
      try {
        console.log(`  - ${match.homeTeam} vs ${match.awayTeam}...`);

        // Get AI predictions for this match
        const aiPredictions = await getMatchBetsForPreview(match.matchId);

        // Regenerate preview with new anti-hallucination prompt
        await generateMatchPreview({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competitionName,
          kickoffTime: match.kickoffTime,
          venue: match.venue ?? undefined,
          analysis: match.analysis as Record<string, unknown> | undefined,
          aiPredictions,
        });

        successCount++;
        console.log(`    ✓ Regenerated`);
      } catch (error: any) {
        failCount++;
        failed.push(`${match.homeTeam} vs ${match.awayTeam}`);
        console.log(`    ✗ Error: ${error.message}`);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < matchesWithPreviews.length) {
      console.log(`  Waiting 3s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n=== Backfill Complete ===\n');
  console.log(`Total matches: ${matchesWithPreviews.length}`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);

  if (failed.length > 0) {
    console.log('\nFailed matches:');
    failed.forEach(m => console.log(`  - ${m}`));
  }

  process.exit(failCount > 0 ? 1 : 0);
}

backfillMatchPreviews().catch((error) => {
  console.error('\n✗ Backfill script failed:', error);
  process.exit(1);
});
