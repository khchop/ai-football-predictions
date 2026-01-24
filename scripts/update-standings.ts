import { updateAllStandings } from '../src/lib/football/standings';

/**
 * Manually update all league standings for the current season
 * 
 * This will fetch standings from API-Football and update the database.
 * Run this to refresh stale standings or populate missing season data.
 */
async function main() {
  console.log('Starting standings update for all competitions...\n');
  
  const result = await updateAllStandings();
  
  console.log('\n=== Update Complete ===');
  console.log(`Leagues processed: ${result.leagues}`);
  console.log(`Teams updated: ${result.updated}`);
  console.log(`Errors: ${result.errors}`);
  
  if (result.errors > 0) {
    console.error('\n⚠️  Some leagues failed to update. Check logs for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All standings updated successfully!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
