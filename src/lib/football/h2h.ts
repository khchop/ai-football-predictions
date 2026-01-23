import { APIFootballH2HResponse } from '@/types';
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';

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

  console.log(`[H2H] Fetching: ${url.toString()}`);

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
    console.error('[H2H] API Errors:', data.errors);
  }
  
  console.log(`[H2H] Results: ${data.results || 0}`);

  return data;
}

// Fetch detailed H2H data for two teams
export async function fetchH2HDetailed(
  team1Id: number,
  team2Id: number,
  count: number = 10
): Promise<APIFootballH2HResponse | null> {
  try {
    const data = await fetchFromAPI<APIFootballH2HResponse>({
      endpoint: '/fixtures/headtohead',
      params: { 
        h2h: `${team1Id}-${team2Id}`,
        last: count
      },
    });
    return data;
  } catch (error) {
    console.error(`[H2H] Error fetching H2H for ${team1Id} vs ${team2Id}:`, error);
    return null;
  }
}

// Detailed H2H match info
export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  halftimeHome: number | null;
  halftimeAway: number | null;
}

// Extract H2H statistics
export interface H2HStatistics {
  total: number;
  homeWins: number; // Wins when first team is at home
  draws: number;
  awayWins: number; // Wins when first team is away
  matches: H2HMatch[];
}

export function extractH2HStatistics(
  h2hResponse: APIFootballH2HResponse | null,
  homeTeamId: number,
  awayTeamId: number
): H2HStatistics {
  const result: H2HStatistics = {
    total: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    matches: [],
  };

  if (!h2hResponse?.response || h2hResponse.response.length === 0) {
    return result;
  }

  result.total = h2hResponse.response.length;

  for (const match of h2hResponse.response) {
    const matchHomeScore = match.goals.home ?? 0;
    const matchAwayScore = match.goals.away ?? 0;
    const matchHomeTeamId = match.teams.home.id;

    // Determine if current home team was home in this H2H match
    const currentHomeWasHome = matchHomeTeamId === homeTeamId;

    // Count wins from perspective of current home team
    if (matchHomeScore > matchAwayScore) {
      if (currentHomeWasHome) {
        result.homeWins++;
      } else {
        result.awayWins++;
      }
    } else if (matchAwayScore > matchHomeScore) {
      if (currentHomeWasHome) {
        result.awayWins++;
      } else {
        result.homeWins++;
      }
    } else {
      result.draws++;
    }

    // Store match details (take first 10)
    if (result.matches.length < 10) {
      result.matches.push({
        date: match.fixture.date,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        homeScore: matchHomeScore,
        awayScore: matchAwayScore,
        halftimeHome: match.score.halftime.home,
        halftimeAway: match.score.halftime.away,
      });
    }
  }

  return result;
}
