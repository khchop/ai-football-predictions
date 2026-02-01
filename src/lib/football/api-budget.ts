/**
 * API-Football Budget Enforcement
 *
 * Free tier: 100 requests/day
 * Strategy: Redis atomic INCR counter with TTL-based automatic reset at midnight UTC
 * Fails open when Redis unavailable (availability > strict enforcement)
 */

import { getRedis } from '@/lib/cache/redis';
import { loggers } from '@/lib/logger/modules';

const log = loggers.apiFootball;

// Budget configuration
const DAILY_REQUEST_LIMIT = 100;
const BUDGET_KEY = 'api-football:daily-budget';

/**
 * Custom error for budget exceeded
 */
export class BudgetExceededError extends Error {
  public readonly resetTime: Date;

  constructor(message: string, resetTime: Date) {
    super(message);
    this.name = 'BudgetExceededError';
    this.resetTime = resetTime;
  }
}

/**
 * Get seconds until next midnight UTC for TTL calculation
 */
function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}

/**
 * Get next midnight UTC as Date
 */
function getNextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
}

/**
 * Check budget and increment request counter atomically
 *
 * @throws {BudgetExceededError} When daily limit exceeded
 * @returns {Promise<number>} Current request count (after increment)
 */
export async function checkAndIncrementBudget(): Promise<number> {
  const redis = getRedis();

  // Fail open: If Redis unavailable, allow request (availability > strict enforcement)
  if (!redis) {
    log.warn('Redis unavailable - budget tracking disabled (fail-open)');
    return 0;
  }

  try {
    // Atomic increment
    const currentCount = await redis.incr(BUDGET_KEY);

    // Set TTL on first request of the day (when count = 1)
    if (currentCount === 1) {
      const ttl = getSecondsUntilMidnightUTC();
      await redis.expire(BUDGET_KEY, ttl);
      log.info({ ttl, resetTime: getNextMidnightUTC() }, 'Budget counter initialized with midnight UTC reset');
    }

    // Check if over budget AFTER incrementing (atomic check-and-increment)
    if (currentCount > DAILY_REQUEST_LIMIT) {
      const resetTime = getNextMidnightUTC();
      log.error({
        currentCount,
        limit: DAILY_REQUEST_LIMIT,
        resetTime
      }, 'API-Football daily budget exceeded');

      throw new BudgetExceededError(
        `API-Football daily budget exceeded (${currentCount}/${DAILY_REQUEST_LIMIT}). Resets at ${resetTime.toISOString()}`,
        resetTime
      );
    }

    // Log budget status at intervals
    if (currentCount % 10 === 0 || currentCount > DAILY_REQUEST_LIMIT * 0.9) {
      log.info({
        currentCount,
        limit: DAILY_REQUEST_LIMIT,
        remaining: DAILY_REQUEST_LIMIT - currentCount
      }, 'API-Football budget status');
    }

    return currentCount;
  } catch (error) {
    // Re-throw BudgetExceededError
    if (error instanceof BudgetExceededError) {
      throw error;
    }

    // Fail open: Redis errors allow request through
    log.warn({
      error: error instanceof Error ? error.message : String(error)
    }, 'Budget check failed - allowing request (fail-open)');
    return 0;
  }
}

/**
 * Get current budget status without incrementing
 */
export async function getBudgetStatus(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetTime: Date;
} | null> {
  const redis = getRedis();

  if (!redis) {
    return null;
  }

  try {
    const used = await redis.get(BUDGET_KEY);
    const usedCount = used ? parseInt(used, 10) : 0;

    return {
      used: usedCount,
      limit: DAILY_REQUEST_LIMIT,
      remaining: Math.max(0, DAILY_REQUEST_LIMIT - usedCount),
      resetTime: getNextMidnightUTC(),
    };
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to get budget status');
    return null;
  }
}
