/**
 * Cache utilities for stats API endpoints
 * Provides tiered cache key building and invalidation patterns
 */

import { cacheGet, cacheSet, cacheDeletePattern } from '@/lib/cache/redis';
import { loggers } from '@/lib/logger/modules';
import type { StatsLevel, StatsFilters } from './types';

/**
 * Build consistent cache keys for stats endpoints
 * Pattern: stats:{level}:{filter1}:{filter2}...
 */
export function buildCacheKey(level: StatsLevel, filters: StatsFilters = {}): string {
  const parts: string[] = ['stats', level];

  if (filters.season) parts.push(`season:${filters.season}`);
  if (filters.competition) parts.push(`comp:${filters.competition}`);
  if (filters.club) parts.push(`club:${filters.club}`);
  if (filters.model) parts.push(`model:${filters.model}`);
  if (filters.isHome !== undefined) parts.push(filters.isHome ? 'home' : 'away');
  if (filters.limit) parts.push(`limit:${filters.limit}`);
  if (filters.cursor) parts.push(`cursor:${filters.cursor}`);

  return parts.join(':');
}

/**
 * Get cached stats data with logging
 */
export async function getStatsCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await cacheGet<T>(key);
    if (cached) {
      loggers.cache.debug({ key }, 'Stats cache hit');
    }
    return cached;
  } catch (error) {
    loggers.cache.warn(
      { key, error: error instanceof Error ? error.message : String(error) },
      'Failed to get stats cache'
    );
    return null;
  }
}

/**
 * Set stats cache with TTL
 */
export async function setStatsCache<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const success = await cacheSet(key, data, ttlSeconds);
    if (success) {
      loggers.cache.debug({ key, ttl: ttlSeconds }, 'Stats cache set');
    }
    return success;
  } catch (error) {
    loggers.cache.warn(
      { key, error: error instanceof Error ? error.message : String(error) },
      'Failed to set stats cache'
    );
    return false;
  }
}

/**
 * Get appropriate TTL based on filters
 * Active season: 60s, Historical: 5min
 */
export function getStatsTTL(filters: StatsFilters = {}): number {
  // Determine current season (assuming seasons are years)
  const currentYear = new Date().getFullYear();
  const currentSeason = currentYear.toString();

  // If no season filter or current season, use short TTL (active data)
  const isCurrentSeason = !filters.season || filters.season === currentSeason;

  // Active season: 60s, Historical: 5min
  return isCurrentSeason ? 60 : 300;
}

/**
 * Invalidate stats caches when match completes
 * Clears overall, competition, and club-specific caches
 */
export async function invalidateStatsCache(match: {
  id: string;
  competitionId: string;
  homeTeam: string;
  awayTeam: string;
}): Promise<void> {
  try {
    // Delete patterns for overall stats
    await cacheDeletePattern('stats:overall:*');

    // Delete patterns for leaderboard
    await cacheDeletePattern('stats:leaderboard:*');

    // Delete patterns for competition stats
    await cacheDeletePattern(`stats:competition:*comp:${match.competitionId}*`);

    // Delete patterns for both clubs
    await cacheDeletePattern(`stats:club:*club:${match.homeTeam}*`);
    await cacheDeletePattern(`stats:club:*club:${match.awayTeam}*`);

    // Delete patterns for all model stats (they might have participated)
    await cacheDeletePattern('stats:model:*');

    loggers.cache.info(
      { matchId: match.id, competition: match.competitionId },
      'Invalidated stats caches after match completion'
    );
  } catch (error) {
    loggers.cache.error(
      {
        matchId: match.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to invalidate stats caches'
    );
  }
}
