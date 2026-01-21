import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the X-Cron-Secret header against the CRON_SECRET environment variable.
 * Returns null if valid, or an error response if invalid.
 * 
 * Usage in cron routes:
 * ```
 * const authError = validateCronRequest(request);
 * if (authError) return authError;
 * ```
 */
export function validateCronRequest(request: NextRequest): NextResponse | null {
  const secret = request.headers.get('X-Cron-Secret');
  
  if (!process.env.CRON_SECRET) {
    // SECURITY: Fail closed in production - never allow unauthenticated access
    if (process.env.NODE_ENV === 'production') {
      console.error('[Cron Auth] CRITICAL: CRON_SECRET not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Only allow unauthenticated access in development
    console.warn('[Cron Auth] CRON_SECRET not configured - allowing in development mode');
    return null;
  }
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null; // Valid request
}
