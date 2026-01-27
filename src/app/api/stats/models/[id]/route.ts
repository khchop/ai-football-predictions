import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStatsRequest } from '@/lib/utils/stats-auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { buildCacheKey, getStatsCache, setStatsCache } from '@/lib/api/stats/cache';
import { getDb, models } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getModelOverallStats, getModelCompetitionStats, getModelClubStats } from '@/lib/db/queries/stats';
import type { StatsResponse, ModelStats } from '@/lib/api/stats/types';
import { loggers } from '@/lib/logger/modules';

/**
 * GET /api/stats/models/[id] - Model-specific statistics endpoint
 *
 * Returns detailed performance statistics for a specific AI model, including:
 * - Overall stats (points, accuracy, streaks)
 * - Competition-scoped stats (if competition filter provided)
 * - Club-scoped stats (if club filter provided)
 *
 * @deprecated - No UI consumer currently uses this endpoint
 * @reserved - Endpoint is reserved for future model detail pages or analytical views
 *
 * Note: This endpoint is fully functional and follows the same authentication,
 * caching, and rate limiting patterns as other stats API routes. It was created
 * as part of Phase 2 Stats API work but has not yet been connected to any UI.
 *
 * Future use cases may include:
 * - Model detail pages showing comprehensive performance history
 * - Model comparison tools
 * - Analytical dashboards for model researchers
 */

const querySchema = z.object({
  season: z.string().optional(),
  competition: z.string().optional(),
  club: z.string().optional(),
  isHome: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
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
    const { id: modelId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse(Object.fromEntries(searchParams.entries()));

    // Verify model exists
    const db = getDb();
    const model = await db.query.models.findFirst({
      where: eq(models.id, modelId),
    });

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      );
    }

    const filters = { ...query, model: modelId };
    const cacheKey = buildCacheKey('model', filters);
    const cached = await getStatsCache<StatsResponse<ModelStats>>(cacheKey);

    if (cached) {
      loggers.api.debug({ cacheKey }, 'Model stats cache hit');
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }

    // Get overall stats
    const overallStats = await getModelOverallStats(modelId);

    if (!overallStats) {
      return NextResponse.json(
        { success: false, error: 'Model has no predictions yet' },
        { status: 404 }
      );
    }

    const response: StatsResponse<ModelStats> = {
      data: {
        modelId,
        displayName: model.displayName,
        provider: model.provider,
        overall: {
          totalPredictions: overallStats.totalPredictions,
          scoredPredictions: overallStats.scoredPredictions,
          totalPoints: overallStats.totalPoints,
          avgPoints: overallStats.avgPoints,
          accuracy: overallStats.accuracy,
          exactScores: overallStats.exactScores,
          correctTendencies: overallStats.correctTendencies,
          currentStreak: overallStats.currentStreak,
          bestStreak: overallStats.bestStreak,
        },
        competitions: [],
        clubs: [],
      },
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
        cacheKey,
        filters,
      },
    };

    // Add competition stats if requested
    if (query.competition) {
      const compStats = await getModelCompetitionStats(modelId, query.competition);
      if (compStats) {
        response.data.competitions.push({
          competitionId: compStats.competitionId,
          competitionName: compStats.competitionName,
          season: String(compStats.season),
          totalPredictions: compStats.totalPredictions,
          totalPoints: compStats.totalPoints,
          avgPoints: compStats.avgPoints,
          accuracy: compStats.accuracy,
        });
      }
    }

    // Add club stats if requested
    if (query.club) {
      const clubStats = await getModelClubStats(modelId, query.club, undefined, query.isHome);
      if (clubStats) {
        response.data.clubs.push({
          clubId: clubStats.clubId,
          clubName: clubStats.clubName,
          season: String(clubStats.season),
          isHome: clubStats.isHome,
          totalPredictions: clubStats.totalPredictions,
          totalPoints: clubStats.totalPoints,
          avgPoints: clubStats.avgPoints,
          accuracy: clubStats.accuracy,
        });
      }
    }

    await setStatsCache(cacheKey, response, 60);

    loggers.api.debug({ cacheKey }, 'Model stats cache miss');

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    loggers.api.error({ error: error instanceof Error ? error.message : String(error) }, 'Model stats error');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch model stats' },
      { status: 500 }
    );
  }
}
