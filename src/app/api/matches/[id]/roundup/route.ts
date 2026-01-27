import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, CACHE_TTL, cacheKeys } from '@/lib/cache/redis';
import { getDb, matchRoundups } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * GET /api/matches/{matchId}/roundup
 * 
 * Fetch roundup content for a match with caching.
 * Returns 404 if no roundup exists.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  
  try {
    // Check cache first
    const cacheKey = cacheKeys.roundup(matchId);
    const cachedRoundup = await cacheGet<RoundupResponse>(cacheKey);
    
    if (cachedRoundup) {
      // Return cached response with appropriate headers
      return new NextResponse(JSON.stringify(cachedRoundup), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Cache': 'HIT',
        },
      });
    }
    
    // Cache miss - fetch from database
    const db = getDb();
    const roundup = await db
      .select()
      .from(matchRoundups)
      .where(eq(matchRoundups.matchId, matchId))
      .limit(1);
    
    if (!roundup || roundup.length === 0) {
      return NextResponse.json(
        { exists: false, message: 'No roundup found for this match' },
        { status: 404 }
      );
    }
    
    const roundupData = roundup[0];
    
    // Parse JSON fields from database
    const scoreboard = JSON.parse(roundupData.scoreboard);
    const events = roundupData.events ? JSON.parse(roundupData.events) : [];
    const stats = JSON.parse(roundupData.stats);
    const topPerformers = JSON.parse(roundupData.topPerformers);
    
    // Build response
    const responseData: RoundupResponse = {
      id: roundupData.id,
      matchId: roundupData.matchId,
      title: roundupData.title,
      scoreboard,
      events,
      stats,
      modelPredictions: roundupData.modelPredictions,
      topPerformers,
      narrative: roundupData.narrative,
      keywords: roundupData.keywords ? roundupData.keywords.split(',').map((k: string) => k.trim()) : [],
      generatedAt: roundupData.createdAt || new Date(),
    };
    
    // Cache the response for 24 hours
    await cacheSet(cacheKey, responseData, CACHE_TTL.ROUNDUP);
    
    // Return with caching headers
    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error(`Error fetching roundup for match ${matchId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch roundup' },
      { status: 500 }
    );
  }
}

/**
 * Response type for roundup data
 */
interface RoundupResponse {
  id: string;
  matchId: string;
  title: string;
  scoreboard: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    competition: string;
    venue?: string;
    kickoff?: string;
  };
  events: Array<{
    minute: number;
    type: string;
    description: string;
  }>;
  stats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    xG: number;
    [key: string]: number;
  };
  modelPredictions: string;
  topPerformers: Array<{
    modelName: string;
    prediction: string;
    points: number;
  }>;
  narrative: string;
  keywords: string[];
  generatedAt: Date | string;
}
