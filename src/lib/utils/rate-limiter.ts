/**
 * Redis-based distributed rate limiter using fixed-window algorithm
 * Uses INCR + EXPIRE for atomic counter operations across instances
 */

import { getRedis } from '@/lib/cache/redis';

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
  /** Timestamp when the rate limit resets (Unix seconds) */
  resetAt: number;
  /** Number of requests made in the current window */
  current: number;
}

/**
 * Check if a request is allowed under rate limiting
 * Uses Redis INCR for atomic counter operations
 * Fail-open: if Redis is unavailable, allows the request
 * 
 * @param key Unique identifier for the rate limit bucket (e.g., IP address or user ID)
 * @param config Rate limit configuration
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redis = getRedis();
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  
  // Fail-open: if Redis unavailable, allow request
  if (!redis) {
    console.warn('[Rate Limit] Redis unavailable, allowing request');
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Math.floor(Date.now() / 1000) + windowSeconds,
      current: 1,
    };
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
    // Fail-open: if Redis operation fails, allow request
    console.warn('[Rate Limit] Redis error, allowing request:', error);
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Math.floor(Date.now() / 1000) + Math.ceil(config.windowMs / 1000),
      current: 1,
    };
  }
}

/**
 * Get rate limit key from request (uses IP address or forwarded IP)
 * Handles reverse proxy headers for distributed deployments (Coolify/Traefik)
 */
export function getRateLimitKey(request: Request): string {
  // X-Forwarded-For can contain comma-separated list of IPs
  // Format: client, proxy1, proxy2
  // Take the leftmost IP (original client)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }
  
  // Alternative header used by some proxies
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Cloudflare uses CF-Connecting-IP
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }
  
  // Fallback to generic key (single-instance or local testing)
  return 'anonymous';
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  /** Admin endpoints: 10 requests per minute */
  admin: { limit: 10, windowMs: 60 * 1000 },
  /** Public API endpoint: 60 requests per minute */
  api: { limit: 60, windowMs: 60 * 1000 },
  /** Public browsing: 120 requests per minute */
  public: { limit: 120, windowMs: 60 * 1000 },
  /** Strict endpoint: 30 requests per minute */
  strict: { limit: 30, windowMs: 60 * 1000 },
  /** Relaxed endpoint: 300 requests per minute */
  relaxed: { limit: 300, windowMs: 60 * 1000 },
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
