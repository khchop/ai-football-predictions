import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_PROVIDERS } from './providers/together';
import { SYNTHETIC_PROVIDERS } from './providers/synthetic';
import { getAutoDisabledModelIds } from '@/lib/db/queries';

// All available providers - Together AI + Synthetic.new
// Together: 29 models, Synthetic: 13 exclusive models = 42 total
export const ALL_PROVIDERS: LLMProvider[] = [
  ...TOGETHER_PROVIDERS,
  ...SYNTHETIC_PROVIDERS,
];

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
