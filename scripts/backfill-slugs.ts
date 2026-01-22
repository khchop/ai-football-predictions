import { getDb, matches, competitions } from '../src/lib/db';
import { generateMatchSlug, generateCompetitionSlug } from '../src/lib/utils/slugify';
import { eq } from 'drizzle-orm';

/**
 * Backfill slugs for existing matches and competitions
 * Run this after adding slug columns to the database
 */
async function backfillSlugs() {
  const db = getDb();
  
  console.log('Starting slug backfill...\n');
  
  // Backfill competition slugs
  console.log('Backfilling competition slugs...');
  const allCompetitions = await db.select().from(competitions);
  
  for (const competition of allCompetitions) {
    const slug = generateCompetitionSlug(competition.name);
    
    await db
      .update(competitions)
      .set({ slug })
      .where(eq(competitions.id, competition.id));
    
    console.log(`  ✓ ${competition.name} -> ${slug}`);
  }
  
  console.log(`\nBackfilled ${allCompetitions.length} competition slugs.\n`);
  
  // Backfill match slugs
  console.log('Backfilling match slugs...');
  const allMatches = await db.select().from(matches);
  
  let processed = 0;
  let skipped = 0;
  
  for (const match of allMatches) {
    try {
      const slug = generateMatchSlug(
        match.homeTeam,
        match.awayTeam,
        match.kickoffTime
      );
      
      await db
        .update(matches)
        .set({ slug })
        .where(eq(matches.id, match.id));
      
      processed++;
      
      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${allMatches.length} matches...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed for match ${match.id}:`, error);
      skipped++;
    }
  }
  
  console.log(`\n✓ Backfilled ${processed} match slugs.`);
  if (skipped > 0) {
    console.log(`✗ Skipped ${skipped} matches due to errors.`);
  }
  
  console.log('\nSlug backfill complete!');
}

// Run the backfill
backfillSlugs()
  .then(() => {
    console.log('\n✓ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error:', error);
    process.exit(1);
  });
