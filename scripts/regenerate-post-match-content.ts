/**
 * Regenerate Post-Match Content Script
 * 
 * Regenerates post-match content for finished matches to use actual model names
 * instead of generic "Model 1", "Model 2" references.
 * 
 * Usage: npm run regenerate-content [--match-id=xxx] [--all] [--recent=N]
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, matches } from '../src/lib/db';
import { generatePostMatchContent } from '../src/lib/content/match-content';
import { eq, desc } from 'drizzle-orm';

async function regenerateContent() {
  const args = process.argv.slice(2);
  const matchIdArg = args.find(arg => arg.startsWith('--match-id='));
  const allFlag = args.includes('--all');
  const recentArg = args.find(arg => arg.startsWith('--recent='));
  
  console.log('\n🔄 [Regenerate Content] Starting...\n');
  
  const db = getDb();
  
  try {
    let matchesToProcess: Array<{ id: string; homeTeam: string; awayTeam: string }> = [];
    
    // Determine which matches to process
    if (matchIdArg) {
      // Single match by ID
      const matchId = matchIdArg.split('=')[1];
      const match = await db
        .select({
          id: matches.id,
          homeTeam: matches.homeTeam,
          awayTeam: matches.awayTeam,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);
      
      if (match.length === 0) {
        console.error(`❌ Match not found: ${matchId}`);
        process.exit(1);
      }
      
      matchesToProcess = match;
      console.log(`📋 Processing 1 match: ${match[0].homeTeam} vs ${match[0].awayTeam}`);
    } else if (allFlag) {
      // All finished matches
      const allMatches = await db
        .select({
          id: matches.id,
          homeTeam: matches.homeTeam,
          awayTeam: matches.awayTeam,
        })
        .from(matches)
        .where(eq(matches.status, 'finished'))
        .orderBy(desc(matches.kickoffTime));
      
      matchesToProcess = allMatches;
      console.log(`📋 Processing all ${allMatches.length} finished matches`);
    } else if (recentArg) {
      // Recent N matches
      const count = parseInt(recentArg.split('=')[1]);
      const recentMatches = await db
        .select({
          id: matches.id,
          homeTeam: matches.homeTeam,
          awayTeam: matches.awayTeam,
        })
        .from(matches)
        .where(eq(matches.status, 'finished'))
        .orderBy(desc(matches.kickoffTime))
        .limit(count);
      
      matchesToProcess = recentMatches;
      console.log(`📋 Processing ${recentMatches.length} recent finished matches`);
    } else {
      // Default: last 10 matches
      const recentMatches = await db
        .select({
          id: matches.id,
          homeTeam: matches.homeTeam,
          awayTeam: matches.awayTeam,
        })
        .from(matches)
        .where(eq(matches.status, 'finished'))
        .orderBy(desc(matches.kickoffTime))
        .limit(10);
      
      matchesToProcess = recentMatches;
      console.log(`📋 Processing last ${recentMatches.length} finished matches (default)`);
    }
    
    if (matchesToProcess.length === 0) {
      console.log('⚠️  No matches to process');
      process.exit(0);
    }
    
    console.log('\n🚀 Starting regeneration...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const match of matchesToProcess) {
      try {
        console.log(`  🔄 ${match.homeTeam} vs ${match.awayTeam}...`);
        const success = await generatePostMatchContent(match.id);
        
        if (success) {
          console.log(`  ✅ Success`);
          successCount++;
        } else {
          console.log(`  ❌ Failed (check logs for details)`);
          failCount++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failCount++;
      }
    }
    
    console.log('\n✅ [Regenerate Content] Complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Success: ${successCount} matches`);
    console.log(`   - Failed: ${failCount} matches`);
    console.log(`   - Total: ${matchesToProcess.length} matches\n`);
    
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ [Regenerate Content] Failed:', error);
    process.exit(1);
  }
}

// Usage help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run regenerate-content [options]

Options:
  --match-id=xxx    Regenerate content for a specific match
  --all             Regenerate content for ALL finished matches
  --recent=N        Regenerate content for the N most recent finished matches
  --help, -h        Show this help message

Examples:
  npm run regenerate-content                      # Last 10 matches (default)
  npm run regenerate-content --recent=20          # Last 20 matches
  npm run regenerate-content --all                # All finished matches
  npm run regenerate-content --match-id=abc123    # Specific match
  `);
  process.exit(0);
}

// Run the script
regenerateContent();
