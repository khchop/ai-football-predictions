import { APIFootballFixture, APIFootballResponse } from '@/types';
import { COMPETITIONS, CompetitionConfig } from './competitions';
import { fetchWithRetry, sleep, APIError } from '@/lib/utils/api-client';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';
import { loggers } from '@/lib/logger/modules';

const log = loggers.apiFootball;

const API_BASE_URL = 'https://v3.football.api-sports.io';
const RATE_LIMIT_DELAY_MS = 300;

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

  // Log endpoint and safe params only (not full URL to avoid exposing sensitive data)
  const safeParams = params ? Object.fromEntries(
    Object.entries(params).filter(([key]) => 
      !['apiKey', 'key', 'token', 'secret', 'auth'].includes(key.toLowerCase())
    )
  ) : undefined;
  log.info({ endpoint, params: safeParams }, 'Fetching from API-Football');

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
     // Throw on API-level errors instead of silently continuing
     const errorMsg = Object.values(data.errors).join(', ');
     throw new APIError(`API-Football API error: ${errorMsg}`, undefined, endpoint);
   }
   
   log.info({ results: data.results || 0 }, 'Results');

  return data;
}

// Fetch all fixtures for a specific date (simpler approach)
export async function getFixturesByDate(date: string): Promise<APIFootballFixture[]> {
  const data = await fetchFromAPI<APIFootballResponse>({
    endpoint: '/fixtures',
    params: {
      date: date, // YYYY-MM-DD format
    },
  });

  return data.response || [];
}

// Fetch fixtures for a specific league and date range
export async function getFixtures(
  competition: CompetitionConfig,
  fromDate: string,
  toDate: string
): Promise<APIFootballFixture[]> {
  const data = await fetchFromAPI<APIFootballResponse>({
    endpoint: '/fixtures',
    params: {
      league: competition.apiFootballId,
      from: fromDate,
      to: toDate,
    },
  });

  return data.response || [];
}

