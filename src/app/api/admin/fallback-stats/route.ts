import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import { MODEL_PROVIDER_ROUTES, getProviderById, TogetherProvider, SyntheticProvider, OpenRouterProvider } from '@/lib/llm';

interface FallbackStat {
  modelId: string;
  modelName: string;
  fallbackTo: string | null;
  fallbackToName: string | null;
  totalPredictions: number;
  fallbackCount: number;
  fallbackRate: number;
  estimatedOriginalCost: number;
  estimatedFallbackCost: number;
  costMultiplier: number;
  exceeds2x: boolean;
}

interface FallbackStats {
  stats: FallbackStat[];
  summary: {
    totalModelsWithFallback: number;
    totalFallbacksToday: number;
    modelsExceeding2x: number;
  };
}

/**
 * Calculate estimated cost for predictions
 * @param providerId - LLM provider ID
 * @param count - Number of predictions
 * @returns Estimated cost in USD
 */
function estimateCostForPredictions(providerId: string, count: number): number {
  const provider = getProviderById(providerId);
  if (!provider) return 0;

  // Type guard: Only TogetherProvider, SyntheticProvider, and OpenRouterProvider have pricing
  if (!(provider instanceof TogetherProvider) && !(provider instanceof SyntheticProvider) && !(provider instanceof OpenRouterProvider)) {
    return 0;
  }

  // Estimate ~500 input tokens, ~50 output tokens per prediction
  const inputTokens = 500;
  const outputTokens = 50;

  const inputCost = (inputTokens / 1_000_000) * provider.pricing.promptPer1M;
  const outputCost = (outputTokens / 1_000_000) * provider.pricing.completionPer1M;

  return (inputCost + outputCost) * count;
}

export async function GET(request: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`admin:fallback-stats:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  // Admin authentication
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const db = getDb();

    // Get today's start time (UTC midnight)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Aggregate fallback statistics from predictions table
    // Group by modelId, count total and fallback predictions
    // Get all provider IDs that appear in any route (these models participate in fallback)
    const modelsInRoutes = new Set<string>();
    for (const providers of Object.values(MODEL_PROVIDER_ROUTES)) {
      for (const providerId of providers) {
        modelsInRoutes.add(providerId);
      }
    }
    const modelsWithFallback = [...modelsInRoutes];
    const result = await db.execute<{
      modelId: string;
      totalPredictions: string;
      fallbackCount: string;
    }>(sql`
      SELECT
        "modelId",
        COUNT(*)::text as "totalPredictions",
        SUM(CASE WHEN "usedFallback" = true THEN 1 ELSE 0 END)::text as "fallbackCount"
      FROM predictions
      WHERE "createdAt" >= ${todayStart.toISOString()}
      GROUP BY "modelId"
      HAVING
        "modelId" = ANY(ARRAY[${sql.raw(modelsWithFallback.map(m => `'${m}'`).join(','))}])
        OR SUM(CASE WHEN "usedFallback" = true THEN 1 ELSE 0 END) > 0
      ORDER BY
        SUM(CASE WHEN "usedFallback" = true THEN 1 ELSE 0 END) DESC
    `);

    const stats: FallbackStat[] = [];
    let totalFallbacksToday = 0;
    let modelsExceeding2x = 0;

    for (const row of result.rows) {
      const totalPredictions = parseInt(row.totalPredictions, 10);
      const fallbackCount = parseInt(row.fallbackCount, 10);
      const fallbackRate = totalPredictions > 0 ? fallbackCount / totalPredictions : 0;

      // Find the next provider in route for this model (its fallback target)
      let fallbackTargetId: string | null = null;
      for (const providers of Object.values(MODEL_PROVIDER_ROUTES)) {
        const idx = providers.indexOf(row.modelId);
        if (idx !== -1 && idx < providers.length - 1) {
          fallbackTargetId = providers[idx + 1];
          break;
        }
      }
      const originalProvider = getProviderById(row.modelId);
      const fallbackProvider = fallbackTargetId ? getProviderById(fallbackTargetId) : null;

      // Calculate costs
      const estimatedOriginalCost = estimateCostForPredictions(row.modelId, fallbackCount);
      const estimatedFallbackCost = fallbackTargetId && fallbackProvider
        ? estimateCostForPredictions(fallbackTargetId, fallbackCount)
        : 0;

      const costMultiplier = estimatedOriginalCost > 0
        ? estimatedFallbackCost / estimatedOriginalCost
        : 0;

      const exceeds2x = costMultiplier > 2.0;

      stats.push({
        modelId: row.modelId,
        modelName: originalProvider?.displayName || row.modelId,
        fallbackTo: fallbackTargetId || null,
        fallbackToName: fallbackProvider?.displayName || null,
        totalPredictions,
        fallbackCount,
        fallbackRate,
        estimatedOriginalCost,
        estimatedFallbackCost,
        costMultiplier,
        exceeds2x,
      });

      totalFallbacksToday += fallbackCount;
      if (exceeds2x) modelsExceeding2x++;
    }

    const response: FallbackStats = {
      stats,
      summary: {
        totalModelsWithFallback: stats.length,
        totalFallbacksToday,
        modelsExceeding2x,
      },
    };

    return NextResponse.json(response, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'admin-fallback-stats') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
