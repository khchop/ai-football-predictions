/**
 * Redis caching infrastructure
 * Supports both direct Redis connection and Upstash REST API
 */

import Redis from 'ioredis';
import { loggers } from '@/lib/logger/modules';

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
     loggers.cache.warn('REDIS_URL not configured - caching disabled');
     return null;
   }

   try {
     redisClient = new Redis(redisUrl, {
       maxRetriesPerRequest: 3,
       retryStrategy(times) {
         if (times > 3) {
           loggers.cache.error({retries: times}, 'Redis connection failed after retries');
           return null; // Stop retrying
         }
         return Math.min(times * 200, 2000); // Exponential backoff
       },
       lazyConnect: true,
     });

     redisClient.on('error', (err) => {
       loggers.cache.error({ error: err.message }, 'Redis error');
     });

     redisClient.on('connect', () => {
       loggers.cache.info('Redis connected');
     });

     return redisClient;
   } catch (error) {
     loggers.cache.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create Redis client');
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
     loggers.cache.info('Redis connection closed');
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
  
  // Team data caches (for optimization)
  TEAM_STATS: 21600,           // 6 hours - team statistics don't change during match day
  H2H: 604800,                 // 7 days - historical H2H data is static
  ODDS_BATCH: 600,             // 10 minutes - pre-match odds for betting
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
     loggers.cache.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Error getting cache value');
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
     loggers.cache.error({ key, ttl: ttlSeconds, error: error instanceof Error ? error.message : String(error) }, 'Error setting cache value');
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
     loggers.cache.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Error deleting cache value');
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
     loggers.cache.error({ pattern, error: error instanceof Error ? error.message : String(error) }, 'Error deleting cache pattern');
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
  
  // Team data (for optimization)
  teamStats: (teamId: number, leagueId: number, season: string) => 
    `api:team-stats:${teamId}:${leagueId}:${season}`,
  h2h: (teamId1: number, teamId2: number) => 
    `api:h2h:${Math.min(teamId1, teamId2)}:${Math.max(teamId1, teamId2)}`,
  oddsBatch: (fixtureId: number) => `api:odds:batch:${fixtureId}`,
  allModelHealth: () => 'db:models:health:all',
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
     
     loggers.cache.debug({ matchId }, 'Invalidated match caches');
   } catch (error) {
     loggers.cache.error({ matchId, error: error instanceof Error ? error.message : String(error) }, 'Error invalidating match caches');
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
