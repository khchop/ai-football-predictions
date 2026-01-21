import { NextRequest, NextResponse } from 'next/server';
import { getAllModelsWithHealth, getFinishedMatchesWithUnscoredPredictions } from '@/lib/db/queries';
import { getBudgetStatus } from '@/lib/llm/budget';
import { OPENROUTER_PROVIDERS } from '@/lib/llm/providers/openrouter';

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.CRON_SECRET) {
    // SECURITY: Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin Auth] CRITICAL: CRON_SECRET not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Allow in development without password
    console.warn('[Admin Auth] CRON_SECRET not configured - allowing in development mode');
    return null;
  }
  
  if (password !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  // Validate password
  const authError = validateAdminRequest(request);
  if (authError) return authError;

  try {
    const [modelsWithHealth, budgetStatus, unscoredMatches] = await Promise.all([
      getAllModelsWithHealth(),
      getBudgetStatus(),
      getFinishedMatchesWithUnscoredPredictions(),
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
    const providerConfig = OPENROUTER_PROVIDERS.map(p => ({
      id: p.id,
      tier: p.tier,
    }));

    return NextResponse.json({
      models: modelsWithHealth,
      budgetStatus,
      providerConfig,
      healthCounts,
      unscoredMatches,
    });
  } catch (error) {
    console.error('Error fetching admin data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