// Fetch fixtures for today and tomorrow for our tracked competitions
export async function getUpcomingFixtures(
  hoursAhead: number = 48
): Promise<{ competition: CompetitionConfig; fixtures: APIFootballFixture[] }[]> {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  // Get unique dates to fetch
  const dates = new Set<string>();
  const current = new Date(now);
  while (current <= future) {
    dates.add(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

   log.info({ dates: [...dates].join(', ') }, 'Fetching fixtures for dates');

  // Process fixtures by competition to avoid loading all into memory at once
  // Group by competition first, then fetch to enable batch processing
  const results: { competition: CompetitionConfig; fixtures: APIFootballFixture[] }[] = [];
  const competitionFixtures = new Map<number, APIFootballFixture[]>();
  
  for (const competition of COMPETITIONS) {
    competitionFixtures.set(competition.apiFootballId, []);
  }
  
  // Fetch and process fixtures per date to reduce peak memory usage
  let totalFetched = 0;
  for (const date of dates) {
    try {
      const fixtures = await getFixturesByDate(date);
      totalFetched += fixtures.length;
      
      // Process and categorize immediately instead of accumulating
      for (const fixture of fixtures) {
        const competitionId = fixture.league.id;
        if (competitionFixtures.has(competitionId)) {
          const fixtures = competitionFixtures.get(competitionId);
          if (fixtures) {
            fixtures.push(fixture);
          }
        }
      }
      
      // Rate limit delay between requests
      await sleep(RATE_LIMIT_DELAY_MS);
     } catch (error) {
       log.error({ date, error }, 'Error fetching fixtures');
       // Continue with other dates instead of failing completely
     }
  }

   log.info({ count: totalFetched }, 'Total fixtures fetched');

  // Build results from processed fixtures
  for (const competition of COMPETITIONS) {
    const fixtures = competitionFixtures.get(competition.apiFootballId) || [];
    // Filter by date range (should already be filtered by API, but just in case)
    const validFixtures = fixtures.filter(f =>
      new Date(f.fixture.date) >= now &&
      new Date(f.fixture.date) <= future
    );

     if (validFixtures.length > 0) {
       log.info({ competition: competition.name, count: validFixtures.length }, 'Fixtures');
       results.push({ competition, fixtures: validFixtures });
     }
  }

  return results;
}

// Fetch a specific fixture by ID
export async function getFixtureById(fixtureId: number): Promise<APIFootballFixture | null> {
  const data = await fetchFromAPI<APIFootballResponse>({
    endpoint: '/fixtures',
    params: {
      id: fixtureId,
    },
  });

  return data.response?.[0] || null;
}

// Fetch live fixtures (for result updates)
export async function getLiveFixtures(): Promise<APIFootballFixture[]> {
  const data = await fetchFromAPI<APIFootballResponse>({
    endpoint: '/fixtures',
    params: {
      live: 'all',
    },
  });

  return data.response || [];
}

// Fetch finished fixtures that we need to update
export async function getFinishedFixtures(fixtureIds: number[]): Promise<APIFootballFixture[]> {
  if (fixtureIds.length === 0) return [];

  const results: APIFootballFixture[] = [];
  const chunks = chunkArray(fixtureIds, 20);

  for (const chunk of chunks) {
    const data = await fetchFromAPI<APIFootballResponse>({
      endpoint: '/fixtures',
      params: {
        ids: chunk.join('-'),
      },
    });

    if (data.response) {
      results.push(...data.response);
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return results;
}

// Helper to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Map API status to our status
export function mapFixtureStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    'TBD': 'scheduled',
    'NS': 'scheduled',
    'LIVE': 'live',
    '1H': 'live',
    'HT': 'live',
    '2H': 'live',
    'ET': 'live',
    'P': 'live',
    'FT': 'finished',
    'AET': 'finished',
    'PEN': 'finished',
    'BT': 'live',
    'SUSP': 'postponed',
    'INT': 'postponed',
    'PST': 'postponed',
    'CANC': 'cancelled',
    'ABD': 'cancelled',
    'AWD': 'finished',
    'WO': 'finished',
  };

  return statusMap[apiStatus] || 'scheduled';
}

// ============= MATCH EVENTS =============

export interface MatchEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Yellow Card", "Red Card", "Substitution 1", etc.
  comments: string | null;
}

interface MatchEventsResponse {
  response: MatchEvent[];
  results: number;
}

// Fetch match events (goals, cards, substitutions) for a fixture
export async function getMatchEvents(fixtureId: number): Promise<MatchEvent[]> {
  try {
    const data = await fetchFromAPI<MatchEventsResponse>({
      endpoint: '/fixtures/events',
      params: {
        fixture: fixtureId,
      },
    });
    return data.response || [];
   } catch (error) {
     log.error({ fixtureId, error }, 'Error fetching events');
     return [];
   }
}

// Format match minute for live display (e.g., "45'", "HT", "67'", "90'+3")
export function formatMatchMinute(status: { elapsed: number | null; short: string }): string {
  switch (status.short) {
    case 'HT':
      return 'HT';
    case 'FT':
      return 'FT';
    case 'AET':
      return 'AET';
    case 'PEN':
      return 'PEN';
    case 'BT':
      return 'Break';
    case 'NS':
    case 'TBD':
      return '';
    case '1H':
      // First half: show minute, handle extra time
      if (status.elapsed && status.elapsed > 45) {
        return `45'+${status.elapsed - 45}`;
      }
      return status.elapsed ? `${status.elapsed}'` : 'LIVE';
    case '2H':
      // Second half: show minute, handle extra time  
      if (status.elapsed && status.elapsed > 90) {
        return `90'+${status.elapsed - 90}`;
      }
      return status.elapsed ? `${status.elapsed}'` : 'LIVE';
    case 'ET':
      return status.elapsed ? `ET ${status.elapsed}'` : 'ET';
    case 'P':
      return 'PEN';
    default:
      return status.elapsed ? `${status.elapsed}'` : 'LIVE';
  }
}
