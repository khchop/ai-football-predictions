/**
 * Simple in-memory rate limiter using sliding window algorithm
 * Note: This works per-instance only. For distributed rate limiting,
 * use Redis-based solutions like @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store rate limit entries by key
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 60 seconds)
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
  // Don't prevent process from exiting
  cleanupInterval.unref();
}

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Timestamp when the rate limit resets */
  resetAt: number;
  /** Number of requests made in the current window */
  current: number;
}

/**
 * Check if a request is allowed under rate limiting
 * @param key Unique identifier for the rate limit bucket (e.g., IP address)
 * @param config Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  startCleanup();
  
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  // If no entry or window has passed, create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
      current: 1,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      current: entry.count,
    };
  }
  
  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    current: entry.count,
  };
}

/**
 * Get rate limit key from request (uses IP address or forwarded IP)
 */
export function getRateLimitKey(request: Request): string {
  // Try to get real IP from common headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client IP)
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a generic key (not ideal but works for single-user scenarios)
  return 'anonymous';
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  /** Standard API endpoint: 100 requests per minute */
  standard: { limit: 100, windowMs: 60 * 1000 },
  /** Strict endpoint: 30 requests per minute */
  strict: { limit: 30, windowMs: 60 * 1000 },
  /** Relaxed endpoint: 300 requests per minute */
  relaxed: { limit: 300, windowMs: 60 * 1000 },
  /** Very strict: 10 requests per minute */
  veryStrict: { limit: 10, windowMs: 60 * 1000 },
} as const;

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.current + result.remaining),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
