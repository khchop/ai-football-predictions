import { NextRequest, NextResponse } from 'next/server';
import { getMatchesPendingResults, updateMatchResult } from '@/lib/db/queries';
import { getFinishedFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import { scorePredictionsForMatch } from '@/lib/scoring/score-match';

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    console.log('Updating match results...');
    
    // Get matches that might have finished (kickoff was more than 2 hours ago)
    const pendingMatches = await getMatchesPendingResults();
    
    if (pendingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches pending result updates',
        updated: 0,
      });
    }

    console.log(`Found ${pendingMatches.length} matches pending results`);

    // Get external IDs to fetch
    const externalIds = pendingMatches
      .filter(m => m.externalId)
      .map(m => parseInt(m.externalId!, 10));

    if (externalIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches with external IDs to update',
        updated: 0,
      });
    }

    // Fetch results from API-Football
    const fixtures = await getFinishedFixtures(externalIds);
    
    let updated = 0;
    const errors: string[] = [];

    // Create a map for quick lookup
    const fixtureMap = new Map(
      fixtures.map(f => [String(f.fixture.id), f])
    );

    for (const match of pendingMatches) {
      if (!match.externalId) continue;

      const fixture = fixtureMap.get(match.externalId);
      if (!fixture) {
        console.log(`No fixture data found for ${match.externalId}`);
        continue;
      }

      const newStatus = mapFixtureStatus(fixture.fixture.status.short);
      
      // Only update if we have final scores or status changed
      if (
        fixture.goals.home !== null && 
        fixture.goals.away !== null &&
        (newStatus === 'finished' || newStatus !== match.status)
      ) {
        try {
          await updateMatchResult(
            match.id,
            fixture.goals.home,
            fixture.goals.away,
            newStatus
          );
          updated++;
          console.log(
            `Updated ${match.homeTeam} vs ${match.awayTeam}: ` +
            `${fixture.goals.home}-${fixture.goals.away} (${newStatus})`
          );

          // If match is finished, calculate scores for all predictions
          if (newStatus === 'finished') {
            await scorePredictionsForMatch(
              match.id,
              fixture.goals.home,
              fixture.goals.away
            );
          }
        } catch (error) {
          const errorMsg = `Failed to update match ${match.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`Updated ${updated} matches`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} of ${pendingMatches.length} pending matches`,
      pending: pendingMatches.length,
      fetched: fixtures.length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error updating results:', error);
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
