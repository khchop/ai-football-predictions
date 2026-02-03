/**
 * Redis caching infrastructure
 * Supports both direct Redis connection and Upstash REST API
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { connection } from 'next/server';
import { loggers } from '@/lib/logger/modules';

// Singleton Redis client
let redisClient: Redis | null = null;
let isRedisHealthy = false;
let lastHealthCheck = 0;
// Adaptive cooldown: shorter when unhealthy (5s) to detect recovery, longer when healthy (30s)
const HEALTH_CHECK_INTERVAL_HEALTHY_MS = 30000; // 30 seconds when healthy
const HEALTH_CHECK_INTERVAL_DEGRADED_MS = 5000; // 5 seconds when degraded

// Graceful degradation state
let redisUnavailableUntil = 0; // Timestamp when to retry Redis
const REDIS_UNAVAILABLE_COOLDOWN_MS = 5000; // 5 second cooldown before retry

// Sentinel value for cached null - distinguishes cache hit (null value) from cache miss
const CACHE_NULL_SENTINEL = '___CACHE_NULL___';

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
             isRedisHealthy = false;
             return null; // Stop retrying
           }
           return Math.min(times * 200, 2000); // Exponential backoff
         },
         lazyConnect: true,
         // Connection identification (helps debugging)
         connectionName: 'bettingsoccer-cache',
         // Timeouts (prevent hanging)
         connectTimeout: 10000,        // 10s connection timeout
         commandTimeout: 5000,         // 5s per command
         // Connection health
         keepAlive: 30000,             // 30s TCP keepalive
         enableReadyCheck: true,       // Verify connection before marking ready
         // Resilience
         enableOfflineQueue: true,     // Queue commands while reconnecting
         maxLoadingRetryTime: 10000,   // Max wait for loading state
       });

      redisClient.on('error', (err) => {
        isRedisHealthy = false;
        loggers.cache.error({ error: err.message }, 'Redis error');
      });

      redisClient.on('connect', () => {
        isRedisHealthy = true;
        loggers.cache.info('Redis connected');
      });

      return redisClient;
    } catch (error) {
      loggers.cache.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create Redis client');
      return null;
    }
  }

/**
 * Check if Redis is healthy (with cooldown to avoid spam checks)
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  
  const now = Date.now();
  
  // Use adaptive cooldown based on current health status
  // Shorter cooldown (5s) when degraded to detect recovery quickly
  // Longer cooldown (30s) when healthy to reduce check frequency
  const cooldown = isRedisHealthy 
    ? HEALTH_CHECK_INTERVAL_HEALTHY_MS 
    : HEALTH_CHECK_INTERVAL_DEGRADED_MS;
  
  // Use cached health status if check was recent
  if (now - lastHealthCheck < cooldown) {
    return isRedisHealthy;
  }
  
  try {
    await redis.ping();
    isRedisHealthy = true;
    lastHealthCheck = now;
    return true;
  } catch (error) {
    isRedisHealthy = false;
    lastHealthCheck = now;
    loggers.cache.warn({ error: error instanceof Error ? error.message : String(error) }, 'Redis health check failed');
    return false;
  }
}

/**
 * Attempt to reconnect to Redis if disconnected
 */
