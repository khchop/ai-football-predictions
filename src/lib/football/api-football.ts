import { APIFootballFixture, APIFootballResponse } from '@/types';
import { COMPETITIONS, CompetitionConfig } from './competitions';
import { fetchWithRetry, sleep, APIError } from '@/lib/utils/api-client';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_TIMEOUT_MS = 30000;
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

  console.log(`[API-Football] Fetching: ${url.toString()}`);

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
    console.error('[API-Football] API Errors:', data.errors);
    // Throw on API-level errors instead of silently continuing
    const errorMsg = Object.values(data.errors).join(', ');
    throw new APIError(`API-Football API error: ${errorMsg}`, undefined, endpoint);
  }
  
  console.log(`[API-Football] Results: ${data.results || 0}`);

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

  console.log(`[API-Football] Fetching fixtures for dates: ${[...dates].join(', ')}`);

  // Fetch all fixtures for these dates in one call per date
  const allFixtures: APIFootballFixture[] = [];
  
  for (const date of dates) {
    try {
      const fixtures = await getFixturesByDate(date);
      allFixtures.push(...fixtures);
      // Rate limit delay between requests
      await sleep(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      console.error(`[API-Football] Error fetching fixtures for ${date}:`, error);
      // Continue with other dates instead of failing completely
    }
  }

  console.log(`[API-Football] Total fixtures fetched: ${allFixtures.length}`);

  // Filter to only our tracked competitions and group by competition
  const results: { competition: CompetitionConfig; fixtures: APIFootballFixture[] }[] = [];

  for (const competition of COMPETITIONS) {
    const competitionFixtures = allFixtures.filter(f => 
      f.league.id === competition.apiFootballId &&
      new Date(f.fixture.date) >= now &&
      new Date(f.fixture.date) <= future
    );

    if (competitionFixtures.length > 0) {
      console.log(`[API-Football] ${competition.name}: ${competitionFixtures.length} fixtures`);
      results.push({ competition, fixtures: competitionFixtures });
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
    console.error(`[API-Football] Error fetching events for fixture ${fixtureId}:`, error);
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
