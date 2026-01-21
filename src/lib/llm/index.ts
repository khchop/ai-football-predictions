import { LLMProvider } from '@/types';
import { OPENROUTER_PROVIDERS } from './providers/openrouter';

// All available providers - 30 open-source models via OpenRouter
export const ALL_PROVIDERS: LLMProvider[] = [...OPENROUTER_PROVIDERS];

// Get active providers (checks if API keys are configured)
export function getActiveProviders(): LLMProvider[] {
  // All providers use OpenRouter
  if (!process.env.OPENROUTER_API_KEY) {
    return [];
  }
  return ALL_PROVIDERS;
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
  cheap: number;
  mid: number;
  premium: number;
} {
  const providers = OPENROUTER_PROVIDERS;
  return {
    total: providers.length,
    free: providers.filter(p => p.tier === 'free').length,
    cheap: providers.filter(p => p.tier === 'cheap').length,
    mid: providers.filter(p => p.tier === 'mid').length,
    premium: providers.filter(p => p.tier === 'premium').length,
  };
}

// Export providers
export { OPENROUTER_PROVIDERS };

// Re-export OpenRouter provider class for type checking
export { OpenRouterProvider, type ModelTier, type ModelPricing } from './providers/openrouter';

// Re-export batch prediction types
export { type BatchPredictionResult } from './providers/base';
export { 
  type BatchParsedResult, 
  type BatchPredictionItem,
  BATCH_SYSTEM_PROMPT,
  parseBatchPredictionResponse,
} from './prompt';
