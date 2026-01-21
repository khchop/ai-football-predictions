/**
 * Shared API client utilities with retry logic and timeout handling
 */

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
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

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
          `[API Client] Retrying request (attempt ${attempt + 1}/${retryConfig.maxRetries}) ` +
          `after ${response.status} status, waiting ${Math.round(delay)}ms`
        );
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      if (
        error instanceof Error &&
        (error.message.includes('timeout') || error.name === 'AbortError')
      ) {
        if (attempt < retryConfig.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            retryConfig.baseDelayMs,
            retryConfig.maxDelayMs
          );
          console.warn(
            `[API Client] Retrying request (attempt ${attempt + 1}/${retryConfig.maxRetries}) ` +
            `after timeout, waiting ${Math.round(delay)}ms`
          );
          await sleep(delay);
          continue;
        }
      }

      // Non-retryable error or max retries reached
      if (attempt >= retryConfig.maxRetries) {
        throw lastError;
      }

      const delay = calculateBackoffDelay(
        attempt,
        retryConfig.baseDelayMs,
        retryConfig.maxDelayMs
      );
      console.warn(
        `[API Client] Retrying request (attempt ${attempt + 1}/${retryConfig.maxRetries}) ` +
        `after error: ${lastError.message}, waiting ${Math.round(delay)}ms`
      );
      await sleep(delay);
    }
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
