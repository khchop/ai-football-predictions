import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardFiltered, getActiveModels, getActiveCompetitions } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = checkRateLimit(`leaderboard:${rateLimitKey}`, RATE_LIMIT_PRESETS.standard);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse and validate query parameters
    const daysParam = searchParams.get('days');
    const minPredictionsParam = searchParams.get('minPredictions');
    const activeOnlyParam = searchParams.get('activeOnly');
    const competitionParam = searchParams.get('competition');
    
    // Validate numeric params with bounds
    const parsedDays = daysParam ? parseInt(daysParam, 10) : undefined;
    const parsedMinPredictions = minPredictionsParam ? parseInt(minPredictionsParam, 10) : 5;
    
    const filters = {
      days: parsedDays && !isNaN(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : undefined,
      minPredictions: isNaN(parsedMinPredictions) ? 5 : Math.min(Math.max(parsedMinPredictions, 0), 1000),
      activeOnly: activeOnlyParam !== 'false', // Default true
      competitionId: competitionParam || undefined,
    };

    const leaderboard = await getLeaderboardFiltered(filters);
    const activeModels = await getActiveModels();
    const competitions = await getActiveCompetitions();

    return NextResponse.json(
      {
        success: true,
        leaderboard,
        activeModels: activeModels.length,
        totalEntries: leaderboard.length,
        competitions: competitions.map(c => ({ id: c.id, name: c.name })),
        filters: {
          days: filters.days || 'all',
          minPredictions: filters.minPredictions,
          activeOnly: filters.activeOnly,
          competition: filters.competitionId || 'all',
        },
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An internal error occurred'
      },
      { status: 500 }
    );
  }
}
