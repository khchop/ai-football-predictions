import { LLMProvider } from '@/types';
import { loggers } from '@/lib/logger/modules';
import { TOGETHER_PROVIDERS } from './providers/together';
import { getAutoDisabledModelIds } from '@/lib/db/queries';

// All available providers - 35 open-source models via Together AI
export const ALL_PROVIDERS: LLMProvider[] = [...TOGETHER_PROVIDERS];

// Get active providers (checks if API keys are configured and filters auto-disabled models)
export async function getActiveProviders(): Promise<LLMProvider[]> {
  // All providers use Together AI
  if (!process.env.TOGETHER_API_KEY) {
    return [];
  }
  
   // Filter out auto-disabled models
   const disabledIds = await getAutoDisabledModelIds();
   const activeProviders = ALL_PROVIDERS.filter(p => !disabledIds.has(p.id));
   
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
} {
  const providers = TOGETHER_PROVIDERS;
  return {
    total: providers.length,
    free: providers.filter(p => p.tier === 'free').length,
    ultraBudget: providers.filter(p => p.tier === 'ultra-budget').length,
    budget: providers.filter(p => p.tier === 'budget').length,
    premium: providers.filter(p => p.tier === 'premium').length,
  };
}

// Export providers
export { TOGETHER_PROVIDERS };

// Re-export Together AI provider class for type checking
export { TogetherProvider, type ModelTier, type ModelPricing } from './providers/together';

// Re-export batch prediction types
export { type BatchPredictionResult } from './providers/base';
export { 
  type BatchParsedResult, 
  type BatchPredictionItem,
  BATCH_SYSTEM_PROMPT,
  parseBatchPredictionResponse,
} from './prompt';
