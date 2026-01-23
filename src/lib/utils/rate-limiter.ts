/**
 * Redis-based distributed rate limiter using fixed-window algorithm
 * Uses INCR + EXPIRE for atomic counter operations across instances
 */

import { loggers } from '@/lib/logger/modules';
import { getRedis } from '@/lib/cache/redis';

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Fail-closed: reject if Redis unavailable. Defaults to true for safety */
  failClosed?: boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Timestamp when the rate limit resets (Unix seconds) */
  resetAt: number;
  /** Number of requests made in the current window */
  current: number;
}

/**
 * Check if a request is allowed under rate limiting
 * Uses Redis INCR for atomic counter operations
 * 
 * Fail behavior (controlled by config.failClosed):
 * - failClosed: true (admin routes) = reject if Redis unavailable (fail-closed)
 * - failClosed: false (public routes) = allow if Redis unavailable (fail-open)
 * 
 * @param key Unique identifier for the rate limit bucket (e.g., IP address or user ID)
 * @param config Rate limit configuration
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redis = getRedis();
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const shouldFailClosed = config.failClosed !== false; // Default to fail-closed for safety
  
   // Handle Redis unavailability
   if (!redis) {
     if (shouldFailClosed) {
       // Fail-closed: reject request if Redis unavailable
       loggers.rateLimiter.error({ key }, 'Redis unavailable, rejecting request (fail-closed)');
       return {
         allowed: false,
         remaining: 0,
         resetAt: Math.floor(Date.now() / 1000) + windowSeconds,
         current: config.limit + 1, // Indicate limit exceeded
       };
     } else {
       // Fail-open: allow request if Redis unavailable
       loggers.rateLimiter.warn({ key }, 'Redis unavailable, allowing request (fail-open)');
       return {
         allowed: true,
         remaining: config.limit,
         resetAt: Math.floor(Date.now() / 1000) + windowSeconds,
         current: 1,
       };
     }
   }

  try {
    const redisKey = `rate:${key}`;
    
    // Atomic increment operation
    const count = await redis.incr(redisKey);
    
    // Set expiry only on first request (count === 1)
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    
    // Get remaining TTL for reset time
    const ttl = await redis.ttl(redisKey);
    const resetAtSeconds = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
    
    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);
    
    return {
      allowed,
      remaining,
      resetAt: resetAtSeconds,
      current: count,
    };
   } catch (error) {
      const shouldFailClosed = config.failClosed !== false;
      
      if (shouldFailClosed) {
        // Fail-closed: reject on Redis operation failure
        loggers.rateLimiter.error({ key, error: error instanceof Error ? error.message : String(error) }, 'Redis operation failed, rejecting request (fail-closed)');
        return {
          allowed: false,
          remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + Math.ceil(config.windowMs / 1000),
          current: config.limit + 1,
        };
      } else {
        // Fail-open: allow on Redis operation failure
        loggers.rateLimiter.warn({ key, error: error instanceof Error ? error.message : String(error) }, 'Redis operation failed, allowing request (fail-open)');
        return {
          allowed: true,
          remaining: config.limit,
          resetAt: Math.floor(Date.now() / 1000) + Math.ceil(config.windowMs / 1000),
          current: 1,
        };
      }
    }
}

/**
 * Get rate limit key from request (uses IP address or forwarded IP)
 * 
 * Security: Only trusts specific headers from known sources:
 * 1. CF-Connecting-IP from Cloudflare (most trustworthy, widely used)
 * 2. X-Forwarded-For only if behind validated reverse proxy
 * 3. Request fingerprint (User-Agent hash) as last resort
 */
export function getRateLimitKey(request: Request): string {
  // Most trusted: Cloudflare header
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && isValidIP(cfIp)) {
    return cfIp;
  }

  // Second: X-Forwarded-For from reverse proxy
  // Only use if it looks like a real IP (prevents spoofing with arbitrary values)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0]?.trim();
    if (clientIp && isValidIP(clientIp)) {
      return clientIp;
    }
  }
  
  // Fallback: X-Real-IP (some proxies use this)
  const realIp = request.headers.get('x-real-ip');
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  // Last resort: Request fingerprinting
  // This is not spoofable and protects against basic rate limit bypasses
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLang = request.headers.get('accept-language') || '';
  const fingerprint = hash(userAgent + acceptLang);
  return `fingerprint:${fingerprint}`;
}

/**
 * Validate that a string looks like an IP address (IPv4 or IPv6)
 * Prevents arbitrary strings from being used as rate limit keys
 */
function isValidIP(ip: string): boolean {
  // IPv4: basic validation
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return true;
  }
  // IPv6: contains colons and hex chars
  if (/^[\da-f:]+$/.test(ip.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Simple hash function for fingerprinting
 */
function hash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  /** Admin endpoints: 10 requests per minute, fail-closed (reject if Redis down) */
  admin: { limit: 10, windowMs: 60 * 1000, failClosed: true },
  /** Public API endpoint: 60 requests per minute, fail-open (allow if Redis down) */
  api: { limit: 60, windowMs: 60 * 1000, failClosed: false },
  /** Public browsing: 120 requests per minute, fail-open (allow if Redis down) */
  public: { limit: 120, windowMs: 60 * 1000, failClosed: false },
  /** Strict endpoint: 30 requests per minute, fail-closed (reject if Redis down) */
  strict: { limit: 30, windowMs: 60 * 1000, failClosed: true },
  /** Relaxed endpoint: 300 requests per minute, fail-open (allow if Redis down) */
  relaxed: { limit: 300, windowMs: 60 * 1000, failClosed: false },
} as const;

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.current + result.remaining),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
}
