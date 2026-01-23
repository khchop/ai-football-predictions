/**
 * Centralized API-Football client with caching and retry logic
 * All external API calls should go through this module
 */

import { fetchWithRetry, APIError, RateLimitError } from '@/lib/utils/api-client';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
import { API_FOOTBALL_RETRY, API_FOOTBALL_TIMEOUT_MS, SERVICE_NAMES } from '@/lib/utils/retry-config';

const API_BASE_URL = 'https://v3.football.api-sports.io';

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string | number>;
}

/**
 * Core fetch function for API-Football with retry logic
 * Does NOT include caching - use the cached wrappers below
 */
export async function fetchFromAPIFootball<T>({ endpoint, params }: FetchOptions): Promise<T> {
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
    API_FOOTBALL_RETRY,
    API_FOOTBALL_TIMEOUT_MS,
    SERVICE_NAMES.API_FOOTBALL
  );

  // Parse rate limit headers for logging
  const remaining = response.headers.get('x-ratelimit-requests-remaining');
  if (remaining) {
    console.log(`[API-Football] Rate limit remaining: ${remaining}`);
  }

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
    const errorMsg = Object.values(data.errors).join(', ');
    
    // Detect rate limit errors
    if (errorMsg.toLowerCase().includes('rate limit') || 
        errorMsg.toLowerCase().includes('too many requests') ||
        errorMsg.toLowerCase().includes('exceeded the limit')) {
      throw new RateLimitError(
        `API-Football rate limit exceeded: ${errorMsg}`,
        endpoint,
        60 // Suggest retry after 60 seconds
      );
    }
    
    throw new APIError(`API-Football API error: ${errorMsg}`, undefined, endpoint);
  }
  
  console.log(`[API-Football] Results: ${data.results || 0}`);

  return data;
}

// ============================================================================
// CACHED API WRAPPERS
// ============================================================================

import type { 
  APIFootballResponse, 
  APIFootballPredictionResponse,
  APIFootballInjuryResponse,
  APIFootballOddsResponse,
  APIFootballLineupsResponse 
} from '@/types';

/**
 * Fetch fixtures for a date with caching
 */
export async function fetchFixturesByDate(date: string): Promise<APIFootballResponse> {
  return withCache(
    cacheKeys.fixtures(date),
    CACHE_TTL.FIXTURES_SCHEDULED,
    () => fetchFromAPIFootball<APIFootballResponse>({
      endpoint: '/fixtures',
      params: { date },
    })
  );
}

/**
 * Fetch a single fixture by ID with caching
 * Uses shorter TTL for live matches
 */
export async function fetchFixtureById(fixtureId: number, isLive = false): Promise<APIFootballResponse> {
  return withCache(
    cacheKeys.fixtureById(fixtureId),
    isLive ? CACHE_TTL.FIXTURES_LIVE : CACHE_TTL.FIXTURES_SCHEDULED,
    () => fetchFromAPIFootball<APIFootballResponse>({
      endpoint: '/fixtures',
      params: { id: fixtureId },
    })
  );
}

/**
 * Fetch predictions for a fixture with caching
 */
export async function fetchPrediction(fixtureId: number): Promise<APIFootballPredictionResponse | null> {
  try {
    return await withCache(
      cacheKeys.prediction(fixtureId),
      CACHE_TTL.PREDICTIONS,
      () => fetchFromAPIFootball<APIFootballPredictionResponse>({
        endpoint: '/predictions',
        params: { fixture: fixtureId },
      })
    );
  } catch (error) {
    console.error(`[API-Football] Error fetching prediction for fixture ${fixtureId}:`, error);
    return null;
  }
}

/**
 * Fetch injuries for a fixture with caching
 */
export async function fetchInjuries(fixtureId: number): Promise<APIFootballInjuryResponse | null> {
  try {
    return await withCache(
      cacheKeys.injuries(fixtureId),
      CACHE_TTL.INJURIES,
      () => fetchFromAPIFootball<APIFootballInjuryResponse>({
        endpoint: '/injuries',
        params: { fixture: fixtureId },
      })
    );
  } catch (error) {
    console.error(`[API-Football] Error fetching injuries for fixture ${fixtureId}:`, error);
    return null;
  }
}

/**
 * Fetch odds for a fixture with caching
 */
export async function fetchOdds(fixtureId: number): Promise<APIFootballOddsResponse | null> {
  try {
    return await withCache(
      cacheKeys.odds(fixtureId),
      CACHE_TTL.ODDS,
      () => fetchFromAPIFootball<APIFootballOddsResponse>({
        endpoint: '/odds',
        params: { fixture: fixtureId },
      })
    );
  } catch (error) {
    console.error(`[API-Football] Error fetching odds for fixture ${fixtureId}:`, error);
    return null;
  }
}

/**
 * Fetch lineups for a fixture with caching
 */
export async function fetchLineups(fixtureId: number): Promise<APIFootballLineupsResponse | null> {
  try {
    return await withCache(
      cacheKeys.lineups(fixtureId),
      CACHE_TTL.LINEUPS,
      () => fetchFromAPIFootball<APIFootballLineupsResponse>({
        endpoint: '/fixtures/lineups',
        params: { fixture: fixtureId },
      })
    );
  } catch (error) {
    console.error(`[API-Football] Error fetching lineups for fixture ${fixtureId}:`, error);
    return null;
  }
}

/**
 * Fetch standings for a league with caching
 */
export async function fetchStandings(leagueId: number, season: number): Promise<unknown> {
  return withCache(
    cacheKeys.standings(leagueId, season),
    CACHE_TTL.STANDINGS,
    () => fetchFromAPIFootball({
      endpoint: '/standings',
      params: { league: leagueId, season },
    })
  );
}

/**
 * Fetch live fixtures (no caching - always fresh)
 */
export async function fetchLiveFixtures(): Promise<APIFootballResponse> {
  return fetchFromAPIFootball<APIFootballResponse>({
    endpoint: '/fixtures',
    params: { live: 'all' },
  });
}

/**
 * Fetch multiple fixtures by IDs (for batch operations)
 * No caching as this is typically for fresh result updates
 */
export async function fetchFixturesByIds(fixtureIds: number[]): Promise<APIFootballResponse> {
  if (fixtureIds.length === 0) {
    return { response: [], results: 0 } as unknown as APIFootballResponse;
  }
  
  return fetchFromAPIFootball<APIFootballResponse>({
    endpoint: '/fixtures',
    params: { ids: fixtureIds.join('-') },
  });
}
