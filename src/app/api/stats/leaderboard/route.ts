import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStatsRequest } from '@/lib/utils/stats-auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { buildCacheKey, getStatsCache, setStatsCache } from '@/lib/api/stats/cache';
import { getLeaderboard, type LeaderboardMetric } from '@/lib/db/queries/stats';
import type { StatsResponse } from '@/lib/api/stats/types';
import type { LeaderboardEntry } from '@/lib/db/queries/stats';
import { loggers } from '@/lib/logger/modules';

const querySchema = z.object({
  metric: z.enum(['totalPoints', 'avgPoints', 'accuracy', 'exactScores']).default('avgPoints'),
  competition: z.string().optional(),
  season: z.string().optional(),
  model: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;
    const params = querySchema.parse(Object.fromEntries(searchParams.entries()));

    const cacheKey = buildCacheKey('leaderboard', params);
    const cached = await getStatsCache<StatsResponse<LeaderboardEntry[]>>(cacheKey);

    if (cached) {
      loggers.api.debug({ cacheKey }, 'Leaderboard cache hit');
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    // Get leaderboard sorted by specified metric
    const leaderboard = await getLeaderboard(params.limit, params.metric as LeaderboardMetric);

    const response: StatsResponse<LeaderboardEntry[]> = {
      data: leaderboard,
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        cacheKey,
        filters: params,
      },
    };

    await setStatsCache(cacheKey, response, 60);

    loggers.api.debug({ cacheKey }, 'Leaderboard cache miss');

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    loggers.api.error({ error: error instanceof Error ? error.message : String(error) }, 'Leaderboard error');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
