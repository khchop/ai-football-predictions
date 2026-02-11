import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_PROVIDERS } from './providers/together';
import { OPENROUTER_PROVIDERS } from './providers/openrouter';
import { getAutoDisabledModelIds } from '@/lib/db/queries';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
import { getDb, models } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

// Together AI core providers
// OpenRouter providers are conditional (only in getActiveProviders when API key set)
// Together: 23 active models = 23 total
export const ALL_PROVIDERS: LLMProvider[] = [
  ...TOGETHER_PROVIDERS,
];

// ============================================================================
// MODEL PROVIDER ROUTES
// Maps consolidated model IDs to ordered provider priority lists.
// Each model tries providers in array order: first = primary, last = final fallback.
// Max 3 providers per model. Validated at module load time.
//
// Consolidated model IDs are routing-level identifiers (the keys below).
// They are NOT provider IDs — they name a model concept.
// Workers currently use per-provider model IDs and getFallbackProvider();
// Phase 62-64 will transition workers to pass providerRoute by consolidated ID.
//
// Provider ID conventions:
//   - Together AI: model-name (e.g., 'deepseek-r1')
//   - Synthetic: model-name (e.g., 'qwen3-235b-thinking')
//   - OpenRouter: model-name-or (e.g., 'deepseek-r1-or')
// ============================================================================

export const MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  // --- Together -> OpenRouter ---
  'deepseek-r1': ['deepseek-r1', 'deepseek-r1-or'],
  'llama-4-maverick': ['llama-4-maverick', 'llama-4-maverick-or'],
  'llama-3.3-70b-turbo': ['llama-3.3-70b-turbo', 'llama-3.3-70b-or'],
  'llama-3.1-8b-turbo': ['llama-3.1-8b-turbo', 'llama-3.1-8b-or'],
  'llama-3.2-3b-turbo': ['llama-3.2-3b-turbo', 'llama-3.2-3b-or'],
  'llama-3-8b-lite': ['llama-3-8b-lite', 'llama-3-8b-or'],
  'qwen3-235b': ['qwen3-235b-instruct', 'qwen3-235b-or'],
  'qwen3-next-80b': ['qwen3-next-80b-instruct', 'qwen3-next-80b-or'],
  'qwen2.5-7b': ['qwen2.5-7b-turbo', 'qwen2.5-7b-or'],
  'cogito-671b': ['cogito-671b', 'cogito-671b-or'],
  'ministral-3-14b': ['ministral-3-14b', 'ministral-3-14b-or'],
  'rnj-1-instruct': ['rnj-1-instruct', 'rnj-1-instruct-or'],
  'deepseek-v3.1': ['deepseek-v3.1', 'deepseek-v3.1-or'],
  'kimi-k2-0905': ['kimi-k2-0905', 'kimi-k2-0905-or'],
  'kimi-k2-instruct': ['kimi-k2-instruct', 'kimi-k2-instruct-or'],
  'kimi-k2.5': ['kimi-k2.5', 'kimi-k2.5-or'],
  'gpt-oss-20b': ['gpt-oss-20b', 'gpt-oss-20b-or'],
  'mistral-small-3-24b': ['mistral-small-3-24b', 'mistral-small-3-24b-or'],
  'mistral-7b-v0.2': ['mistral-7b-v0.2', 'mistral-7b-v0.2-or'],
  'mistral-7b-v0.3': ['mistral-7b-v0.3', 'mistral-7b-v0.3-or'],
  'nemotron-nano-9b-v2': ['nemotron-nano-9b-v2', 'nemotron-nano-9b-v2-or'],
  'gemma-3n-e4b': ['gemma-3n-e4b', 'gemma-3n-e4b-or'],

  // --- OpenRouter-primary (migrated from Together, no longer serverless) ---
  'llama-4-scout': ['llama-4-scout-or'],
  'llama-3.1-405b-turbo': ['llama-3.1-405b-or'],
  'llama-3-70b-reference': ['llama-3-70b-or'],
  'qwen2.5-72b': ['qwen2.5-72b-or'],

  // --- OpenRouter-primary (migrated from Synthetic) ---
  'deepseek-v3.2': ['deepseek-v3.2-or'],
  'minimax-m2': ['minimax-m2-or'],
  'minimax-m2.1': ['minimax-m2.1-or'],
  'glm-4.6': ['glm-4.6-or'],
  'glm-4.7': ['glm-4.7-or'],
  'qwen3-coder-480b': ['qwen3-coder-480b-or'],
  'qwen3-235b-thinking': ['qwen3-235b-thinking-or'],
  'deepseek-v3-0324': ['deepseek-v3-0324-or'],
  'deepseek-v3.1-terminus': ['deepseek-v3.1-terminus-or'],
  'gpt-oss-120b': ['gpt-oss-120b-or'],
};

/**
 * Validate provider routes at module load time
 * Checks:
 * 1. All provider IDs in routes exist in ALL_PROVIDERS + OPENROUTER_PROVIDERS
 * 2. No duplicate provider IDs within a route (cycle detection)
 * 3. Max 3 providers per route
 * 4. No empty routes
 */
