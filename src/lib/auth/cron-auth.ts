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
    console.warn('CRON_SECRET not configured - cron endpoints are unprotected!');
    return null; // Allow request if no secret configured (dev mode)
  }
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null; // Valid request
}
