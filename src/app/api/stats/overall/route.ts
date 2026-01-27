import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStatsRequest } from '@/lib/utils/stats-auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { buildCacheKey, getStatsCache, setStatsCache } from '@/lib/api/stats/cache';
import { getLeaderboard } from '@/lib/db/queries/stats';
import type { StatsResponse, OverallStats } from '@/lib/api/stats/types';
import { loggers } from '@/lib/logger/modules';

const querySchema = z.object({
  season: z.string().optional(),
  model: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  // Authentication
  const authError = validateStatsRequest(request);
  if (authError) return authError;

  // Rate limiting (60 req/min)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`stats:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const params = querySchema.parse(Object.fromEntries(searchParams.entries()));

    const cacheKey = buildCacheKey('overall', params);
    const cached = await getStatsCache<StatsResponse<OverallStats>>(cacheKey);

    if (cached) {
      loggers.api.debug({ cacheKey }, 'Overall stats cache hit');
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    // Fetch leaderboard data
    const leaderboard = await getLeaderboard(params.limit);

    const response: StatsResponse<OverallStats> = {
      data: {
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
        totalPredictions: leaderboard.reduce((sum, m) => sum + m.totalPredictions, 0),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        cacheKey,
        filters: params,
      },
    };

    await setStatsCache(cacheKey, response, 60);

    loggers.api.debug({ cacheKey }, 'Overall stats cache miss');

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    loggers.api.error({ error: error instanceof Error ? error.message : String(error) }, 'Overall stats error');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overall stats' },
      { status: 500 }
    );
  }
}
