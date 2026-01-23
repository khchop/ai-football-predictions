/**
 * Shared API client utilities with retry logic and timeout handling
 */

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

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    const attemptStart = Date.now();
    
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      const duration = Date.now() - attemptStart;

      // Log successful request
      if (attempt > 0) {
        console.log(
          `[API Client] ${serviceName || 'unknown'}: Request succeeded after ${attempt} retries ` +
          `(${duration}ms, total ${Date.now() - startTime}ms)`
        );
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
        console.warn(
          `[API Client] ${serviceName || 'unknown'}: HTTP ${response.status}, ` +
          `retry ${attempt + 1}/${retryConfig.maxRetries} in ${Math.round(delay)}ms`
        );
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
        console.warn(
          `[API Client] ${serviceName || 'unknown'}: ${isTimeout ? 'Timeout' : 'Network error'} ` +
          `(${duration}ms), retry ${attempt + 1}/${retryConfig.maxRetries} in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }

      // Max retries reached or non-retryable error
      if (attempt >= retryConfig.maxRetries) {
        console.error(
          `[API Client] ${serviceName || 'unknown'}: Failed after ${attempt + 1} attempts ` +
          `(total ${Date.now() - startTime}ms): ${lastError.message}`
        );
        
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
      console.warn(
        `[API Client] ${serviceName || 'unknown'}: Error "${lastError.message}" (${duration}ms), ` +
        `retry ${attempt + 1}/${retryConfig.maxRetries} in ${Math.round(delay)}ms`
      );
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
