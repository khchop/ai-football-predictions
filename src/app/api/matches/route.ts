import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingMatches, getRecentMatches, getFinishedMatches, getOverallStats } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { validateQuery } from '@/lib/validation/middleware';
import { getMatchesQuerySchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  // Apply rate limiting (60 req/min)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`matches:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  
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
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const { data: validatedQuery, error: validationError } = validateQuery(getMatchesQuerySchema, queryParams);
    if (validationError) {
      return validationError;
    }
    
    const { type, limit } = validatedQuery;

    let matches;
    
    switch (type) {
      case 'upcoming':
        matches = await getUpcomingMatches(48);
        break;
      case 'recent':
        matches = await getRecentMatches(limit);
        break;
      case 'finished':
        matches = await getFinishedMatches(limit);
        break;
      default:
        matches = await getRecentMatches(limit);
    }

    // Get overall stats
    const stats = await getOverallStats();

    // Format response
    const formattedMatches = matches.map(({ match, competition }) => ({
      id: match.id,
      externalId: match.externalId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeTeamLogo: match.homeTeamLogo,
      awayTeamLogo: match.awayTeamLogo,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      kickoffTime: match.kickoffTime,
      status: match.status,
      round: match.round,
      venue: match.venue,
      competition: {
        id: competition.id,
        name: competition.name,
      },
    }));

    return NextResponse.json(
      {
        success: true,
        matches: formattedMatches,
        stats,
        count: formattedMatches.length,
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An internal error occurred'
      },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
