/**
 * Pipeline Health Admin API (MON-02)
 *
 * Shows matches approaching kickoff (within 6h) that have no scheduled
 * analysis or predictions jobs. Gaps classified by severity:
 * - critical: < 2h to kickoff
 * - warning: 2-4h to kickoff
 * - info: 4-6h to kickoff
 *
 * SECURITY: Requires admin authentication via X-Admin-Password header
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { getMatchCoverage, classifyGapsBySeverity } from '@/lib/monitoring/pipeline-coverage';

/**
 * GET /api/admin/pipeline-health - View pipeline coverage gaps
 * Returns matches within 6h of kickoff without scheduled jobs.
 * Rate limited to 10 requests per minute.
 */
export async function GET(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(`admin:pipeline-health:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  // Admin authentication (timing-safe comparison)
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    // Get coverage data for 6-hour window (early warning)
    const coverage = await getMatchCoverage(6);
    const severity = classifyGapsBySeverity(coverage.gaps);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        coveragePercentage: Math.round(coverage.percentage * 10) / 10,
        totalMatches: coverage.totalMatches,
        coveredMatches: coverage.coveredMatches,
        totalGaps: coverage.gaps.length,
      },
      gapsBySeverity: {
        critical: severity.critical.length,
        warning: severity.warning.length,
        info: severity.info.length,
      },
      matches: {
        critical: severity.critical,
        warning: severity.warning,
        info: severity.info,
      },
    }, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-pipeline-health') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
