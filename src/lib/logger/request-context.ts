/**
 * Request ID and Context Logging
 * 
 * Handles request tracing with correlation IDs.
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from './modules';

/**
 * Extract or generate request ID for tracing
 */
export function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    uuidv4()
  );
}

/**
 * Create request-scoped logger with all context
 */
export function createApiRequestLogger(request: NextRequest) {
  const requestId = getRequestId(request);
  const { pathname } = new URL(request.url);
  
  return loggers.api.child({
    requestId,
    method: request.method,
    path: pathname,
    userAgent: request.headers.get('user-agent')?.substring(0, 100),
  });
}

/**
 * Log API request completion with status and timing
 */
export function logApiRequest(
  logger: ReturnType<typeof createApiRequestLogger>,
  statusCode: number,
  durationMs: number,
  additionalContext?: Record<string, unknown>
): void {
  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  const bindings = logger.bindings();
  
  (logger[logLevel as 'error' | 'warn' | 'info'] as any)(
    {
      statusCode,
      durationMs,
      ...additionalContext,
    },
    `${bindings.method} ${bindings.path}`
  );
}
