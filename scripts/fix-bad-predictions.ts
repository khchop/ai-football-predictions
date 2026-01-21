/**
 * One-time script to fix predictions with unrealistic scores (like 2026-1).
 * Deletes predictions where home or away score > 20.
 * 
 * Run with: npx tsx scripts/fix-bad-predictions.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, predictions } from '../src/lib/db/index';
import { gt, or } from 'drizzle-orm';

async function fixBadPredictions() {
  const db = getDb();
  
  // Find predictions with unrealistic scores
  const badPredictions = await db
    .select()
    .from(predictions)
    .where(
      or(
        gt(predictions.predictedHomeScore, 20),
        gt(predictions.predictedAwayScore, 20)
      )
    );
  
  console.log(`Found ${badPredictions.length} predictions with unrealistic scores:`);
  
  for (const pred of badPredictions) {
    console.log(`  - Model: ${pred.modelId}, Match: ${pred.matchId}, Score: ${pred.predictedHomeScore}-${pred.predictedAwayScore}`);
  }
  
  if (badPredictions.length > 0) {
    // Delete bad predictions - they'll be regenerated next time if the match hasn't started
    await db
      .delete(predictions)
      .where(
        or(
          gt(predictions.predictedHomeScore, 20),
          gt(predictions.predictedAwayScore, 20)
        )
      );
    
    console.log(`\nDeleted ${badPredictions.length} bad predictions.`);
  } else {
    console.log('\nNo bad predictions found.');
  }
  
  console.log('\nDone!');
  process.exit(0);
}

fixBadPredictions().catch(console.error);
