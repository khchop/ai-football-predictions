/**
 * Admin API: Trigger League Roundup Generation
 *
 * POST /api/admin/trigger-roundups?secret=xxx
 * Triggers the weekly league roundup scan and generation for all active competitions.
 */

import { NextResponse } from 'next/server';
import { getDb, competitions } from '@/lib/db';
import { getLeagueRoundupData } from '@/lib/content/queries';
import { generateLeagueRoundup } from '@/lib/content/generator';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Simple secret check (replace with your actual secret)
  if (process.env.CRON_SECRET !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[admin/trigger-roundups] Starting manual roundup generation...');

  try {
    const db = getDb();

    // Get all active competitions
    const activeCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.active, true));

    console.log(`Found ${activeCompetitions.length} active competitions`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const results: Array<{
      competition: string;
      status: 'success' | 'skipped' | 'failed';
      week?: string;
      postId?: string;
      error?: string;
    }> = [];

    for (const competition of activeCompetitions) {
      try {
        const roundupData = await getLeagueRoundupData(competition.id);

        if (!roundupData) {
          console.log(`⏭️  Skipped: ${competition.name} - No finished matches`);
          skipCount++;
          results.push({
            competition: competition.name,
            status: 'skipped',
          });
          continue;
        }

        console.log(`📝 Generating: ${competition.name} - Week ${roundupData.week}`);

        const postId = await generateLeagueRoundup({
          ...roundupData,
          competition: competition.name,
          competitionSlug: competition.id,
          competitionId: competition.id,
        });

        console.log(`✅ Success: ${competition.name} - ${postId}`);
        successCount++;
        results.push({
          competition: competition.name,
          status: 'success',
          week: roundupData.week,
          postId,
        });

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed: ${competition.name} - ${error}`);
        failCount++;
        results.push({
          competition: competition.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: failCount === 0,
      summary: {
        total: activeCompetitions.length,
        generated: successCount,
        skipped: skipCount,
        failed: failCount,
      },
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[admin/trigger-roundups] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
