import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { upsertMatch, upsertCompetition } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow in development without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }
  
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Fetching upcoming fixtures...');
    
    // Fetch fixtures for the next 36 hours
    const fixturesByCompetition = await getUpcomingFixtures(36);
    
    let totalFixtures = 0;
    let savedFixtures = 0;
    const errors: string[] = [];

    for (const { competition, fixtures } of fixturesByCompetition) {
      // Ensure competition exists in DB
      await upsertCompetition({
        id: competition.id,
        name: competition.name,
        apiFootballId: competition.apiFootballId,
        season: competition.season,
        active: true,
      });

      for (const fixture of fixtures) {
        totalFixtures++;
        
        try {
          await upsertMatch({
            id: uuidv4(),
            externalId: String(fixture.fixture.id),
            competitionId: competition.id,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            homeTeamLogo: fixture.teams.home.logo,
            awayTeamLogo: fixture.teams.away.logo,
            kickoffTime: fixture.fixture.date,
            homeScore: fixture.goals.home,
            awayScore: fixture.goals.away,
            status: mapFixtureStatus(fixture.fixture.status.short),
            round: fixture.league.round,
            venue: fixture.fixture.venue.name,
          });
          savedFixtures++;
        } catch (error) {
          const errorMsg = `Failed to save fixture ${fixture.fixture.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`Fetched ${totalFixtures} fixtures, saved ${savedFixtures}`);

    return NextResponse.json({
      success: true,
      message: `Fetched ${totalFixtures} fixtures, saved ${savedFixtures}`,
      competitions: fixturesByCompetition.length,
      fixtures: totalFixtures,
      saved: savedFixtures,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
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
