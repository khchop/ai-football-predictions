import { APIFootballTeamStatisticsResponse } from '@/types';
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_TIMEOUT_MS = 30000;

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

  console.log(`[Team Statistics] Fetching: ${url.toString()}`);

  const response = await fetchWithRetry(
    url.toString(),
    {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
    API_TIMEOUT_MS
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
    console.error('[Team Statistics] API Errors:', data.errors);
  }
  
  console.log(`[Team Statistics] Results: ${data.results || 0}`);

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
    console.error(`[Team Statistics] Error fetching stats for team ${teamId}:`, error);
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
  
  return {
    // Home/Away record
    homeWins: stats.fixtures.wins.home,
    homeDraws: stats.fixtures.draws.home,
    homeLosses: stats.fixtures.loses.home,
    awayWins: stats.fixtures.wins.away,
    awayDraws: stats.fixtures.draws.away,
    awayLosses: stats.fixtures.loses.away,
    
    // Goals
    homeGoalsFor: stats.goals.for.total.home,
    homeGoalsAgainst: stats.goals.against.total.home,
    awayGoalsFor: stats.goals.for.total.away,
    awayGoalsAgainst: stats.goals.against.total.away,
    totalGoalsFor: stats.goals.for.total.total,
    totalGoalsAgainst: stats.goals.against.total.total,
    
    // Clean sheets
    cleanSheetsHome: stats.clean_sheet.home,
    cleanSheetsAway: stats.clean_sheet.away,
    cleanSheetsTotal: stats.clean_sheet.total,
    
    // Failed to score
    failedToScoreHome: stats.failed_to_score.home,
    failedToScoreAway: stats.failed_to_score.away,
    
    // Streaks
    winStreak: stats.biggest.streak.wins,
    drawStreak: stats.biggest.streak.draws,
    loseStreak: stats.biggest.streak.loses,
    
    // Goal timing (early and late goals are tactically important)
    goalsFor0to15: stats.goals.for.minute['0-15']?.total || null,
    goalsFor76to90: stats.goals.for.minute['76-90']?.total || null,
    goalsAgainst0to15: stats.goals.against.minute['0-15']?.total || null,
    goalsAgainst76to90: stats.goals.against.minute['76-90']?.total || null,
  };
}
