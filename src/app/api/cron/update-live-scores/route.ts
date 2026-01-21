import { NextRequest, NextResponse } from 'next/server';
import { updateMatchResult } from '@/lib/db/queries';
import { getDb, matches } from '@/lib/db';
import { eq, and, or, gte, lte, inArray } from 'drizzle-orm';
import { getLiveFixtures, mapFixtureStatus, formatMatchMinute } from '@/lib/football/api-football';
import { COMPETITIONS } from '@/lib/football/competitions';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import { scorePredictionsForMatch } from '@/lib/scoring/score-match';

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const now = new Date();
    
    // Smart polling: Check if any matches could possibly be live before calling API
    // A match could be live if:
    // - Already marked as 'live' in our DB
    // - Kickoff was within last 3 hours (match + extra time + delays)
    // - Kickoff is in next 5 minutes (about to start)
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
    
    const potentiallyLiveMatches = await db
      .select({ id: matches.id, status: matches.status, kickoffTime: matches.kickoffTime })
      .from(matches)
      .where(
        or(
          eq(matches.status, 'live'),
          and(
            eq(matches.status, 'scheduled'),
            gte(matches.kickoffTime, threeHoursAgo.toISOString()),
            lte(matches.kickoffTime, fiveMinutesAhead.toISOString())
          )
        )
      );
    
    // If no matches could possibly be live, skip the API call entirely
    if (potentiallyLiveMatches.length === 0) {
      console.log('[Live Scores] No matches in live window - skipping API call');
      return NextResponse.json({
        success: true,
        message: 'No matches in live window - API call skipped',
        liveCount: 0,
        updated: 0,
        finished: 0,
        apiCallSkipped: true,
      });
    }
    
    console.log(`[Live Scores] ${potentiallyLiveMatches.length} matches in live window, fetching from API...`);
    
    // Single API call to get all live fixtures
    const liveFixtures = await getLiveFixtures();
    
    if (liveFixtures.length === 0) {
      console.log('[Live Scores] No live fixtures found');
      return NextResponse.json({
        success: true,
        message: 'No live fixtures',
        liveCount: 0,
        updated: 0,
        finished: 0,
      });
    }

    console.log(`[Live Scores] Found ${liveFixtures.length} live fixtures globally`);

    // Filter to only our tracked competitions
    const trackedCompetitionIds = new Set(COMPETITIONS.map(c => c.apiFootballId));
    const relevantFixtures = liveFixtures.filter(f => trackedCompetitionIds.has(f.league.id));
    
    console.log(`[Live Scores] ${relevantFixtures.length} fixtures in tracked competitions`);

    if (relevantFixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No live fixtures in tracked competitions',
        liveCount: 0,
        updated: 0,
        finished: 0,
      });
    }

    // Get our matches that might be live (by external ID)
    const externalIds = relevantFixtures.map(f => String(f.fixture.id));
    
    const ourMatches = await db
      .select()
      .from(matches)
      .where(inArray(matches.externalId, externalIds));

    // Create lookup map
    const matchByExternalId = new Map(ourMatches.map(m => [m.externalId, m]));

    let updated = 0;
    let finished = 0;
    const errors: string[] = [];

    for (const fixture of relevantFixtures) {
      const externalId = String(fixture.fixture.id);
      const ourMatch = matchByExternalId.get(externalId);
      
      if (!ourMatch) {
        // Match not in our database - skip
        continue;
      }

      try {
        const newStatus = mapFixtureStatus(fixture.fixture.status.short);
        const matchMinute = formatMatchMinute(fixture.fixture.status);
        const homeScore = fixture.goals.home ?? 0;
        const awayScore = fixture.goals.away ?? 0;

        // Check if anything changed
        const statusChanged = newStatus !== ourMatch.status;
        const scoreChanged = homeScore !== ourMatch.homeScore || awayScore !== ourMatch.awayScore;
        const minuteChanged = matchMinute !== ourMatch.matchMinute;

        if (statusChanged || scoreChanged || minuteChanged) {
          await updateMatchResult(
            ourMatch.id,
            homeScore,
            awayScore,
            newStatus,
            matchMinute
          );
          updated++;

          console.log(
            `[Live Scores] Updated ${ourMatch.homeTeam} vs ${ourMatch.awayTeam}: ` +
            `${homeScore}-${awayScore} (${matchMinute}, ${newStatus})`
          );

          // If match just finished, score predictions
          if (newStatus === 'finished' && ourMatch.status !== 'finished') {
            finished++;
            console.log(`[Live Scores] Match finished! Scoring predictions...`);
            await scorePredictionsForMatch(ourMatch.id, homeScore, awayScore);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to update match ${ourMatch.id}: ${error}`;
        console.error(`[Live Scores] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[Live Scores] Updated ${updated} matches, ${finished} finished`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} live matches, ${finished} just finished`,
      liveCount: relevantFixtures.length,
      updated,
      finished,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Live Scores] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
