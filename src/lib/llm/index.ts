import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_PROVIDERS } from './providers/together';
import { SYNTHETIC_PROVIDERS } from './providers/synthetic';
import { getAutoDisabledModelIds } from '@/lib/db/queries';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
import { getDb, models } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

// All available providers - Together AI + Synthetic.new
// Together: 29 models, Synthetic: 13 exclusive models = 42 total
export const ALL_PROVIDERS: LLMProvider[] = [
  ...TOGETHER_PROVIDERS,
  ...SYNTHETIC_PROVIDERS,
];

// ============================================================================
// MODEL FALLBACKS
// Maps Synthetic model IDs to Together AI equivalents (same or similar models)
// Used when a Synthetic model fails and we want to try Together AI instead
// ============================================================================

/**
 * Fallback mapping: Synthetic model ID -> Together AI model ID
 * Only includes models with close equivalents on both providers
 */
export const MODEL_FALLBACKS: Record<string, string> = {
  // DeepSeek R1 variants (reasoning models)
  // Synthetic R1 0528 -> Together R1 (version difference, same model family)
  'deepseek-r1-0528-syn': 'deepseek-r1',

  // Kimi K2 variants (Thinking -> Instruct fallback)
  // Same base model, different tuning (thinking vs instruction-following)
  'kimi-k2-thinking-syn': 'kimi-k2-instruct',

  // Kimi K2.5 (non-thinking variant)
  'kimi-k2.5-syn': 'kimi-k2-instruct',

  // Note: Most Synthetic models are exclusive and have no Together AI equivalent:
  // - DeepSeek V3 variants (0324, Terminus, V3.2) - not on Together
  // - MiniMax M2/M2.1 - not on Together
  // - GLM 4.6/4.7 - not on Together
  // - Qwen3 Coder 480B - not on Together
  // - GPT-OSS 120B - Together only has 20B
};

let fallbacksValidated = false;

/**
 * Get fallback provider for a Synthetic model
 * @param syntheticModelId - The Synthetic model ID that failed
 * @returns The equivalent Together AI provider, or undefined if no fallback exists
 */
export function getFallbackProvider(syntheticModelId: string): LLMProvider | undefined {
  if (!fallbacksValidated) {
    validateFallbackMapping();
    fallbacksValidated = true;
  }

  const fallbackId = MODEL_FALLBACKS[syntheticModelId];
  if (!fallbackId) {
    return undefined;
  }

  // Check if Together API key is configured
  if (!process.env.TOGETHER_API_KEY) {
    return undefined;
  }

  return ALL_PROVIDERS.find(p => p.id === fallbackId);
}

/**
 * Validate fallback mapping at startup
 * Checks:
 * 1. All fallback target models exist in ALL_PROVIDERS
 * 2. No cycles in fallback chain (though with max depth 1, cycles are unlikely but still bad config)
 */
function validateFallbackMapping(): void {
  const providerIds = new Set(ALL_PROVIDERS.map(p => p.id));

  for (const [syntheticId, fallbackId] of Object.entries(MODEL_FALLBACKS)) {
    // Check fallback target exists
    if (!providerIds.has(fallbackId)) {
      throw new Error(
        `Invalid fallback mapping: ${syntheticId} -> ${fallbackId}. ` +
        `Target model "${fallbackId}" not found in ALL_PROVIDERS. ` +
        `Available providers: ${[...providerIds].join(', ')}`
      );
    }

    // Check for direct self-reference (model can't be its own fallback)
    if (syntheticId === fallbackId) {
      throw new Error(
        `Invalid fallback mapping: ${syntheticId} -> ${fallbackId}. ` +
        `Model cannot be its own fallback.`
      );
    }

    // Check for simple cycle (A -> B -> A)
    // With max depth 1 this is the only cycle pattern that matters
    const fallbackOfFallback = MODEL_FALLBACKS[fallbackId];
    if (fallbackOfFallback === syntheticId) {
      throw new Error(
        `Cycle detected in fallback mapping: ${syntheticId} -> ${fallbackId} -> ${syntheticId}. ` +
        `Fallback chains must not form cycles.`
      );
    }
  }

  loggers.llm.info({
    mappingCount: Object.keys(MODEL_FALLBACKS).length,
    mappings: MODEL_FALLBACKS,
  }, 'Fallback mapping validated successfully');
}