function validateProviderRoutes(): void {
  // Build set of all available provider IDs
  const availableProviderIds = new Set(ALL_PROVIDERS.map(p => p.id));

  // Conditionally include OpenRouter providers if API key is set
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  if (hasOpenRouterKey) {
    for (const p of OPENROUTER_PROVIDERS) {
      availableProviderIds.add(p.id);
    }
  }

  for (const [consolidatedId, providers] of Object.entries(MODEL_PROVIDER_ROUTES)) {
    // Check for empty routes
    if (providers.length === 0) {
      throw new Error(
        `Invalid provider route for "${consolidatedId}": route is empty. ` +
        `Each model must have at least one provider.`
      );
    }

    // Check max depth (3 providers)
    if (providers.length > 3) {
      throw new Error(
        `Invalid provider route for "${consolidatedId}": route has ${providers.length} providers. ` +
        `Maximum 3 providers per route allowed.`
      );
    }

    // Check for duplicates within the route (cycle detection)
    const uniqueProviders = new Set(providers);
    if (uniqueProviders.size !== providers.length) {
      throw new Error(
        `Invalid provider route for "${consolidatedId}": route contains duplicate providers. ` +
        `Route: [${providers.join(', ')}]. Each provider can only appear once per route.`
      );
    }

    // Check that all provider IDs exist
    for (const providerId of providers) {
      if (!availableProviderIds.has(providerId)) {
        // Check if it's an OpenRouter provider but key not set
        const isOpenRouterProvider = OPENROUTER_PROVIDERS.some(p => p.id === providerId);
        if (isOpenRouterProvider && !hasOpenRouterKey) {
          loggers.llm.warn({
            consolidatedId,
            providerId,
          }, 'Provider route references OpenRouter provider but OPENROUTER_API_KEY not set — provider will be unavailable');
        } else {
          throw new Error(
            `Invalid provider route for "${consolidatedId}": provider "${providerId}" not found. ` +
            `Available providers: ${[...availableProviderIds].join(', ')}`
          );
        }
      }
    }
  }

  loggers.llm.info({
    routeCount: Object.keys(MODEL_PROVIDER_ROUTES).length,
    routes: MODEL_PROVIDER_ROUTES,
  }, 'Provider routes validated successfully');
}

/**
 * Returns the next fallback provider for a given provider ID.
 * Thin wrapper over MODEL_PROVIDER_ROUTES — finds the provider in any route
 * and returns the next provider in the chain.
 *
 * Used by the single-fallback path in callAPIWithFallback (workers that don't
 * yet pass providerRoute). Will be removed in Phase 62-64 when all callers
 * transition to explicit providerRoute.
 */
export function getFallbackProvider(modelId: string): LLMProvider | undefined {
  // Search MODEL_PROVIDER_ROUTES for this provider ID
  for (const [, providers] of Object.entries(MODEL_PROVIDER_ROUTES)) {
    const idx = providers.indexOf(modelId);
    if (idx !== -1 && idx < providers.length - 1) {
      // Return the next provider in the chain
      const nextId = providers[idx + 1];
      return getProviderById(nextId);
    }
  }
  return undefined;
}

/**
 * Get the provider route for a consolidated model ID
 * @param consolidatedModelId - The consolidated model ID (routing-level identifier)
 * @returns Array of provider IDs in priority order, or undefined if no route exists
 */
export function getRouteForModel(consolidatedModelId: string): string[] | undefined {
  return MODEL_PROVIDER_ROUTES[consolidatedModelId];
}

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

  // Add OpenRouter providers if API key configured
  // Exclude fallback-only providers (those appearing as non-primary in routes)
  if (process.env.OPENROUTER_API_KEY) {
    const fallbackProviderIds = new Set<string>();
    for (const route of Object.values(MODEL_PROVIDER_ROUTES)) {
      for (let i = 1; i < route.length; i++) {
        fallbackProviderIds.add(route[i]);
      }
    }
    activeProviders.push(
      ...OPENROUTER_PROVIDERS.filter(p => !disabledIds.has(p.id) && !fallbackProviderIds.has(p.id))
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
  // Check core providers first (Together)
  const core = ALL_PROVIDERS.find(p => p.id === id);
  if (core) return core;
  // Check OpenRouter providers (conditional, but needed for routing)
  return OPENROUTER_PROVIDERS.find(p => p.id === id);
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
  openrouter: number;
} {
  // Combine all provider arrays for tier counting
  // TogetherProvider and OpenRouterProvider all have tier property
  const allProviders = [...TOGETHER_PROVIDERS, ...OPENROUTER_PROVIDERS];
  return {
    total: allProviders.length,
    free: allProviders.filter(p => p.tier === 'free').length,
    ultraBudget: allProviders.filter(p => p.tier === 'ultra-budget').length,
    budget: allProviders.filter(p => p.tier === 'budget').length,
    premium: allProviders.filter(p => p.tier === 'premium').length,
    together: TOGETHER_PROVIDERS.length,
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
export { OPENROUTER_PROVIDERS };

// Re-export Together AI provider class for type checking
export { TogetherProvider, type ModelTier, type ModelPricing } from './providers/together';

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

// Validate provider routes at module load time
validateProviderRoutes();
