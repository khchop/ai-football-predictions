import { NextRequest, NextResponse } from 'next/server';
import { getAllModelsWithHealth } from '@/lib/db/queries';
import { getBudgetStatus } from '@/lib/llm/budget';
import { TOGETHER_PROVIDERS } from '@/lib/llm/providers/together';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.ADMIN_PASSWORD) {
    // SECURITY: Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin Auth] CRITICAL: ADMIN_PASSWORD not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Allow in development without password
    console.warn('[Admin Auth] ADMIN_PASSWORD not configured - allowing in development mode');
    return null;
  }
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  // Rate limit check (first, before auth)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`admin:data:${rateLimitKey}`, RATE_LIMIT_PRESETS.admin);
  
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

  // Validate password
  const authError = validateAdminRequest(request);
  if (authError) return authError;

  try {
    const [modelsWithHealth, budgetStatus] = await Promise.all([
      getAllModelsWithHealth(),
      getBudgetStatus(),
    ]);

    // Count health statuses
    const healthCounts = {
      healthy: 0,
      degraded: 0,
      failing: 0,
      disabled: 0,
    };

    for (const model of modelsWithHealth) {
      if (model.autoDisabled) {
        healthCounts.disabled++;
      } else if ((model.consecutiveFailures || 0) >= 2) {
        healthCounts.failing++;
      } else if ((model.consecutiveFailures || 0) >= 1) {
        healthCounts.degraded++;
      } else {
        healthCounts.healthy++;
      }
    }

    // Get provider config for tier info (simplified for JSON)
    const providerConfig = TOGETHER_PROVIDERS.map(p => ({
      id: p.id,
      tier: p.tier,
    }));

    return NextResponse.json(
      {
        models: modelsWithHealth,
        budgetStatus,
        providerConfig,
        healthCounts,
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
