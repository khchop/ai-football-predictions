import { OpenAICompatibleProvider } from './base';
import { PromptConfig, PromptVariant } from '../prompt-variants';
import { ResponseHandler } from '../response-handlers';

// Cost per 1M tokens (in USD)
export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

// Tier determines budget priority
export type ModelTier = 'free' | 'ultra-budget' | 'budget' | 'premium';

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
// KEPT OPENROUTER PROVIDERS (4 models)
// ============================================================================

// Qwen3 235B (Standard instruct model)
export const Qwen3_235B_OR = new OpenRouterProvider(
  'qwen3-235b-or',
  'openrouter',
  'qwen/qwen3-235b',
  'Qwen3 235B (OpenRouter)',
  'budget',
  { promptPer1M: 0.12, completionPer1M: 0.18 },
  false,
  {
    maxTokensSingle: 500,
    maxTokensBatch: 1000,
  }
);

// Llama 3.3 70B Instruct
export const Llama33_70B_OR = new OpenRouterProvider(
  'llama-3.3-70b-or',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B Instruct (OpenRouter)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.32 },
  false,
  {}
);

// GPT-OSS 120B
export const GPTOSS120B_OR = new OpenRouterProvider(
  'gpt-oss-120b-or',
  'openrouter',
  'openai/gpt-oss-120b',
  'GPT-OSS 120B (OpenRouter)',
  'budget',
  { promptPer1M: 0.039, completionPer1M: 0.19 },
  false,
  {}
);

// Kimi K2.5
export const KimiK25_OR = new OpenRouterProvider(
  'kimi-k2.5-or',
  'openrouter',
  'moonshotai/kimi-k2.5',
  'Kimi K2.5 (OpenRouter)',
  'budget',
  { promptPer1M: 0.45, completionPer1M: 2.25 },
  false,
  {
    supportsJsonMode: false,
    maxTokensSingle: 500,
    maxTokensBatch: 800,
  }
);

// MiniMax M2.1
export const MiniMaxM21_OR = new OpenRouterProvider(
  'minimax-m2.1-or',
  'openrouter',
  'minimax/minimax-m2.1',
  'MiniMax M2.1 (OpenRouter)',
  'budget',
  { promptPer1M: 0.27, completionPer1M: 0.95 },
  false,
  {
    supportsJsonMode: false,
    responseHandler: ResponseHandler.EXTRACT_JSON,
  }
);

// MiniMax M2.5 (reasoning model with mandatory <think> tags)
export const MiniMaxM25_OR = new OpenRouterProvider(
  'minimax-m2.5-or',
  'openrouter',
  'minimax/minimax-m2.5',
  'MiniMax M2.5 (OpenRouter)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 1.20 },
  false,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
    supportsJsonMode: false,
  }
);

// GLM-4.7 (same config pattern as GLM-5 since both are Z-AI reasoning models)
export const GLM47_OR = new OpenRouterProvider(
  'glm-4.7-or',
  'openrouter',
  'z-ai/glm-4.7',
  'GLM-4.7 (OpenRouter)',
  'premium',
  { promptPer1M: 0.40, completionPer1M: 1.50 },
  true,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 120000,
    supportsJsonMode: false,
    maxTokensSingle: 1000,
    maxTokensBatch: 1500,
  }
);

// NVIDIA Nemotron 3 Nano 30B A3B (replaces nemotron-nano-9b-v2)
export const Nemotron3Nano30B_OR = new OpenRouterProvider(
  'nemotron-3-nano-30b-a3b-or',
  'openrouter',
  'nvidia/nemotron-3-nano-30b-a3b',
  'Nemotron 3 Nano 30B A3B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.20 },
  false,
  {}
);

// ============================================================================
// NEW OPENROUTER PROVIDERS (Phase 72-01) - 13 models
// ============================================================================

// GLM-5 (premium, reasoning model - needs ENGLISH_ENFORCED + EXTRACT_JSON like GLM-4.7)
export const GLM5_OR = new OpenRouterProvider(
  'glm-5-or',
  'openrouter',
  'z-ai/glm-5',
  'GLM-5 (OpenRouter)',
  'premium',
  { promptPer1M: 0.80, completionPer1M: 2.56 },
  true,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 120000,
    supportsJsonMode: false,
    maxTokensSingle: 1000,
    maxTokensBatch: 1500,
  }
);

// DeepSeek V3.2 (budget - needs JSON_STRICT like V3.1)
export const DeepSeekV32_OR = new OpenRouterProvider(
  'deepseek-v3.2-or',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2 (OpenRouter)',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.38 },
  false,
  {
    maxTokensSingle: 500,
    maxTokensBatch: 1000,
  }
);

// DeepSeek R1-0528 (premium, reasoning - needs THINKING_STRIPPED + STRIP_THINKING_TAGS like R1)
export const DeepSeekR10528_OR = new OpenRouterProvider(
  'deepseek-r1-0528-or',
  'openrouter',
  'deepseek/deepseek-r1-0528',
  'DeepSeek R1-0528 (OpenRouter)',
  'premium',
  { promptPer1M: 0.40, completionPer1M: 1.75 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
  }
);

// Devstral 2 (replaces devstral-small)
export const Devstral2_OR = new OpenRouterProvider(
  'devstral-2-or',
  'openrouter',
  'mistralai/devstral-2512',
  'Devstral 2 (OpenRouter)',
  'budget',
  { promptPer1M: 0.05, completionPer1M: 0.22 },
  false,
  {}
);

