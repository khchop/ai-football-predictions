/**
 * Model Health Admin API (Phase 58-02)
 *
 * Returns per-model health summaries and detailed trend data for the
 * admin dashboard.  Two modes:
 *   - No params  -> summary for all active models (overview cards)
 *   - ?modelId=x -> detailed 7/30/90-day trends for one model (chart)
 *
 * SECURITY: Requires admin authentication via X-Admin-Password header
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import {
  checkRateLimit,
  getRateLimitKey,
  createRateLimitHeaders,
  RATE_LIMIT_PRESETS,
} from '@/lib/utils/rate-limiter';
import { sanitizeError } from '@/lib/utils/error-sanitizer';
import {
  getAllModelHealthSummary,
  getModelHealthTrends,
} from '@/lib/db/queries/model-stats';

/**
 * GET /api/admin/model-health
 *
 * Query params:
 *   (none)     - Returns summary for all models
 *   modelId    - Returns detailed trends for a single model
 */
export async function GET(req: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(req);
  const rateLimitResult = await checkRateLimit(
    `admin:model-health:${rateLimitKey}`,
    RATE_LIMIT_PRESETS.admin,
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetAt * 1000 - Date.now()) / 1000,
    );
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  // Admin authentication (timing-safe comparison)
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('modelId');

    if (modelId) {
      // Detail mode: trends for one model
      const trends = await getModelHealthTrends(modelId);

      return NextResponse.json(
        {
          timestamp: new Date().toISOString(),
          modelId,
          trends,
        },
        { headers: createRateLimitHeaders(rateLimitResult) },
      );
    }

    // Summary mode: all models
    const models = await getAllModelHealthSummary();

    const healthy = models.filter((m) => m.status === 'healthy').length;
    const warning = models.filter((m) => m.status === 'warning').length;
    const critical = models.filter((m) => m.status === 'critical').length;

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalModels: models.length,
          healthy,
          warning,
          critical,
        },
        models,
      },
      { headers: createRateLimitHeaders(rateLimitResult) },
    );
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'admin-model-health') },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) },
    );
  }
}
