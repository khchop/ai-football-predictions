/**
 * Regenerate Blog Posts Script
 *
 * Clears all existing blog posts and regenerates league roundups for all active competitions.
 *
 * Usage: npm run regenerate-blog [--no-delete] [--dry-run]
 *   --no-delete  Skip deletion step, only generate new posts
 *   --dry-run    Show what would be done without executing
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, blogPosts, competitions } from '../src/lib/db';
import { getLeagueRoundupData } from '../src/lib/content/queries';
import { generateLeagueRoundup } from '../src/lib/content/generator';
import { eq, count } from 'drizzle-orm';

async function regenerateBlogPosts() {
  const args = process.argv.slice(2);
  const noDelete = args.includes('--no-delete');
  const dryRun = args.includes('--dry-run');

  console.log('\n📝 [Regenerate Blog Posts] Starting...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const db = getDb();

  try {
    // Step 1: Count existing blog posts
    const existingCount = await db.select({ count: count() }).from(blogPosts);
    console.log(`📊 Found ${existingCount[0].count} existing blog posts\n`);

    // Step 2: Delete existing blog posts (unless --no-delete)
    if (!noDelete) {
      console.log('🗑️  Deleting existing blog posts...');
      if (!dryRun) {
        await db.delete(blogPosts);
        console.log('   ✅ All blog posts deleted\n');
      } else {
        console.log('   [DRY RUN] Would delete all blog posts\n');
      }
    } else {
      console.log('⏭️  Skipping deletion (--no-delete flag)\n');
    }

    // Step 3: Get all active competitions
    const activeCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.active, true));

    console.log(`🏆 Found ${activeCompetitions.length} active competitions\n`);
    console.log('🚀 Starting league roundup generation...\n');

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const competition of activeCompetitions) {
      try {
        const roundupData = await getLeagueRoundupData(competition.id);

        if (!roundupData) {
          console.log(`   ⏭️  ${competition.name} - No finished matches, skipped`);
          skipCount++;
          continue;
        }

        console.log(`   📝 ${competition.name} - Week ${roundupData.week}...`);

        if (!dryRun) {
          const postId = await generateLeagueRoundup({
            ...roundupData,
            competition: competition.name,
            competitionSlug: competition.slug || competition.name.toLowerCase().replace(/\s+/g, '-'),
            competitionId: competition.id,
          });
          console.log(`      ✅ Created: ${postId}`);
        } else {
          console.log(`      [DRY RUN] Would generate roundup`);
        }

        successCount++;

        // Delay to avoid rate limiting (Together AI: 30 req/min)
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`   ❌ ${competition.name} - Error: ${error}`);
        failCount++;
      }
    }

    // Summary
    console.log('\n✅ [Regenerate Blog Posts] Complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Competitions processed: ${activeCompetitions.length}`);
    console.log(`   - Roundups generated: ${successCount}`);
    console.log(`   - Skipped (no data): ${skipCount}`);
    console.log(`   - Failed: ${failCount}`);

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
    }

    console.log('');
    process.exit(failCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ [Regenerate Blog Posts] Failed:', error);
    process.exit(1);
  }
}

// Help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run regenerate-blog [options]

Options:
  --no-delete   Skip deletion step, only generate new posts
  --dry-run     Show what would be done without executing
  --help, -h    Show this help message

Examples:
  npm run regenerate-blog                  # Delete all & regenerate
  npm run regenerate-blog --no-delete      # Keep existing, add new
  npm run regenerate-blog --dry-run        # Preview changes
`);
  process.exit(0);
}

regenerateBlogPosts();
