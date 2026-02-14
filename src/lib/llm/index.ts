import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { OPENROUTER_PROVIDERS } from './providers/openrouter';
import { getAutoDisabledModelIds, getArchivedModelIds } from '@/lib/db/queries';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
import { getDb, models } from '@/lib/db';
import { eq, sql, and } from 'drizzle-orm';

// OpenRouter providers (sole provider)
// OpenRouter: 21 active models = 21 total
export const ALL_PROVIDERS: LLMProvider[] = [...OPENROUTER_PROVIDERS];

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
// Provider ID convention: {model-slug}-or (e.g., 'deepseek-v3.2-or')
// ============================================================================

export const MODEL_PROVIDER_ROUTES: Record<string, string[]> = {
  // DeepSeek (2)
  'deepseek-v3.2': ['deepseek-v3.2-or'],
  'deepseek-r1-0528': ['deepseek-r1-0528-or'],

  // Moonshot Kimi (1)
  'kimi-k2.5': ['kimi-k2.5-or'],

  // Qwen (2)
  'qwen3-235b': ['qwen3-235b-or'],
  'qwen3-30b-a3b': ['qwen3-30b-a3b-or'],

  // Meta Llama (2)
  'llama-3.3-70b': ['llama-3.3-70b-or'],
  'llama-4-scout': ['llama-4-scout-or'],

  // OpenAI OSS (2)
  'gpt-oss-20b': ['gpt-oss-20b-or'],
  'gpt-oss-120b': ['gpt-oss-120b-or'],

  // Mistral (2)
  'devstral-2': ['devstral-2-or'],
  'mistral-small-3.2-24b': ['mistral-small-3.2-24b-or'],

  // StepFun (1)
  'step-3.5-flash': ['step-3.5-flash-or'],

  // NVIDIA (1)
  'nemotron-3-nano-30b-a3b': ['nemotron-3-nano-30b-a3b-or'],

  // Google (2)
  'gemma-3-27b': ['gemma-3-27b-or'],
  'gemma-3-12b': ['gemma-3-12b-or'],

  // Z-AI GLM (2)
  'glm-5': ['glm-5-or'],
  'glm-4.7': ['glm-4.7-or'],

  // MiniMax (2)
  'minimax-m2.1': ['minimax-m2.1-or'],
  'minimax-m2.5': ['minimax-m2.5-or'],

  // Arcee AI (1)
  'trinity-large-preview': ['trinity-large-preview-or'],

  // Microsoft (1)
  'phi-4': ['phi-4-or'],
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

// Get active providers (checks if API keys are configured and filters auto-disabled and archived models)
export async function getActiveProviders(): Promise<LLMProvider[]> {
  // Filter out auto-disabled and archived models
  const disabledIds = await getAutoDisabledModelIds();
  const archivedIds = await getArchivedModelIds();

  const activeProviders: LLMProvider[] = [];

  // Add OpenRouter providers if API key configured
  // All models are now primary (single provider architecture)
  if (process.env.OPENROUTER_API_KEY) {
    activeProviders.push(
      ...OPENROUTER_PROVIDERS.filter(p => !disabledIds.has(p.id) && !archivedIds.has(p.id))
    );
  }

  if (disabledIds.size > 0 || archivedIds.size > 0) {
    loggers.llm.info({
      disabledCount: disabledIds.size,
      archivedCount: archivedIds.size,
      activeCount: activeProviders.length,
    }, 'Filtered auto-disabled and archived models');
  }

  return activeProviders;
}

// Get provider by ID
export function getProviderById(id: string): LLMProvider | undefined {
  // Check OpenRouter providers (sole provider)
  return OPENROUTER_PROVIDERS.find(p => p.id === id);
}

// Get all free providers
export function getFreeProviders(): LLMProvider[] {
  return OPENROUTER_PROVIDERS.filter(p => !p.isPremium);
}

// Get all premium providers
export function getPremiumProviders(): LLMProvider[] {
  return OPENROUTER_PROVIDERS.filter(p => p.isPremium);
}

// Get provider count by category
export function getProviderStats(): {
  total: number;
  free: number;
  ultraBudget: number;
  budget: number;
  premium: number;
  openrouter: number;
} {
  // OpenRouter is now the sole provider
  const allProviders = OPENROUTER_PROVIDERS;
  return {
    total: allProviders.length,
    free: allProviders.filter(p => p.tier === 'free').length,
    ultraBudget: allProviders.filter(p => p.tier === 'ultra-budget').length,
    budget: allProviders.filter(p => p.tier === 'budget').length,
    premium: allProviders.filter(p => p.tier === 'premium').length,
    openrouter: OPENROUTER_PROVIDERS.length,
  };
}

/**
 * Get active model count from database (cached)
 * This is the SINGLE SOURCE OF TRUTH for model count in UI/content
 *
 * Queries database `models.active = true AND models.archived = false`, not provider arrays.
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
        .where(and(eq(models.active, true), eq(models.archived, false)));
      return result[0]?.count || 0;
    }
  );
}

// Export providers
export { OPENROUTER_PROVIDERS };

// Re-export OpenRouter provider class and types
export { OpenRouterProvider, type ModelTier, type ModelPricing } from './providers/openrouter';

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
