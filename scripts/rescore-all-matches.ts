/**
 * Rescore all finished matches with the new integer quota system.
 * 
 * This script:
 * 1. Finds all finished matches with predictions
 * 2. Recalculates quotas (now integers instead of decimals)
 * 3. Updates match quota columns
 * 4. Recalculates and updates all prediction scores
 * 
 * Run with: npx tsx scripts/rescore-all-matches.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, matches, predictions } from '../src/lib/db/index';
import { eq, isNotNull, and } from 'drizzle-orm';
import { scorePredictionsForMatch } from '../src/lib/scoring/score-match';

async function rescoreAllMatches() {
  const db = getDb();
  
  console.log('Starting rescore of all finished matches...\n');
  
  // Get all finished matches with scores
  const finishedMatches = await db
    .select({
      id: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      quotaHome: matches.quotaHome,
      quotaDraw: matches.quotaDraw,
      quotaAway: matches.quotaAway,
    })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    )
    .orderBy(matches.kickoffTime);
  
  console.log(`Found ${finishedMatches.length} finished matches to rescore.\n`);
  
  if (finishedMatches.length === 0) {
    console.log('No finished matches found. Nothing to do.');
    process.exit(0);
  }
  
  let successCount = 0;
  let errorCount = 0;
  let quotaChanges = 0;
  
  for (const match of finishedMatches) {
    try {
      const oldQuotas = `H:${match.quotaHome ?? 'null'} D:${match.quotaDraw ?? 'null'} A:${match.quotaAway ?? 'null'}`;
      
      // Rescore the match (this recalculates quotas and updates all predictions)
      await scorePredictionsForMatch(
        match.id,
        match.homeScore!,
        match.awayScore!
      );
      
      // Get updated match to compare quotas
      const updatedMatch = await db
        .select({
          quotaHome: matches.quotaHome,
          quotaDraw: matches.quotaDraw,
          quotaAway: matches.quotaAway,
        })
        .from(matches)
        .where(eq(matches.id, match.id))
        .limit(1);
      
      const newQuotas = updatedMatch[0];
      const newQuotasStr = `H:${newQuotas.quotaHome ?? 'null'} D:${newQuotas.quotaDraw ?? 'null'} A:${newQuotas.quotaAway ?? 'null'}`;
      
      // Check if quotas changed
      const quotasChanged = 
        match.quotaHome !== newQuotas.quotaHome ||
        match.quotaDraw !== newQuotas.quotaDraw ||
        match.quotaAway !== newQuotas.quotaAway;
      
      if (quotasChanged) {
        quotaChanges++;
        console.log(`✓ ${match.homeTeam} vs ${match.awayTeam} (${match.homeScore}-${match.awayScore})`);
        console.log(`  Old quotas: ${oldQuotas}`);
        console.log(`  New quotas: ${newQuotasStr}`);
      }
      
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`✗ Error rescoring ${match.homeTeam} vs ${match.awayTeam}:`, error);
    }
  }
  
  console.log('\n=== RESCORE SUMMARY ===');
  console.log(`Total matches: ${finishedMatches.length}`);
  console.log(`Successfully rescored: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Matches with quota changes: ${quotaChanges}`);
  
  console.log('\nDone!');
  process.exit(0);
}

rescoreAllMatches().catch(console.error);
