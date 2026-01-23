/**
 * Service-Specific Retry Configurations
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
// ============================================================================
export const TOGETHER_PREDICTION_RETRY: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1500,      // 1.5s base delay (give models time)
  maxDelayMs: 15000,      // 15s max delay
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const TOGETHER_PREDICTION_TIMEOUT_MS = 20000;       // 20s for single prediction
export const TOGETHER_PREDICTION_BATCH_TIMEOUT_MS = 30000; // 30s for batch

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
