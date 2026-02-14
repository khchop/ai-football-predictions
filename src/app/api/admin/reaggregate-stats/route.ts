/**
 * Re-aggregate Model Stats Admin API (Quick Task 050)
 *
 * Triggers re-aggregation of model health statistics for a date range.
 * Used to fix stale historical data after logic changes in model-stats queries.
 *
 * POST /api/admin/reaggregate-stats
 *   Body: { days?: number } (default: 30, max: 365)
 *   Returns: { success: true, daysProcessed, dateRange: { from, to } }
 *
 * SECURITY: Requires admin authentication via X-Admin-Password header
 * RATE LIMITING: Uses admin preset (stricter than public endpoints)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitHeaders,
  RATE_LIMIT_PRESETS,
} from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { aggregateDailyStats } from '@/lib/db/queries/model-stats';
import { format, subDays } from 'date-fns';

/**
 * POST /api/admin/reaggregate-stats
 *
 * Re-aggregates model health stats for the last N days.
 * Calls aggregateDailyStats() for each day in the range.
 *
 * Request body:
 *   days?: number (default: 30, max: 365)
 *
 * Response:
 *   { success: true, daysProcessed, dateRange: { from, to }, timestamp }
 */
export async function POST(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(
    `admin:reaggregate:${rateLimitKey}`,
    RATE_LIMIT_PRESETS.admin,
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetAt * 1000 - Date.now()) / 1000,
    );
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  // Admin authentication (timing-safe comparison)
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const days = typeof body.days === 'number' ? body.days : 30;

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'days must be between 1 and 365' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) },
      );
    }

    // Generate date range (from today back N days)
    const now = new Date();
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      dates.push(date);
    }

    // Re-aggregate stats for each day
    // Use Promise.all for parallel execution (aggregateDailyStats is idempotent via upsert)
    await Promise.all(dates.map((date) => aggregateDailyStats(date)));

    // Calculate date range for response
    const fromDate = dates[dates.length - 1]; // Oldest date
    const toDate = dates[0]; // Most recent date (today)

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        daysProcessed: days,
        dateRange: {
          from: fromDate,
          to: toDate,
        },
      },
      { headers: createRateLimitHeaders(rateLimitResult) },
    );
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-reaggregate-stats') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) },
    );
  }
}
