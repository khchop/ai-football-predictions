/**
 * Authentication middleware for stats API endpoints
 * Uses Bearer token authentication pattern (similar to cron auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger/modules';

export interface AuthenticatedRequest {
  userId: string;
  request: NextRequest;
}

/**
 * Validates Bearer token for stats API endpoints.
 * Returns null if valid, or an error response if invalid.
 *
 * Usage in stats routes:
 * ```
 * const authError = validateStatsRequest(request);
 * if (authError) return authError;
 * ```
 */
export function validateStatsRequest(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    loggers.auth.warn({}, 'Missing Authorization header for stats API');
    return NextResponse.json(
      { success: false, error: 'Authorization required' },
      { status: 401 }
    );
  }

  // Check Bearer token format
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    loggers.auth.warn({}, 'Invalid Authorization header format');
    return NextResponse.json(
      { success: false, error: 'Invalid authorization format. Use: Bearer <token>' },
      { status: 401 }
    );
  }

  // Validate against CRON_SECRET (same as cron endpoints)
  if (!process.env.CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      loggers.auth.error({}, 'CRON_SECRET not configured in production');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    loggers.auth.warn({}, 'CRON_SECRET not configured - allowing in development');
    return null;
  }

  if (token !== process.env.CRON_SECRET) {
    loggers.auth.warn({}, 'Invalid token for stats API');
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Valid request
}
