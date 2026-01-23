import { APIFootballTeamStatisticsResponse } from '@/types';
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';
import { loggers } from '@/lib/logger/modules';

const log = loggers.teamStats;

const API_BASE_URL = 'https://v3.football.api-sports.io';

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string | number>;
}

async function fetchFromAPI<T>({ endpoint, params }: FetchOptions): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

   log.info({ url: url.toString() }, 'Fetching');

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
      `API-Football error: ${response.status} ${response.statusText}`,
      response.status,
      endpoint
    );
  }

  const data = await response.json();
  
   if (data.errors && Object.keys(data.errors).length > 0) {
     log.error({ errors: data.errors }, 'API Errors');
   }
   
   log.info({ results: data.results || 0 }, 'Results');

  return data;
}

// Fetch team statistics for a specific season
export async function fetchTeamStatistics(
  teamId: number,
  leagueId: number,
  season: number
): Promise<APIFootballTeamStatisticsResponse | null> {
  try {
    const data = await fetchFromAPI<APIFootballTeamStatisticsResponse>({
      endpoint: '/teams/statistics',
      params: { team: teamId, league: leagueId, season },
    });
    return data;
   } catch (error) {
     log.error({ teamId, error }, 'Error fetching stats');
     return null;
   }
}

// Extract useful statistics for predictions
export interface TeamSeasonStats {
  // Home/Away record
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  
  // Goals
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  totalGoalsFor: number;
  totalGoalsAgainst: number;
  
  // Clean sheets
  cleanSheetsHome: number;
  cleanSheetsAway: number;
  cleanSheetsTotal: number;
  
  // Failed to score
  failedToScoreHome: number;
  failedToScoreAway: number;
  
  // Streaks
  winStreak: number;
  drawStreak: number;
  loseStreak: number;
  
  // Goal timing (key periods)
  goalsFor0to15: number | null;
  goalsFor76to90: number | null;
  goalsAgainst0to15: number | null;
  goalsAgainst76to90: number | null;
}

export function extractTeamStatistics(
  statsResponse: APIFootballTeamStatisticsResponse | null
): TeamSeasonStats | null {
  if (!statsResponse?.response) {
    return null;
  }

  const stats = statsResponse.response;
  
   // Defensive null checks - API may return incomplete data on errors
   if (!stats?.fixtures || !stats?.goals || !stats?.clean_sheet || !stats?.failed_to_score || !stats?.biggest) {
     log.error({}, 'Incomplete stats response, missing required fields');
     return null;
   }
  
  return {
    // Home/Away record
    homeWins: stats.fixtures.wins?.home ?? 0,
    homeDraws: stats.fixtures.draws?.home ?? 0,
    homeLosses: stats.fixtures.loses?.home ?? 0,
    awayWins: stats.fixtures.wins?.away ?? 0,
    awayDraws: stats.fixtures.draws?.away ?? 0,
    awayLosses: stats.fixtures.loses?.away ?? 0,
    
    // Goals
    homeGoalsFor: stats.goals.for?.total?.home ?? 0,
    homeGoalsAgainst: stats.goals.against?.total?.home ?? 0,
    awayGoalsFor: stats.goals.for?.total?.away ?? 0,
    awayGoalsAgainst: stats.goals.against?.total?.away ?? 0,
    totalGoalsFor: stats.goals.for?.total?.total ?? 0,
    totalGoalsAgainst: stats.goals.against?.total?.total ?? 0,
    
    // Clean sheets
    cleanSheetsHome: stats.clean_sheet?.home ?? 0,
    cleanSheetsAway: stats.clean_sheet?.away ?? 0,
    cleanSheetsTotal: stats.clean_sheet?.total ?? 0,
    
    // Failed to score
    failedToScoreHome: stats.failed_to_score?.home ?? 0,
    failedToScoreAway: stats.failed_to_score?.away ?? 0,
    
    // Streaks
    winStreak: stats.biggest.streak?.wins ?? 0,
    drawStreak: stats.biggest.streak?.draws ?? 0,
    loseStreak: stats.biggest.streak?.loses ?? 0,
    
    // Goal timing (early and late goals are tactically important)
    goalsFor0to15: stats.goals.for?.minute?.['0-15']?.total ?? null,
    goalsFor76to90: stats.goals.for?.minute?.['76-90']?.total ?? null,
    goalsAgainst0to15: stats.goals.against?.minute?.['0-15']?.total ?? null,
    goalsAgainst76to90: stats.goals.against?.minute?.['76-90']?.total ?? null,
  };
}
