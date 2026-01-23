/**
 * Shared API client utilities with retry logic and timeout handling
 */

import { loggers } from '@/lib/logger/modules';
import { isCircuitOpen, recordSuccess, recordFailure, getCircuitStatus, CircuitOpenError, type ServiceName } from './circuit-breaker';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const DEFAULT_TIMEOUT_MS = 30000;

// Track remaining requests per service
const rateLimitTracker = new Map<string, { remaining: number; resetAt: number }>();

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract and track rate limit information from response headers
 * Proactively throttle before hitting the rate limit
 */
function handleRateLimitHeaders(serviceName: ServiceName | undefined, response: Response): void {
  if (!serviceName) return;

  const remaining = response.headers.get('X-RateLimit-Remaining');
  const resetStr = response.headers.get('X-RateLimit-Reset');
  
  if (remaining && resetStr) {
    const remainingNum = parseInt(remaining, 10);
    const resetUnix = parseInt(resetStr, 10);
    const now = Math.floor(Date.now() / 1000);
    const resetAt = resetUnix > 1000000000 ? resetUnix * 1000 : resetUnix; // Handle both Unix timestamps and ms
    
    rateLimitTracker.set(serviceName, {
      remaining: remainingNum,
      resetAt: resetAt,
    });
    
    // Log low remaining count for monitoring
    if (remainingNum <= 10) {
      loggers.api.warn({
        serviceName,
        remaining: remainingNum,
        resetAt: new Date(resetAt),
      }, 'Rate limit approaching');
    }
  }
}

/**
 * Check if we should throttle based on rate limit headers
 * Returns delay in ms to wait before making next request, or 0 if no throttling needed
 */
function getProactiveThrottleDelay(serviceName: ServiceName | undefined): number {
  if (!serviceName) return 0;

  const tracking = rateLimitTracker.get(serviceName);
  if (!tracking) return 0;

  const now = Date.now();
  const timeUntilReset = tracking.resetAt - now;

  // If we have 5 or fewer requests remaining and reset is in the future
  if (tracking.remaining <= 5 && timeUntilReset > 0) {
    // Distribute remaining requests evenly until reset
    const throttleDelayMs = Math.max(100, timeUntilReset / (tracking.remaining + 1));
    return throttleDelayMs;
  }

  return 0;
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry logic and timeout
 * Supports circuit breaker pattern for service resilience
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  serviceName?: ServiceName
): Promise<Response> {
  // 1. Circuit breaker check
  if (serviceName && isCircuitOpen(serviceName)) {
    const status = getCircuitStatus(serviceName);
    const retryAfterMs = status.config.resetTimeoutMs - (Date.now() - status.lastFailureAt);
    throw new CircuitOpenError(serviceName, Math.max(0, retryAfterMs));
  }

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
     // Proactive throttling based on rate limit headers from previous request
     const throttleDelay = getProactiveThrottleDelay(serviceName);
     if (throttleDelay > 0) {
       loggers.api.info({
         serviceName: serviceName || 'unknown',
         delayMs: Math.round(throttleDelay),
       }, 'Proactive rate limit throttling');
       await sleep(throttleDelay);
     }

     const attemptStart = Date.now();
     
     try {
       const response = await fetchWithTimeout(url, options, timeoutMs);
       const duration = Date.now() - attemptStart;

        // Extract and track rate limit information
        handleRateLimitHeaders(serviceName, response);

        // Log successful request
        if (attempt > 0) {
          loggers.api.info({
            serviceName: serviceName || 'unknown',
            attempt,
            duration,
            totalDuration: Date.now() - startTime,
          }, 'Request succeeded after retries');
        }

       // Check if we should retry based on status code
       if (
         !response.ok &&
         retryConfig.retryableStatusCodes.includes(response.status) &&
         attempt < retryConfig.maxRetries
       ) {
          const delay = calculateBackoffDelay(
            attempt,
            retryConfig.baseDelayMs,
            retryConfig.maxDelayMs
          );
          loggers.api.warn({
            serviceName: serviceName || 'unknown',
            statusCode: response.status,
            attempt: attempt + 1,
            maxRetries: retryConfig.maxRetries,
            delayMs: Math.round(delay),
          }, 'HTTP error, retrying');
          await sleep(delay);
          continue;
       }

       // Record success with circuit breaker
       if (serviceName) {
         recordSuccess(serviceName);
       }

       return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - attemptStart;

      // Determine if retryable
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.name === 'AbortError');
      const isNetworkError = error instanceof Error &&
        (error.message.includes('ECONNREFUSED') || 
         error.message.includes('ENOTFOUND') ||
         error.message.includes('network'));

       if ((isTimeout || isNetworkError) && attempt < retryConfig.maxRetries) {
         const delay = calculateBackoffDelay(
           attempt,
           retryConfig.baseDelayMs,
           retryConfig.maxDelayMs
         );
         loggers.api.warn({
           serviceName: serviceName || 'unknown',
           errorType: isTimeout ? 'timeout' : 'network-error',
           duration,
           attempt: attempt + 1,
           maxRetries: retryConfig.maxRetries,
           delayMs: Math.round(delay),
         }, `${isTimeout ? 'Timeout' : 'Network error'}, retrying`);
         await sleep(delay);
         continue;
       }

       // Max retries reached or non-retryable error
       if (attempt >= retryConfig.maxRetries) {
         loggers.api.error({
           serviceName: serviceName || 'unknown',
           attempts: attempt + 1,
           totalDuration: Date.now() - startTime,
           error: lastError?.message,
         }, 'Request failed after all retries');
         
         // Record failure with circuit breaker
         if (serviceName) {
           recordFailure(serviceName, lastError);
         }
         
         throw lastError;
       }

       // Retry on other errors
       const delay = calculateBackoffDelay(
         attempt,
         retryConfig.baseDelayMs,
         retryConfig.maxDelayMs
       );
       loggers.api.warn({
         serviceName: serviceName || 'unknown',
         error: lastError?.message,
         duration,
         attempt: attempt + 1,
         maxRetries: retryConfig.maxRetries,
         delayMs: Math.round(delay),
       }, 'Error occurred, retrying');
       await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  if (serviceName) {
    recordFailure(serviceName, lastError || new Error('Max retries reached'));
  }
  throw lastError || new Error('Max retries reached');
}

/**
 * Database error wrapper for consistent error handling
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * API error wrapper for external API errors
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Rate limit error for API throttling
 */
export class RateLimitError extends APIError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly retryAfter?: number
  ) {
    super(message, 429, endpoint);
    this.name = 'RateLimitError';
  }
}