// Qwen3 30B A3B (ultra-budget, MoE)
export const Qwen3_30B_A3B_OR = new OpenRouterProvider(
  'qwen3-30b-a3b-or',
  'openrouter',
  'qwen/qwen3-30b-a3b',
  'Qwen3 30B A3B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.06, completionPer1M: 0.22 },
  false,
  {}
);

// GPT-OSS-20B (ultra-budget - needs JSON_STRICT + EXTRACT_JSON like GPT-OSS-120B)
export const GPTOSS20B_OR = new OpenRouterProvider(
  'gpt-oss-20b-or',
  'openrouter',
  'openai/gpt-oss-20b',
  'GPT-OSS 20B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.14 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 45000,
    supportsJsonMode: false,
    maxTokensSingle: 1000,
    maxTokensBatch: 1500,
  }
);

// Step 3.5 Flash (budget, MoE)
export const Step35Flash_OR = new OpenRouterProvider(
  'step-3.5-flash-or',
  'openrouter',
  'stepfun/step-3.5-flash',
  'Step 3.5 Flash (OpenRouter)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false,
  { supportsJsonMode: false }
);

// Mistral Small 3.2 24B (ultra-budget, replaces Mistral Small 3)
export const MistralSmall32_24B_OR = new OpenRouterProvider(
  'mistral-small-3.2-24b-or',
  'openrouter',
  'mistralai/mistral-small-3.2-24b-instruct',
  'Mistral Small 3.2 24B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.06, completionPer1M: 0.18 },
  false,
  {}
);

// Gemma 3 27B (ultra-budget)
export const Gemma3_27B_OR = new OpenRouterProvider(
  'gemma-3-27b-or',
  'openrouter',
  'google/gemma-3-27b-it',
  'Gemma 3 27B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.15 },
  false,
  {}
);

// Trinity Large Preview (free tier, MoE)
export const TrinityLargePreview_OR = new OpenRouterProvider(
  'trinity-large-preview-or',
  'openrouter',
  'arcee-ai/trinity-large-preview:free',
  'Trinity Large Preview (OpenRouter)',
  'free',
  { promptPer1M: 0.00, completionPer1M: 0.00 },
  false,
  {}
);

// Phi-4 (ultra-budget, 14B)
export const Phi4_OR = new OpenRouterProvider(
  'phi-4-or',
  'openrouter',
  'microsoft/phi-4',
  'Phi-4 (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.06, completionPer1M: 0.14 },
  false,
  {}
);

// Llama 4 Scout (ultra-budget, MoE)
export const Llama4Scout_OR = new OpenRouterProvider(
  'llama-4-scout-or',
  'openrouter',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'Llama 4 Scout (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.08, completionPer1M: 0.30 },
  false,
  {}
);

// Gemma 3 12B (ultra-budget)
export const Gemma3_12B_OR = new OpenRouterProvider(
  'gemma-3-12b-or',
  'openrouter',
  'google/gemma-3-12b-it',
  'Gemma 3 12B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.10 },
  false,
  {}
);

// ============================================================================
// ALL OPENROUTER PROVIDERS (21 models)
// OpenRouter is now the sole LLM provider for all predictions and content generation
// Organized by model family for clarity
// ============================================================================

export const OPENROUTER_PROVIDERS: OpenRouterProvider[] = [
  // DeepSeek (2 models)
  DeepSeekV32_OR,              // V3.2 (NEW - replaces V3.1)
  DeepSeekR10528_OR,           // R1-0528 (NEW - replaces R1)

  // Moonshot Kimi (1 model)
  KimiK25_OR,                  // K2.5 (KEPT)

  // Qwen (2 models)
  Qwen3_235B_OR,               // 235B (KEPT)
  Qwen3_30B_A3B_OR,            // 30B A3B (NEW)

  // Meta Llama (2 models)
  Llama33_70B_OR,              // Llama 3.3 70B (NEW - replaces Maverick)
  Llama4Scout_OR,              // Llama 4 Scout (NEW)

  // OpenAI OSS (2 models)
  GPTOSS20B_OR,                // GPT-OSS 20B (NEW)
  GPTOSS120B_OR,               // GPT-OSS 120B (NEW)

  // Mistral (2 models)
  Devstral2_OR,                // Devstral 2 (NEW - replaces Devstral Small)
  MistralSmall32_24B_OR,       // Mistral Small 3.2 24B (NEW - replaces 3.0)

  // StepFun (1 model)
  Step35Flash_OR,              // Step 3.5 Flash (NEW)

  // NVIDIA (1 model)
  Nemotron3Nano30B_OR,         // Nemotron 3 Nano 30B A3B (NEW - replaces Nano 9B v2)

  // Google (2 models)
  Gemma3_27B_OR,               // Gemma 3 27B (NEW)
  Gemma3_12B_OR,               // Gemma 3 12B (NEW)

  // Z-AI GLM (2 models)
  GLM5_OR,                     // GLM-5 (NEW)
  GLM47_OR,                    // GLM-4.7 (NEW)

  // MiniMax (2 models)
  MiniMaxM21_OR,               // MiniMax M2.1 (UPDATED pricing)
  MiniMaxM25_OR,               // MiniMax M2.5 (NEW - reasoning model)

  // Arcee AI (1 model)
  TrinityLargePreview_OR,      // Trinity Large Preview (NEW)

  // Microsoft (1 model)
  Phi4_OR,                     // Phi-4 (NEW)
];
