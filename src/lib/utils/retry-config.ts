/**
 * Service-Specific Retry Configurations and Error Classification
 *
 * Each external service has different characteristics:
 * - Rate limits
 * - Typical response times
 * - Failure patterns
 *
 * These configs are tuned for each service's specific needs.
 */

import { RetryConfig } from './api-client';

// ============================================================================
// ERROR TYPE CLASSIFICATION
// ============================================================================

export enum ErrorType {
  RATE_LIMIT = 'rate-limit',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server-error',
  NETWORK_ERROR = 'network-error',
  PARSE_ERROR = 'parse-error',
  CLIENT_ERROR = 'client-error',
  UNKNOWN = 'unknown',
}

/**
 * Classify error based on HTTP status or error message
 */
export function classifyErrorType(error: unknown): ErrorType {
  const errorMsg = error instanceof Error ? error.message : String(error);

  // HTTP status codes
  if (errorMsg.includes('429')) return ErrorType.RATE_LIMIT;
  if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504')) {
    return ErrorType.SERVER_ERROR;
  }
  if (errorMsg.includes('400') || errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('404')) {
    return ErrorType.CLIENT_ERROR;
  }

  // Error messages
  if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('AbortError')) {
    return ErrorType.TIMEOUT;
  }
  if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNRESET')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (errorMsg.includes('parse') || errorMsg.includes('JSON') || errorMsg.includes('unexpected') || errorMsg.includes('empty_response')) {
    return ErrorType.PARSE_ERROR;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Calculate backoff delay based on error type and attempt number
 */
export function calculateBackoffDelay(
  attempt: number,
  errorType: ErrorType,
  baseDelayMs: number = 1000
): number {
  switch (errorType) {
    case ErrorType.RATE_LIMIT:
      // Rate limits need longer, consistent backoff (no jitter to avoid hammering)
      return 60000; // 60s fixed

    case ErrorType.TIMEOUT:
      // Timeouts benefit from linear backoff (faster recovery for transient issues)
      const linearDelay = attempt * 5000;
      return Math.min(linearDelay, 30000); // 5s, 10s, 15s, 20s, 25s, 30s max

    case ErrorType.PARSE_ERROR:
      // Parse errors retry quickly with exponential (transient LLM formatting issues)
      const parseDelay = 5000 * Math.pow(2, attempt - 1);
      return Math.min(parseDelay, 20000); // 5s, 10s, 20s...

    case ErrorType.SERVER_ERROR:
    case ErrorType.NETWORK_ERROR:
      // Server and network errors use exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter to prevent thundering herd
      return Math.min(exponentialDelay + jitter, 60000);

    case ErrorType.CLIENT_ERROR:
      // Client errors (4xx) usually not retryable, but give minimal backoff if retried
      return Math.min(baseDelayMs * Math.pow(2, attempt), 10000);

    default:
      // Unknown errors: exponential backoff
      const unknownDelay = baseDelayMs * Math.pow(2, attempt);
      return Math.min(unknownDelay, 60000);
  }
}

/**
 * Determine if an error should be counted toward model disable threshold
 * Transient errors (rate limits, timeouts, server errors) should NOT count toward disable
 */
export function isModelSpecificFailure(errorType: ErrorType): boolean {
  return (
    errorType === ErrorType.PARSE_ERROR ||
    errorType === ErrorType.CLIENT_ERROR
  );
}

// ============================================================================
// API-FOOTBALL
// Rate limit: 30 requests/minute (paid plan)
// Typical latency: 200-500ms
// Reliability: Very high (99.9%)
// ============================================================================
export const API_FOOTBALL_RETRY: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,      // 1s base delay
  maxDelayMs: 10000,      // 10s max delay
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const API_FOOTBALL_TIMEOUT_MS = 30000; // 30s timeout

// ============================================================================
// TOGETHER AI - PREDICTIONS (35 Models)
// Rate limit: Varies by plan
// Typical latency: 2-5s for inference
// Reliability: High (99.5%)
// Updated: Increased retries and delays for better reliability with transient errors
// ============================================================================
export const TOGETHER_PREDICTION_RETRY: Partial<RetryConfig> = {
  maxRetries: 5,          // Increased from 3 to 5 for better reliability
  baseDelayMs: 2000,      // Increased from 1.5s to 2s base delay (give models more time)
  maxDelayMs: 20000,      // Increased from 15s to 20s max delay
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const TOGETHER_PREDICTION_TIMEOUT_MS = 25000;       // Increased from 20s to 25s for single prediction
export const TOGETHER_PREDICTION_BATCH_TIMEOUT_MS = 35000; // Increased from 30s to 35s for batch

// ============================================================================
// TOGETHER AI - CONTENT (Llama 4 Maverick)
// Rate limit: Same as predictions
// Typical latency: 5-15s for long-form content
// Reliability: High (99.5%)
// ============================================================================
export const TOGETHER_CONTENT_RETRY: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 2000,      // 2s base delay (longer responses)
  maxDelayMs: 30000,      // 30s max delay
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const TOGETHER_CONTENT_TIMEOUT_MS = 60000; // 60s timeout for content generation

// ============================================================================
// SERVICE NAMES (for circuit breaker and logging)
// ============================================================================
export const SERVICE_NAMES = {
  API_FOOTBALL: 'api-football',
  TOGETHER_PREDICTIONS: 'together-predictions',
  TOGETHER_CONTENT: 'together-content',
} as const;

export type ServiceName = typeof SERVICE_NAMES[keyof typeof SERVICE_NAMES];
