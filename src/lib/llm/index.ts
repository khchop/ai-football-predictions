import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_PROVIDERS } from './providers/together';
import { SYNTHETIC_PROVIDERS } from './providers/synthetic';
import { OPENROUTER_PROVIDERS } from './providers/openrouter';
import { getAutoDisabledModelIds } from '@/lib/db/queries';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
import { getDb, models } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

// All non-conditional providers - Together AI + Synthetic.new
// OpenRouter providers are conditional (only in getActiveProviders when API key set)
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
 * Phase 57 Audit: 3/13 mappable, 10/13 exclusive
 *
 * Fallback mapping: Synthetic model ID -> Together AI model ID
 * Only includes models with close equivalents on both providers.
 *
 * Exhaustive Synthetic model fallback status (13 models):
 *
 * MAPPED (3/13) - Have Together AI fallbacks:
 * ┌─────────────────────────┬────────────────────┬──────────────────────────────────────────────┐
 * │ Synthetic Model ID      │ Together Fallback   │ Rationale                                    │
 * ├─────────────────────────┼────────────────────┼──────────────────────────────────────────────┤
 * │ deepseek-r1-0528-syn    │ deepseek-r1        │ Same model family, version difference only   │
 * │ kimi-k2-thinking-syn    │ kimi-k2-instruct   │ Same base model, thinking vs instruct tuning │
 * │ kimi-k2.5-syn           │ kimi-k2-instruct   │ Same Kimi family fallback                    │
 * └─────────────────────────┴────────────────────┴──────────────────────────────────────────────┘
 *
 * EXCLUSIVE (10/13) - No valid Together AI fallback:
 * ┌──────────────────────────────┬──────────────────────────────────────────────────────────────┬─────────────────────────────────┐
 * │ Synthetic Model ID           │ Reason No Fallback                                           │ Mitigation (prompt/handler)     │
 * ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼─────────────────────────────────┤
 * │ deepseek-v3-0324-syn         │ DeepSeek V3 0324 not available on Together AI                 │ BASE + DEFAULT (default config) │
 * │ deepseek-v3.1-terminus-syn   │ DeepSeek V3.1 Terminus not available on Together AI           │ BASE + DEFAULT (default config) │
 * │ deepseek-v3.2-syn            │ DeepSeek V3.2 not available on Together AI                    │ JSON_STRICT + EXTRACT_JSON      │
 * │ minimax-m2-syn               │ MiniMax M2 not available on Together AI                       │ BASE + DEFAULT (default config) │
 * │ minimax-m2.1-syn             │ MiniMax M2.1 not available on Together AI                     │ BASE + DEFAULT (default config) │
 * │ glm-4.6-syn                  │ GLM 4.6 not available on Together AI                          │ ENGLISH_ENFORCED + DEFAULT      │
 * │ glm-4.7-syn                  │ GLM 4.7 not available on Together AI                          │ ENGLISH_ENFORCED + EXTRACT_JSON │
 * │ qwen3-coder-480b-syn         │ Qwen3 Coder 480B not available on Together AI                 │ BASE + DEFAULT (default config) │
 * │ gpt-oss-120b-syn             │ Together only has GPT-OSS 20B (different size, not equivalent)│ JSON_STRICT + EXTRACT_JSON      │
 * │ qwen3-235b-thinking-syn      │ Together has Qwen3 235B Instruct but NOT Thinking variant;    │ THINKING_STRIPPED +             │
 * │                              │ cross-variant fallback risks different output style            │ STRIP_THINKING_TAGS             │
 * └──────────────────────────────┴──────────────────────────────────────────────────────────────┴─────────────────────────────────┘
 *
 * Risk models (exclusive + default config, no special handling):
 * - deepseek-v3-0324-syn, deepseek-v3.1-terminus-syn, minimax-m2-syn, minimax-m2.1-syn, qwen3-coder-480b-syn
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
// - 3/13 Synthetic models have fallbacks; 10/13 are exclusive (Phase 57 audit)
// - 5 risk models use default config without fallbacks (see table above)
// - Run `npm run validate:coverage` to check model coverage status
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

  // Add OpenRouter providers if API key configured
  if (process.env.OPENROUTER_API_KEY) {
    activeProviders.push(
      ...OPENROUTER_PROVIDERS.filter(p => !disabledIds.has(p.id))
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
  openrouter: number;
} {
  // Combine all provider arrays for tier counting
  // TogetherProvider, SyntheticProvider, and OpenRouterProvider all have tier property
  const allProviders = [...TOGETHER_PROVIDERS, ...SYNTHETIC_PROVIDERS, ...OPENROUTER_PROVIDERS];
  return {
    total: allProviders.length,
    free: allProviders.filter(p => p.tier === 'free').length,
    ultraBudget: allProviders.filter(p => p.tier === 'ultra-budget').length,
    budget: allProviders.filter(p => p.tier === 'budget').length,
    premium: allProviders.filter(p => p.tier === 'premium').length,
    together: TOGETHER_PROVIDERS.length,
    synthetic: SYNTHETIC_PROVIDERS.length,
    openrouter: OPENROUTER_PROVIDERS.length,
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
export { OPENROUTER_PROVIDERS };

// Re-export Together AI provider class for type checking
export { TogetherProvider, type ModelTier, type ModelPricing } from './providers/together';

// Re-export Synthetic provider class
export { SyntheticProvider } from './providers/synthetic';

// Re-export OpenRouter provider class
export { OpenRouterProvider } from './providers/openrouter';

// Re-export batch prediction types
export { type BatchPredictionResult } from './providers/base';
export {
  type BatchParsedResult,
  type BatchPredictionItem,
  BATCH_SYSTEM_PROMPT,
  parseBatchPredictionResponse,
} from './prompt';
