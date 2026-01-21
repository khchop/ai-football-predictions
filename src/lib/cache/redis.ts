/**
 * Redis caching infrastructure
 * Supports both direct Redis connection and Upstash REST API
 */

import Redis from 'ioredis';

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 * Supports both REDIS_URL and UPSTASH_REDIS_REST_URL formats
 */
export function getRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Cache] REDIS_URL not configured - caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[Cache] Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000); // Exponential backoff
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('[Cache] Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Cache] Redis connected');
    });

    return redisClient;
  } catch (error) {
    console.error('[Cache] Failed to create Redis client:', error);
    return null;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Cache] Redis connection closed');
  }
}

/**
 * Cache TTL presets (in seconds)
 */
export const CACHE_TTL = {
  // API-Football responses
  FIXTURES_LIVE: 30,           // Live match data - update frequently
  FIXTURES_SCHEDULED: 300,     // 5 minutes - scheduled fixtures rarely change
  STANDINGS: 14400,            // 4 hours - update after match days
  PREDICTIONS: 86400,          // 24 hours - static pre-match data
  ODDS: 1800,                  // 30 minutes - pre-match updates
  INJURIES: 7200,              // 2 hours - pre-match updates
  LINEUPS: 900,                // 15 minutes - announced ~1h before kickoff
  
  // Database query caches
  MODELS: 300,                 // 5 minutes - rarely changes
  COMPETITIONS: 300,           // 5 minutes - rarely changes
  LEADERBOARD: 60,             // 1 minute - revalidate frequently
  STATS: 60,                   // 1 minute - overall stats
} as const;

/**
 * Generic cache get with type safety
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.error(`[Cache] Error getting ${key}:`, error);
    return null;
  }
}

/**
 * Generic cache set with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[Cache] Error setting ${key}:`, error);
    return false;
  }
}

/**
 * Delete a cache key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[Cache] Error deleting ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple cache keys by pattern
 * Use with caution - KEYS command can be slow on large databases
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (error) {
    console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Cache key generators for consistent naming
 */
export const cacheKeys = {
  // API-Football
  fixtures: (date: string) => `api:fixtures:${date}`,
  fixtureById: (id: number) => `api:fixture:${id}`,
  standings: (leagueId: number, season: number) => `api:standings:${leagueId}:${season}`,
  prediction: (fixtureId: number) => `api:prediction:${fixtureId}`,
  odds: (fixtureId: number) => `api:odds:${fixtureId}`,
  injuries: (fixtureId: number) => `api:injuries:${fixtureId}`,
  lineups: (fixtureId: number) => `api:lineups:${fixtureId}`,
  
  // Database queries
  activeModels: () => 'db:models:active',
  activeCompetitions: () => 'db:competitions:active',
  leaderboard: (filters: string) => `db:leaderboard:${filters}`,
  overallStats: () => 'db:stats:overall',
  matchPredictions: (matchId: string) => `db:predictions:${matchId}`,
} as const;

/**
 * Invalidate caches when match finishes
 * Called from scoring logic
 */
export async function invalidateMatchCaches(matchId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // Invalidate leaderboard caches (all filter combinations)
    await cacheDeletePattern('db:leaderboard:*');
    // Invalidate overall stats
    await cacheDelete(cacheKeys.overallStats());
    // Invalidate specific match predictions
    await cacheDelete(cacheKeys.matchPredictions(matchId));
    
    console.log(`[Cache] Invalidated caches for match ${matchId}`);
  } catch (error) {
    console.error(`[Cache] Error invalidating match caches:`, error);
  }
}

/**
 * Helper to wrap a function with caching
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();
  
  // Cache the result (don't await, fire and forget)
  cacheSet(key, data, ttlSeconds).catch(() => {
    // Ignore cache errors - data is still returned
  });

  return data;
}
