import { NextRequest, NextResponse } from 'next/server';
import { getMatchesNeedingRescore } from '@/lib/db/queries';
import { settlementQueue } from '@/lib/queue';
import { JOB_TYPES } from '@/lib/queue';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { loggers } from '@/lib/logger/modules';

export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`admin:rescore:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);
  
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

  // Admin authentication
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const log = loggers.api.child({ area: 'admin', action: 'rescore' });

  try {
    // 1. Find all matches that have unscored predictions
    const matches = await getMatchesNeedingRescore();
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches need re-scoring.',
        matchesProcessed: 0,
      });
    }

    log.info({ count: matches.length }, `Triggering re-score for ${matches.length} matches`);

    // 2. Queue a settlement job for each match
    const jobs = await Promise.all(
      matches.map(async (match) => {
        return settlementQueue.add(
          JOB_TYPES.SETTLE_MATCH,
          {
            matchId: match.id,
          },
          {
            priority: 2, // Slightly lower priority than live matches
            jobId: `rescore-${match.id}-${Date.now()}`,
          }
        );
      })
    );

    return NextResponse.json({
      success: true,
      message: `Successfully queued re-scoring for ${matches.length} matches.`,
      matchesProcessed: matches.length,
      jobIds: jobs.map(j => j.id),
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to trigger re-scoring');
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'admin-rescore') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
