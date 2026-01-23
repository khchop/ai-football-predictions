import { APIFootballLineupsResponse } from '@/types';
import { updateMatchAnalysisLineups, getMatchAnalysisByMatchId, getMatchById } from '@/lib/db/queries';
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';

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
     const response = await fetchWithRetry(
       url.toString(),
       {
         method: 'GET',
         headers: {
           'x-apisports-key': apiKey,
         },
       },
       API_FOOTBALL_RETRY,
       API_FOOTBALL_TIMEOUT_MS,
       SERVICE_NAMES.API_FOOTBALL
     );

    if (!response.ok) {
      throw new APIError(
        `API-Football lineups error: ${response.status} ${response.statusText}`,
        response.status,
        '/fixtures/lineups'
      );
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
function formatStartingXI(startXI: Array<{ player: { name: string; pos: string } }> | null | undefined): string {
  if (!startXI || !Array.isArray(startXI)) return '';
  return startXI.map(p => p.player?.name || 'Unknown').join(', ');
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

  // Get match data to verify team order
  const matchData = await getMatchById(matchId);
  if (!matchData) {
    console.error(`[Lineups] Match ${matchId} not found in database`);
    return false;
  }

  const [lineup1, lineup2] = lineupsData.response;
  
  // Verify which lineup belongs to which team by matching team names
  // Use case-insensitive partial matching to handle name variations
  const lineup1IsHome = isTeamMatch(lineup1.team.name, matchData.match.homeTeam);
  const lineup2IsHome = isTeamMatch(lineup2.team.name, matchData.match.homeTeam);
  
  let homeLineup, awayLineup;
  
  if (lineup1IsHome && !lineup2IsHome) {
    homeLineup = lineup1;
    awayLineup = lineup2;
  } else if (lineup2IsHome && !lineup1IsHome) {
    homeLineup = lineup2;
    awayLineup = lineup1;
  } else {
    // Fallback to API order if matching is ambiguous
    console.warn(`[Lineups] Could not verify team order for match ${matchId}, using API order`);
    console.warn(`  - API teams: ${lineup1.team.name}, ${lineup2.team.name}`);
    console.warn(`  - DB teams: ${matchData.match.homeTeam}, ${matchData.match.awayTeam}`);
    homeLineup = lineup1;
    awayLineup = lineup2;
  }

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
  console.log(`  - Home (${matchData.match.homeTeam}): ${lineupData.homeFormation} (Coach: ${lineupData.homeCoach})`);
  console.log(`  - Away (${matchData.match.awayTeam}): ${lineupData.awayFormation} (Coach: ${lineupData.awayCoach})`);

  return true;
}

// Helper to match team names with fuzzy matching
function isTeamMatch(apiName: string, dbName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const apiNorm = normalize(apiName);
  const dbNorm = normalize(dbName);
  
  // Exact match after normalization
  if (apiNorm === dbNorm) return true;
  
  // One contains the other
  if (apiNorm.includes(dbNorm) || dbNorm.includes(apiNorm)) return true;
  
  // Check if significant portion matches (first 5 chars)
  if (apiNorm.length >= 5 && dbNorm.length >= 5) {
    if (apiNorm.startsWith(dbNorm.slice(0, 5)) || dbNorm.startsWith(apiNorm.slice(0, 5))) return true;
  }
  
  return false;
}

// Check if lineups are available for a match
export async function areLineupsAvailable(matchId: string): Promise<boolean> {
  const analysis = await getMatchAnalysisByMatchId(matchId);
  return analysis?.lineupsAvailable === true;
}
