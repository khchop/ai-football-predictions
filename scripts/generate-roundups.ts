/**
 * Manual League Roundup Generation Script
 *
 * Generates league roundups for all active competitions with finished matches.
 * Run this to generate weekly roundups when the scheduled job isn't working.
 *
 * Usage: npx tsx scripts/generate-roundups.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, competitions } from '../src/lib/db';
import { getLeagueRoundupData } from '../src/lib/content/queries';
import { generateLeagueRoundup } from '../src/lib/content/generator';
import { loggers } from '@/lib/logger/modules';

async function generateRoundups() {
  console.log('🔄 [Generate Roundups] Starting manual generation...\n');

  if (!process.env.DATABASE_URL) {
    console.log('❌ ERROR: DATABASE_URL not configured');
    return;
  }

  const db = getDb();

  try {
    // Get all active competitions
    const activeCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.active, true));

    console.log(`📋 Found ${activeCompetitions.length} active competitions\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const errors: Array<{ competition: string; error: string }> = [];

    for (const competition of activeCompetitions) {
      try {
        console.log(`🏆 Processing: ${competition.name}`);

        const roundupData = await getLeagueRoundupData(competition.id);

        if (!roundupData) {
          console.log(`   ⏭️  Skipped: No finished matches for roundup`);
          skipCount++;
          continue;
        }

        console.log(`   📝 Generating roundup for Week ${roundupData.week}`);
        console.log(`   ⚽ ${roundupData.matches.length} matches found`);

        const postId = await generateLeagueRoundup({
          ...roundupData,
          competition: competition.name,
          competitionSlug: competition.slug || competition.name.toLowerCase().replace(/\s+/g, '-'),
          competitionId: competition.id,
        });

        console.log(`   ✅ Success: ${postId}`);
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
        errors.push({
          competition: competition.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log('\n✅ [Generate Roundups] Complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Generated: ${successCount} roundups`);
    console.log(`   - Skipped: ${skipCount} (no matches)`);
    console.log(`   - Failed: ${failCount}`);

    if (errors.length > 0) {
      console.log(`\n❌ Errors:`);
      for (const { competition, error } of errors) {
        console.log(`   - ${competition}: ${error}`);
      }
    }

    process.exit(failCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ [Generate Roundups] Failed:', error);
    process.exit(1);
  }
}

import { eq } from 'drizzle-orm';

generateRoundups();
