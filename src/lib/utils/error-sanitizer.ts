/**
 * Error Sanitization Utilities
 * 
 * Ensures that API responses never leak internal error details in production.
 * In development: full error messages for debugging
 * In production: generic messages to prevent information disclosure
 */

import { loggers } from '@/lib/logger/modules';

/**
 * Sanitizes errors for API responses
 * In production: returns generic message
 * In development: returns actual error for debugging
 */
export function sanitizeError(error: unknown, context?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Always log the full error internally for monitoring
  if (context) {
    loggers.api.error({ error: errorMessage, context }, 'API error occurred');
  } else {
    loggers.api.error({ error: errorMessage }, 'API error occurred');
  }
  
  // In production, never expose internal details
  if (process.env.NODE_ENV === 'production') {
    return 'An internal error occurred';
  }
  
  // In development, return actual error for easier debugging
  return errorMessage;
}

/**
 * Creates a standardized error response
 * 
 * Usage:
 * } catch (error) {
 *   return createErrorResponse(error, 500, 'leaderboard');
 * }
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  context?: string
): Response {
  return Response.json(
    { error: sanitizeError(error, context) },
    { status: statusCode }
  );
}

/**
 * Creates a standardized validation error response
 */
export function createValidationErrorResponse(
  validationErrors: Record<string, string[]>,
  statusCode: number = 400
): Response {
  return Response.json(
    { 
      error: 'Validation failed',
      details: validationErrors 
    },
    { status: statusCode }
  );
}
