import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, getActiveModels } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { validateQuery } from '@/lib/validation/middleware';
import { getLeaderboardQuerySchema } from '@/lib/validation/schemas';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

export async function GET(request: NextRequest) {
  // Apply rate limiting (60 req/min)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`leaderboard:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const { data: validatedQuery, error: validationError } = validateQuery(getLeaderboardQuerySchema, queryParams);
    if (validationError) {
      return validationError;
    }
    
    const { activeOnly, competitionId, timeRange, limit } = validatedQuery;

    // Get leaderboard with filters (by average points, Kicktipp Quota Scoring)
    let leaderboard = await getLeaderboard({
      competitionId,
      timeRange,
      limit,
    });

    // Filter to active models only if requested (redundant since query already filters, but kept for API compatibility)
    if (activeOnly) {
      leaderboard = leaderboard.filter(m => m.model.active);
    }

    const activeModels = await getActiveModels();

    return NextResponse.json(
      {
        success: true,
        leaderboard,
        activeModels: activeModels.length,
        totalEntries: leaderboard.length,
        filters: {
          competitionId: competitionId || null,
          timeRange,
        },
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
   } catch (error) {
     return NextResponse.json(
       { 
         success: false, 
         error: sanitizeError(error, 'leaderboard')
       },
       { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
     );
   }
}
