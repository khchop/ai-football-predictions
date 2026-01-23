import { APIFootballLineupsResponse } from '@/types';
import { updateMatchAnalysisLineups, getMatchAnalysisByMatchId, getMatchById } from '@/lib/db/queries';
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';
import { loggers } from '@/lib/logger/modules';

const log = loggers.lineups;

const API_BASE_URL = 'https://v3.football.api-sports.io';

// Fetch lineups from API-Football
export async function fetchLineups(fixtureId: number): Promise<APIFootballLineupsResponse | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = new URL(`${API_BASE_URL}/fixtures/lineups`);
  url.searchParams.append('fixture', String(fixtureId));

   log.info({ url: url.toString() }, 'Fetching');

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
       log.error({ errors: data.errors }, 'API Errors');
     }
     
     log.info({ results: data.results || 0 }, 'Results');

     // If no lineups available yet, return null
     if (!data.response || data.response.length === 0) {
       log.info({ fixtureId }, 'No lineups available yet');
       return null;
     }

    return data;
   } catch (error) {
     log.error({ fixtureId, error }, 'Error fetching lineups');
     return null;
   }
}

// Extract starting XI player names as a simple string
// Filters out null elements and safely accesses player names
function formatStartingXI(startXI: Array<{ player: { name: string; pos: string } }> | null | undefined): string {
  if (!startXI || !Array.isArray(startXI)) return '';
  return startXI
    .filter(p => p && p.player && p.player.name) // Filter out null/undefined elements
    .map(p => p.player.name)
    .join(', ');
}

// Update match analysis with lineup data
export async function updateMatchLineups(
  matchId: string,
  fixtureId: number
): Promise<boolean> {
   log.info({ matchId, fixtureId }, 'Fetching lineups');

  const lineupsData = await fetchLineups(fixtureId);
  
   if (!lineupsData?.response || lineupsData.response.length < 2) {
      log.info({ matchId, length: lineupsData?.response?.length }, 'Lineups not available yet');
      return false;
    }

    // Get match data to verify team order
    const matchData = await getMatchById(matchId);
    if (!matchData) {
      log.error({ matchId }, 'Match not found in database');
      return false;
    }

   // Safely access first two lineups (already checked length >= 2)
   const lineup1 = lineupsData.response[0];
   const lineup2 = lineupsData.response[1];
   
   // Validate lineup data has required fields
   if (!lineup1?.team?.name || !lineup2?.team?.name) {
     log.error({ matchId, hasLineup1: !!lineup1, hasLineup2: !!lineup2 }, 'Lineup data missing team information');
     return false;
   }
   
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
     log.warn({ matchId, apiTeams: `${lineup1.team.name}, ${lineup2.team.name}`, dbTeams: `${matchData.match.homeTeam}, ${matchData.match.awayTeam}` }, 'Could not verify team order, using API order');
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
   
   log.info({ matchId }, 'Stored lineups');
   log.info({ 
     team: matchData.match.homeTeam, 
     formation: lineupData.homeFormation, 
     coach: lineupData.homeCoach 
   }, 'Home');
   log.info({ 
     team: matchData.match.awayTeam, 
     formation: lineupData.awayFormation, 
     coach: lineupData.awayCoach 
   }, 'Away');

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