export async function ensureRedisConnection(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  
  if (redis.status === 'ready') return true;
  
   if (redis.status === 'connecting') {
     // Wait for connection with timeout and cleanup
     return new Promise((resolve) => {
       const cleanup = () => {
         redis.removeListener('ready', onReady);
         redis.removeListener('error', onError);
       };
       
       const onReady = () => {
         clearTimeout(timeout);
         cleanup();
         resolve(true);
       };
       
       const onError = () => {
         clearTimeout(timeout);
         cleanup();
         resolve(false);
       };
       
       const timeout = setTimeout(() => {
         cleanup();
         loggers.cache.warn('Redis connection timeout while waiting for ready state');
         resolve(false);
       }, 5000);
       
       redis.once('ready', onReady);
       redis.once('error', onError);
     });
   }
  
  // Try to reconnect
  try {
    await redis.connect();
    isRedisHealthy = true;
    return true;
  } catch (error) {
    isRedisHealthy = false;
    loggers.cache.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to reconnect to Redis');
    return false;
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
 * Check if Redis should be used (with cooldown for graceful degradation)
 */
function shouldUseRedis(): boolean {
  // Check if in cooldown period
  if (redisUnavailableUntil > Date.now()) {
    return false;
  }

  // Check if Redis client exists
  const redis = getRedis();
  return redis !== null;
}

/**
 * Mark Redis as unavailable and set cooldown
 */
function markRedisUnavailable(error?: unknown): void {
  redisUnavailableUntil = Date.now() + REDIS_UNAVAILABLE_COOLDOWN_MS;
  isRedisHealthy = false;

  loggers.cache.warn({
    error: error instanceof Error ? error.message : String(error),
    cooldownMs: REDIS_UNAVAILABLE_COOLDOWN_MS,
    retryAt: new Date(redisUnavailableUntil).toISOString()
  }, 'Redis marked unavailable - entering degraded mode');
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
   ODDS: 600,                   // 10 minutes - matches intended behavior per worker comment (was 30 min)
   INJURIES: 7200,              // 2 hours - pre-match updates
   LINEUPS: 300,                // 5 minutes - critical near kickoff (was 15 min)
   
   // Database query caches
   MODELS: 300,                 // 5 minutes - rarely changes
   COMPETITIONS: 300,           // 5 minutes - rarely changes
   LEADERBOARD: 60,             // 1 minute - revalidate frequently
   STATS: 60,                   // 1 minute - overall stats
   
   // Team data caches (for optimization)
   TEAM_STATS: 21600,           // 6 hours - team statistics don't change during match day
   H2H: 604800,                 // 7 days - historical H2H data is static
    ODDS_BATCH: 600,             // 10 minutes - pre-match odds for betting
    ALL_MODEL_HEALTH: 300,       // 5 minutes - model health status
    
    // Roundup content (static once generated)
    ROUNDUP: 86400,              // 24 hours - static roundup content
  } as const;

/**
 * Generic cache get with type safety
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
   if (!shouldUseRedis()) return null;

   const redis = getRedis();
   if (!redis) return null;

    try {
      const cached = await redis.get(key);
      if (cached === null) return null;  // Cache miss
      if (cached === CACHE_NULL_SENTINEL) return null;  // Cached null value
      return JSON.parse(cached) as T;
    } catch (error) {
      markRedisUnavailable(error);
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
   if (!shouldUseRedis()) return false;

   const redis = getRedis();
   if (!redis) return false;

    // Step 1: Serialize with specific error handling
    let serialized: string;
    try {
      serialized = value === null ? CACHE_NULL_SENTINEL : JSON.stringify(value);
    } catch (error) {
      if (error instanceof TypeError) {
        if (error.message.includes('circular')) {
          loggers.cache.error({ key }, 'Cache set failed: circular reference in value');
        } else if (error.message.includes('BigInt')) {
          loggers.cache.error({ key }, 'Cache set failed: BigInt not JSON serializable');
        } else {
          loggers.cache.error({ key, error: error.message }, 'Cache set failed: serialization error');
        }
      } else {
        loggers.cache.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Cache set failed: serialization error');
      }
      return false;
    }

    // Step 2: Store in Redis
    try {
      await redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      markRedisUnavailable(error);
      loggers.cache.error({ key, ttl: ttlSeconds, error: error instanceof Error ? error.message : String(error) }, 'Cache set failed: Redis error');
      return false;
    }
}

/**
 * Delete a cache key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!shouldUseRedis()) return false;

  const redis = getRedis();
  if (!redis) return false;

   try {
     await redis.del(key);
     return true;
   } catch (error) {
     markRedisUnavailable(error);
     loggers.cache.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Error deleting cache value');
     return false;
   }
}

/**
 * Delete multiple cache keys by pattern using SCAN (non-blocking)
 * SCAN iterates through keys without blocking Redis, unlike KEYS which blocks
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    let deletedCount = 0;
    let cursor = '0';

    // Use SCAN to iterate through keys matching pattern
    // SCAN is non-blocking and returns in batches
    do {
      // SCAN cursor MATCH pattern COUNT 100
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        // Delete found keys in batch
        const deleted = await redis.del(...keys);
        deletedCount += deleted;
      }
    } while (cursor !== '0'); // SCAN returns '0' when complete

    loggers.cache.debug({ pattern, deletedCount }, 'Deleted cache keys by pattern (SCAN)');
    return deletedCount;
  } catch (error) {
    loggers.cache.error({
      pattern,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error deleting cache pattern with SCAN');
    return 0;
  }
}

/**
 * Helper to create collision-resistant cache keys from user input
 */
function hashForCacheKey(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
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
    leaderboard: (filters: string) => `db:leaderboard:${hashForCacheKey(filters)}`,
    overallStats: () => 'db:stats:overall',
    topPerformingModel: () => 'db:models:top-performing',
    matchPredictions: (matchId: string) => `db:predictions:${matchId}`,
   
   // Team data (for optimization)
   teamStats: (teamId: number, leagueId: number, season: string) => 
     `api:team-stats:${teamId}:${leagueId}:${season}`,
   h2h: (teamId1: number, teamId2: number) => 
     `api:h2h:${Math.min(teamId1, teamId2)}:${Math.max(teamId1, teamId2)}`,
   oddsBatch: (fixtureId: number) => `api:odds:batch:${fixtureId}`,
    allModelHealth: () => 'db:models:health:all',
    
    // Roundup content
    roundup: (matchId: string) => `roundup:${matchId}`,
    roundupBySlug: (slug: string) => `roundup:slug:${slug}`,
  } as const;

/**
 * Invalidate caches when match finishes
 * Called from scoring logic AFTER transaction commits
 */
export async function invalidateMatchCaches(matchId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // Delete in parallel for speed
    await Promise.all([
      // Invalidate ALL leaderboard caches (various filter combinations)
      cacheDeletePattern('db:leaderboard:*'),

      // Invalidate overall stats
      cacheDelete(cacheKeys.overallStats()),

      // Invalidate top performing model cache
      cacheDelete(cacheKeys.topPerformingModel()),

      // Invalidate specific match predictions cache
      cacheDelete(cacheKeys.matchPredictions(matchId)),
    ]);

    loggers.cache.info({ matchId }, 'Invalidated match caches (leaderboard, stats, predictions)');
  } catch (error) {
    loggers.cache.error({
      matchId,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error invalidating match caches');
  }
}

/**
 * Force refresh stats cache after settlement
 * Called after transaction commit to ensure fresh data
 */
export async function invalidateStatsCache(options?: { matchId?: string }): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await Promise.all([
      cacheDelete(cacheKeys.overallStats()),
      cacheDelete(cacheKeys.topPerformingModel()),
      // Model-specific caches if matchId provided
      ...(options?.matchId ? [cacheDeletePattern('db:model:*:stats')] : []),
    ]);

    loggers.cache.debug(options || {}, 'Invalidated stats caches');
  } catch (error) {
    loggers.cache.error({
      error: error instanceof Error ? error.message : String(error),
      ...options,
    }, 'Error invalidating stats caches');
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
   // PPR: Signal request-time data access before using Date.now()
   await connection();

   // Try to get from cache first (with graceful degradation)
   if (shouldUseRedis()) {
     const redis = getRedis();
     if (redis) {
       try {
         const cached = await redis.get(key);
         if (cached !== null) {
           // Key exists - return value (null if sentinel, parsed value otherwise)
           if (cached === CACHE_NULL_SENTINEL) {
             return null as T;  // Cached null value
           }
           return JSON.parse(cached) as T;
         }
       } catch (error) {
         markRedisUnavailable(error);
         loggers.cache.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Error reading cache - continuing without cache');
       }
     }
   }

   // Cache miss or degraded mode - fetch fresh
   const data = await fetchFn();

   // Cache the result (fire and forget with logging)
   // Only attempt if Redis is available
   if (shouldUseRedis()) {
     cacheSet(key, data, ttlSeconds).catch((error) => {
       loggers.cache.warn(
         { key, error: error instanceof Error ? error.message : String(error) },
         'Background cache set failed - data returned but not cached'
       );
     });
   }

   return data;
}
