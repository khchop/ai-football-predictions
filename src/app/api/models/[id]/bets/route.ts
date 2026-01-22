import { NextRequest, NextResponse } from 'next/server';
import { getModelBettingHistory, getModelBettingStats } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = checkRateLimit(`model-bets:${rateLimitKey}`, RATE_LIMIT_PRESETS.standard);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  const { id: modelId } = await params;
  
  // Validate model ID format
  if (!UUID_REGEX.test(modelId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid model ID format' },
      { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status') as 'pending' | 'won' | 'lost' | null;

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
    console.error('Error fetching model bets:', error);
    return NextResponse.json(
      { 
        success: false,
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to fetch bets'
      },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
