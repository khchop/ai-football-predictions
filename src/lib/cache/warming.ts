/**
 * Cache Warming
 * 
 * Pre-populates frequently accessed data on startup to reduce cold-start latency
 * and improve application responsiveness after server restarts.
 * 
 * This module is intentionally separate from main initialization flow so
 * cache warming failures don't block server startup.
 */

import { loggers } from '@/lib/logger/modules';
import { isRedisAvailable } from './redis';

/**
 * Interface for cache warming results
 */
export interface WarmingResult {
  warmed: string[];      // Successfully warmed cache keys
  skipped: string[];     // Skipped due to Redis unavailability
  failed: string[];      // Failed to warm (with error details)
  duration: number;      // Time taken in milliseconds
}

/**
 * Warm cache with frequently accessed data on startup
 * 
 * Non-fatal: failures during warming don't block server startup
 * Per-item isolation: one failure doesn't prevent warming other items
 * Smart fallback: checks Redis availability before attempting to warm
 */
export async function warmCache(): Promise<WarmingResult> {
  const startTime = Date.now();
  const result: WarmingResult = {
    warmed: [],
    skipped: [],
    failed: [],
    duration: 0,
  };

  // Check if Redis is available before attempting to warm
  const isAvailable = await isRedisAvailable();
  if (!isAvailable) {
    loggers.cache.warn('Redis not available for cache warming - skipping');
    result.skipped = ['activeCompetitions', 'activeModels', 'overallStats'];
    result.duration = Date.now() - startTime;
    return result;
  }

  loggers.cache.info('Starting cache warming');

  // Warm active competitions
  try {
    await warmActiveCompetitions();
    result.warmed.push('activeCompetitions');
    loggers.cache.debug('Warmed activeCompetitions cache');
  } catch (error) {
    result.failed.push(
      `activeCompetitions: ${error instanceof Error ? error.message : String(error)}`
    );
    loggers.cache.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to warm activeCompetitions cache'
    );
  }

  // Warm active models
  try {
    await warmActiveModels();
    result.warmed.push('activeModels');
    loggers.cache.debug('Warmed activeModels cache');
  } catch (error) {
    result.failed.push(
      `activeModels: ${error instanceof Error ? error.message : String(error)}`
    );
    loggers.cache.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to warm activeModels cache'
    );
  }

  // Warm overall stats
  try {
    await warmOverallStats();
    result.warmed.push('overallStats');
    loggers.cache.debug('Warmed overallStats cache');
  } catch (error) {
    result.failed.push(
      `overallStats: ${error instanceof Error ? error.message : String(error)}`
    );
    loggers.cache.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to warm overallStats cache'
    );
  }

  result.duration = Date.now() - startTime;

  loggers.cache.info(
    {
      warmed: result.warmed.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
      duration: result.duration,
    },
    'Cache warming completed'
  );

  return result;
}

/**
 * Warm active competitions cache
 * Pre-fetches list of active competitions to avoid cold database hits
 */
async function warmActiveCompetitions(): Promise<void> {
  // Import here to avoid circular dependencies
  const { getActiveCompetitions } = await import('@/lib/db/queries');
  
  // This will automatically cache the result via withCache in getActiveCompetitions
  await getActiveCompetitions();
}

/**
 * Warm active models cache
 * Pre-fetches list of active LLM models to avoid cold database hits
 */
async function warmActiveModels(): Promise<void> {
  // Import here to avoid circular dependencies
  const { getActiveModels } = await import('@/lib/db/queries');
  
  // This will automatically cache the result via withCache in getActiveModels
  await getActiveModels();
}

/**
 * Warm overall stats cache
 * Pre-fetches system statistics to avoid cold database hits
 */
async function warmOverallStats(): Promise<void> {
  // Import here to avoid circular dependencies
  const { getOverallStats } = await import('@/lib/db/queries');
  
  // This will automatically cache the result via withCache in getOverallStats
  await getOverallStats();
}