// ============================================================================
// USAGE NOTES:
// - Call getFallbackProvider(modelId) when a Synthetic model fails
// - Returns undefined if no fallback exists or TOGETHER_API_KEY not set
// - Integration into prediction pipeline is a future enhancement
// - Currently 3 fallbacks configured (deepseek-r1, kimi-k2-thinking, kimi-k2.5)
// ============================================================================

// Get active providers (checks if API keys are configured and filters auto-disabled models)
export async function getActiveProviders(): Promise<LLMProvider[]> {
  // Filter out auto-disabled models
  const disabledIds = await getAutoDisabledModelIds();

  const activeProviders: LLMProvider[] = [];

  // Add Together providers if API key configured
  if (process.env.TOGETHER_API_KEY) {
    activeProviders.push(
      ...TOGETHER_PROVIDERS.filter(p => !disabledIds.has(p.id))
    );
  }

  // Add Synthetic providers if API key configured
  if (process.env.SYNTHETIC_API_KEY) {
    activeProviders.push(
      ...SYNTHETIC_PROVIDERS.filter(p => !disabledIds.has(p.id))
    );
  }

  if (disabledIds.size > 0) {
    loggers.llm.info({
      disabledCount: disabledIds.size,
      activeCount: activeProviders.length,
    }, 'Filtered auto-disabled models');
  }

  return activeProviders;
}

// Get provider by ID
export function getProviderById(id: string): LLMProvider | undefined {
  return ALL_PROVIDERS.find(p => p.id === id);
}

// Get all free providers
export function getFreeProviders(): LLMProvider[] {
  return ALL_PROVIDERS.filter(p => !p.isPremium);
}

// Get all premium providers
export function getPremiumProviders(): LLMProvider[] {
  return ALL_PROVIDERS.filter(p => p.isPremium);
}

// Get provider count by category
export function getProviderStats(): {
  total: number;
  free: number;
  ultraBudget: number;
  budget: number;
  premium: number;
  together: number;
  synthetic: number;
} {
  // Combine both provider arrays for tier counting
  // Both TogetherProvider and SyntheticProvider have tier property
  const allProviders = [...TOGETHER_PROVIDERS, ...SYNTHETIC_PROVIDERS];
  return {
    total: allProviders.length,
    free: allProviders.filter(p => p.tier === 'free').length,
    ultraBudget: allProviders.filter(p => p.tier === 'ultra-budget').length,
    budget: allProviders.filter(p => p.tier === 'budget').length,
    premium: allProviders.filter(p => p.tier === 'premium').length,
    together: TOGETHER_PROVIDERS.length,
    synthetic: SYNTHETIC_PROVIDERS.length,
  };
}

/**
 * Get active model count from database (cached)
 * This is the SINGLE SOURCE OF TRUTH for model count in UI/content
 *
 * Queries database `models.active = true`, not provider arrays.
 * Provider arrays show configured models (42), this shows operationally active ones.
 *
 * @returns Number of active models from database
 */
export async function getActiveModelCount(): Promise<number> {
  return withCache(
    cacheKeys.activeModelCount(),
    CACHE_TTL.STATS, // 60s TTL (same as overall stats)
    async () => {
      const db = getDb();
      const result = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(models)
        .where(eq(models.active, true));
      return result[0]?.count || 0;
    }
  );
}

// Export providers
export { TOGETHER_PROVIDERS };
export { SYNTHETIC_PROVIDERS };

// Re-export Together AI provider class for type checking
export { TogetherProvider, type ModelTier, type ModelPricing } from './providers/together';

// Re-export Synthetic provider class
export { SyntheticProvider } from './providers/synthetic';

// Re-export batch prediction types
export { type BatchPredictionResult } from './providers/base';
export { 
  type BatchParsedResult, 
  type BatchPredictionItem,
  BATCH_SYSTEM_PROMPT,
  parseBatchPredictionResponse,
} from './prompt';
