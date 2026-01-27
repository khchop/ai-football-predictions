import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStatsRequest } from '@/lib/utils/stats-auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { buildCacheKey, getStatsCache, setStatsCache } from '@/lib/api/stats/cache';
import { getDb, matches } from '@/lib/db';
import { eq, or } from 'drizzle-orm';
import { getLeaderboard, type LeaderboardFilters } from '@/lib/db/queries/stats';
import type { StatsResponse, ClubStats } from '@/lib/api/stats/types';
import { loggers } from '@/lib/logger/modules';

const querySchema = z.object({
  season: z.string().optional(),
  isHome: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  model: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateStatsRequest(request);
  if (authError) return authError;

  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`stats:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const { id: clubId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse(Object.fromEntries(searchParams.entries()));

    // Verify club has matches
    const db = getDb();
    const matchCheck = await db.query.matches.findFirst({
      where: or(eq(matches.homeTeam, clubId), eq(matches.awayTeam, clubId)),
    });

    if (!matchCheck) {
      return NextResponse.json(
        { success: false, error: 'Club not found or has no matches' },
        { status: 404 }
      );
    }

    const filters = { ...query, club: clubId };
    const cacheKey = buildCacheKey('club', filters);
    const cached = await getStatsCache<StatsResponse<ClubStats>>(cacheKey);

    if (cached) {
      loggers.api.debug({ cacheKey }, 'Club stats cache hit');
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    // Build filters from query params and route param
    const leaderboardFilters: LeaderboardFilters = {
      clubId,
      isHome: query.isHome,
      season: query.season ? parseInt(query.season, 10) : undefined,
    };

    // Get leaderboard filtered by club
    const leaderboard = await getLeaderboard(query.limit, 'avgPoints', leaderboardFilters);

    const response: StatsResponse<ClubStats> = {
      data: {
        clubId,
        clubName: clubId, // Use ID as name if not found
        season: query.season || 'current',
        isHome: query.isHome,
        models: leaderboard.map((entry) => ({
          modelId: entry.modelId,
          displayName: entry.displayName,
          provider: entry.provider,
          totalPredictions: entry.totalPredictions,
          totalPoints: entry.totalPoints,
          avgPoints: entry.avgPoints,
          accuracy: entry.accuracy,
          wins: entry.correctTendencies,
          draws: 0,
          losses: entry.totalPredictions - entry.correctTendencies,
        })),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        cacheKey,
        filters,
      },
    };

    await setStatsCache(cacheKey, response, 60);

    loggers.api.debug({ cacheKey }, 'Club stats cache miss');

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    loggers.api.error({ error: error instanceof Error ? error.message : String(error) }, 'Club stats error');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club stats' },
      { status: 500 }
    );
  }
}
