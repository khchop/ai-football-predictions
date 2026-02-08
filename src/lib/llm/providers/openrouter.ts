import { OpenAICompatibleProvider } from './base';
import { ModelPricing, ModelTier } from './together';
import { PromptConfig, PromptVariant } from '../prompt-variants';
import { ResponseHandler } from '../response-handlers';

// Generic OpenRouter provider that can be configured for any model
export class OpenRouterProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  public readonly tier: ModelTier;
  public readonly pricing: ModelPricing;
  public readonly promptConfig: PromptConfig;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly model: string,
    public readonly displayName: string,
    tier: ModelTier,
    pricing: ModelPricing,
    public readonly isPremium: boolean = false,
    promptConfig: PromptConfig = {}
  ) {
    super();
    this.tier = tier;
    this.pricing = pricing;
    this.promptConfig = promptConfig;
  }

  protected getHeaders(): Record<string, string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Football AI Predictions',
    };
  }

  // Estimate cost for a prediction (~500 input tokens, ~50 output tokens with enhanced prompt)
  estimateCost(inputTokens: number = 500, outputTokens: number = 50): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.promptPer1M;
    const outputCost = (outputTokens / 1_000_000) * this.pricing.completionPer1M;
    return inputCost + outputCost;
  }

  // Estimate cost for batch prediction
  // Default: 400 tokens per match input (with analysis), 50 per match output
  estimateBatchCost(matchCount: number, hasAnalysis: boolean = true): number {
    const inputTokensPerMatch = hasAnalysis ? 400 : 200;
    const outputTokensPerMatch = 50;
    return this.estimateCost(
      inputTokensPerMatch * matchCount,
      outputTokensPerMatch * matchCount
    );
  }
}

// ============================================================================
// TEST MODELS FROM OPENROUTER
// These models validate provider structure and integration.
// Actual API acceptance of model IDs deferred to Phase 60/64 when connected to routing.
// ============================================================================

// 1. DeepSeek R1 (Reasoning model)
export const DeepSeekR1_OR = new OpenRouterProvider(
  'deepseek-r1-or',
  'openrouter',
  'deepseek/deepseek-r1',
  'DeepSeek R1 (OpenRouter)',
  'premium',
  { promptPer1M: 0.55, completionPer1M: 2.19 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000, // 2 min - reasoning models need extended time
  }
);

// 2. Qwen3 235B (Standard instruct model)
export const Qwen3_235B_OR = new OpenRouterProvider(
  'qwen3-235b-or',
  'openrouter',
  'qwen/qwen3-235b',
  'Qwen3 235B (OpenRouter)',
  'budget',
  { promptPer1M: 0.12, completionPer1M: 0.18 },
  false,
  {}
);

// 3. Llama 4 Scout (Model from deprecated Together list - validates re-activation path)
export const Llama4Scout_OR = new OpenRouterProvider(
  'llama-4-scout-or',
  'openrouter',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'Llama 4 Scout (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.08, completionPer1M: 0.18 },
  false,
  {}
);

export const OPENROUTER_PROVIDERS: OpenRouterProvider[] = [
  DeepSeekR1_OR,
  Qwen3_235B_OR,
  Llama4Scout_OR,
];
