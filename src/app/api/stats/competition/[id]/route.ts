import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStatsRequest } from '@/lib/utils/stats-auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { buildCacheKey, getStatsCache, setStatsCache } from '@/lib/api/stats/cache';
import { getDb, competitions } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getLeaderboard, type LeaderboardFilters } from '@/lib/db/queries/stats';
import type { StatsResponse, CompetitionStats } from '@/lib/api/stats/types';
import { loggers } from '@/lib/logger/modules';

const querySchema = z.object({
  season: z.string().optional(),
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
    const { id: competitionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse(Object.fromEntries(searchParams.entries()));

    // Verify competition exists
    const db = getDb();
    const competition = await db.query.competitions.findFirst({
      where: eq(competitions.id, competitionId),
    });

    if (!competition) {
      return NextResponse.json(
        { success: false, error: 'Competition not found' },
        { status: 404 }
      );
    }

    const filters = { ...query, competition: competitionId };
    const cacheKey = buildCacheKey('competition', filters);
    const cached = await getStatsCache<StatsResponse<CompetitionStats>>(cacheKey);

    if (cached) {
      loggers.api.debug({ cacheKey }, 'Competition stats cache hit');
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    // Build filters from query params and route param
    const leaderboardFilters: LeaderboardFilters = {
      competitionId,
      season: query.season ? parseInt(query.season, 10) : undefined,
    };

    // Get leaderboard filtered by competition
    const leaderboard = await getLeaderboard(query.limit, 'avgPoints', leaderboardFilters);

    const response: StatsResponse<CompetitionStats> = {
      data: {
        competitionId,
        competitionName: competition.name,
        season: String(competition.season),
        models: leaderboard.map((entry) => ({
          rank: entry.rank,
          modelId: entry.modelId,
          displayName: entry.displayName,
          provider: entry.provider,
          totalPredictions: entry.totalPredictions,
          scoredPredictions: entry.totalPredictions,
          totalPoints: entry.totalPoints,
          avgPoints: entry.avgPoints,
          accuracy: entry.accuracy,
          exactScores: entry.exactScores,
          correctTendencies: entry.correctTendencies,
        })),
        totalModels: leaderboard.length,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        cacheKey,
        filters,
      },
    };

    await setStatsCache(cacheKey, response, 60);

    loggers.api.debug({ cacheKey }, 'Competition stats cache miss');

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    loggers.api.error({ error: error instanceof Error ? error.message : String(error) }, 'Competition stats error');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competition stats' },
      { status: 500 }
    );
  }
}
