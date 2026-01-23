import { NextRequest, NextResponse } from 'next/server';
import { getModelBettingHistory, getModelBettingStats } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { validateParams, validateQuery } from '@/lib/validation/middleware';
import { getModelBetsParamsSchema, getModelBetsQuerySchema } from '@/lib/validation/schemas';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting (60 req/min)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`model-bets:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  
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

  const resolvedParams = await params;
  
  // Validate route parameters
  const { data: validatedParams, error: paramsError } = validateParams(getModelBetsParamsSchema, resolvedParams);
  if (paramsError) {
    return paramsError;
  }
  
  const { id: modelId } = validatedParams;
  
  const searchParams = request.nextUrl.searchParams;
  const queryParams = Object.fromEntries(searchParams.entries());
  
  // Validate query parameters
  const { data: validatedQuery, error: queryError } = validateQuery(getModelBetsQuerySchema, queryParams);
  if (queryError) {
    return queryError;
  }
  
  const { limit, offset, status } = validatedQuery;

  try {
    // Fetch betting history
    const bets = await getModelBettingHistory(modelId, {
      limit: limit + 1,
      offset,
      status: status || undefined,
    });

    const hasMore = bets.length > limit;
    const data = hasMore ? bets.slice(0, limit) : bets;

    // Fetch betting stats
    const stats = await getModelBettingStats(modelId);

    return NextResponse.json(
      {
        success: true,
        bets: data,
        stats,
        hasMore,
        offset: offset + data.length,
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: sanitizeError(error, 'model-bets')
      },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
