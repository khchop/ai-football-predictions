/**
 * Content Generation Error Classes
 *
 * Enables BullMQ retry mechanism and dead letter queue visibility
 * by throwing proper errors instead of returning false.
 */

import { UnrecoverableError } from 'bullmq';

/**
 * RetryableContentError - For transient failures that should trigger BullMQ retry
 *
 * Examples: Network errors, API rate limits, temporary service unavailability
 */
export class RetryableContentError extends Error {
  constructor(
    message: string,
    public context: {
      matchId: string;
      homeTeam: string;
      awayTeam: string;
      contentType: 'pre-match' | 'betting' | 'post-match' | 'faq';
      timestamp: string;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'RetryableContentError';
  }
}

/**
 * FatalContentError - For permanent failures that should NOT retry
 *
 * Examples: Match not found, invalid data, authentication failures
 * Extends BullMQ's UnrecoverableError to prevent retry attempts
 */
export class FatalContentError extends UnrecoverableError {
  constructor(
    message: string,
    public context: {
      matchId: string;
      reason: 'match_not_found' | 'match_not_finished' | 'invalid_data' | 'auth_failure';
      timestamp: string;
    }
  ) {
    super(message);
    this.name = 'FatalContentError';
  }
}

/**
 * Helper to classify errors as retryable or fatal
 *
 * Used to determine appropriate error type when wrapping unknown errors
 */
export function classifyError(error: unknown): 'retryable' | 'fatal' {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Fatal: Match not found, authentication issues
    if (
      message.includes('match not found') ||
      message.includes('not found') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid credentials')
    ) {
      return 'fatal';
    }

    // Retryable: Network errors, rate limits, temporary failures
    if (
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('timeout')
    ) {
      return 'retryable';
    }
  }

  // Default to retryable (better to retry than silently fail)
  return 'retryable';
}
