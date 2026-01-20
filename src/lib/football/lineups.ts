import { APIFootballLineupsResponse } from '@/types';
import { updateMatchAnalysisLineups, getMatchAnalysisByMatchId } from '@/lib/db/queries';

const API_BASE_URL = 'https://v3.football.api-sports.io';

// Fetch lineups from API-Football
export async function fetchLineups(fixtureId: number): Promise<APIFootballLineupsResponse | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = new URL(`${API_BASE_URL}/fixtures/lineups`);
  url.searchParams.append('fixture', String(fixtureId));

  console.log(`[Lineups] Fetching: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`API-Football error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('[Lineups] API Errors:', data.errors);
    }
    
    console.log(`[Lineups] Results: ${data.results || 0}`);

    // If no lineups available yet, return null
    if (!data.response || data.response.length === 0) {
      console.log(`[Lineups] No lineups available yet for fixture ${fixtureId}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[Lineups] Error fetching lineups for fixture ${fixtureId}:`, error);
    return null;
  }
}

// Extract starting XI player names as a simple string
function formatStartingXI(startXI: Array<{ player: { name: string; pos: string } }>): string {
  return startXI.map(p => p.player.name).join(', ');
}

// Update match analysis with lineup data
export async function updateMatchLineups(
  matchId: string,
  fixtureId: number
): Promise<boolean> {
  console.log(`[Lineups] Fetching lineups for match ${matchId} (fixture ${fixtureId})`);

  const lineupsData = await fetchLineups(fixtureId);
  
  if (!lineupsData?.response || lineupsData.response.length < 2) {
    console.log(`[Lineups] Lineups not available yet for match ${matchId}`);
    return false;
  }

  // API returns an array with 2 elements: [home team lineup, away team lineup]
  const [lineup1, lineup2] = lineupsData.response;
  
  // We need to determine which is home and which is away
  // The API typically returns home first, but we should verify with existing match data
  const homeLineup = lineup1;
  const awayLineup = lineup2;

  const lineupData = {
    homeFormation: homeLineup.formation || null,
    awayFormation: awayLineup.formation || null,
    homeStartingXI: formatStartingXI(homeLineup.startXI),
    awayStartingXI: formatStartingXI(awayLineup.startXI),
    homeCoach: homeLineup.coach?.name || null,
    awayCoach: awayLineup.coach?.name || null,
    lineupsAvailable: true,
    lineupsUpdatedAt: new Date().toISOString(),
    rawLineupsData: JSON.stringify(lineupsData),
  };

  await updateMatchAnalysisLineups(matchId, lineupData);
  
  console.log(`[Lineups] Stored lineups for match ${matchId}`);
  console.log(`  - Home: ${lineupData.homeFormation} (Coach: ${lineupData.homeCoach})`);
  console.log(`  - Away: ${lineupData.awayFormation} (Coach: ${lineupData.awayCoach})`);

  return true;
}

// Check if lineups are available for a match
export async function areLineupsAvailable(matchId: string): Promise<boolean> {
  const analysis = await getMatchAnalysisByMatchId(matchId);
  return analysis?.lineupsAvailable === true;
}
