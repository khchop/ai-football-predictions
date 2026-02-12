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
// EXISTING OPENROUTER PROVIDERS (3)
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
    timeoutMs: 120000,
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
  {
    maxTokensSingle: 500,
    maxTokensBatch: 1000,
  }
);

// 3. Llama 4 Maverick
export const Llama4Maverick_OR = new OpenRouterProvider(
  'llama-4-maverick-or',
  'openrouter',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'Llama 4 Maverick (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.25 },
  false,
  {}
);

// 4. Llama 3.1 8B
export const Llama31_8B_OR = new OpenRouterProvider(
  'llama-3.1-8b-or',
  'openrouter',
  'meta-llama/llama-3.1-8b-instruct',
  'Llama 3.1 8B (OpenRouter)',
  'free',
  { promptPer1M: 0.00, completionPer1M: 0.00 },
  false,
  {}
);

// 5. Llama 3.2 3B
export const Llama32_3B_OR = new OpenRouterProvider(
  'llama-3.2-3b-or',
  'openrouter',
  'meta-llama/llama-3.2-3b-instruct',
  'Llama 3.2 3B (OpenRouter)',
  'free',
  { promptPer1M: 0.00, completionPer1M: 0.00 },
  false,
  {}
);

// 6. Qwen 2.5 7B
export const Qwen25_7B_OR = new OpenRouterProvider(
  'qwen2.5-7b-or',
  'openrouter',
  'qwen/qwen-2.5-7b-instruct',
  'Qwen 2.5 7B (OpenRouter)',
  'free',
  { promptPer1M: 0.00, completionPer1M: 0.00 },
  false,
  {}
);

// 7. Cogito 671B
export const Cogito671B_OR = new OpenRouterProvider(
  'cogito-671b-or',
  'openrouter',
  'deepcogito/cogito-v2.1-671b',
  'Cogito 671B (OpenRouter)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 1.20 },
  false,
  {}
);

// 8. Ministral 3 14B
export const Ministral3_14B_OR = new OpenRouterProvider(
  'ministral-3-14b-or',
  'openrouter',
  'mistralai/ministral-14b-2512',
  'Ministral 3 14B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.10 },
  false,
  {}
);

// 9. RNJ-1 Instruct
export const RNJ1Instruct_OR = new OpenRouterProvider(
  'rnj-1-instruct-or',
  'openrouter',
  'essentialai/rnj-1-instruct',
  'RNJ-1 Instruct (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.08, completionPer1M: 0.15 },
  false,
  {}
);

// 10. DeepSeek V3.1
export const DeepSeekV31_OR = new OpenRouterProvider(
  'deepseek-v3.1-or',
  'openrouter',
  'deepseek/deepseek-chat-v3.1',
  'DeepSeek V3.1 (OpenRouter)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.75 },
  false,
  {
    maxTokensSingle: 500,
    maxTokensBatch: 1000,
  }
);

// 11. Kimi K2.5
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

// 12. Mistral Small 3 24B
export const MistralSmall3_24B_OR = new OpenRouterProvider(
  'mistral-small-3-24b-or',
  'openrouter',
  'mistralai/mistral-small-24b-instruct-2501',
  'Mistral Small 3 24B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.08 },
  false,
  {}
);

// 13. Nemotron Nano 9B v2
export const NemotronNano9Bv2_OR = new OpenRouterProvider(
  'nemotron-nano-9b-v2-or',
  'openrouter',
  'nvidia/nemotron-nano-9b-v2',
  'Nemotron Nano 9B v2 (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.16 },
  false,
  {}
);

// 14. Gemma 3n E4B
export const Gemma3nE4B_OR = new OpenRouterProvider(
  'gemma-3n-e4b-or',
  'openrouter',
  'google/gemma-3n-e4b-it',
  'Gemma 3n E4B (OpenRouter)',
  'free',
  { promptPer1M: 0.02, completionPer1M: 0.04 },
  false,
  {}
);

// 15. MiniMax M2.1
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

// 16. Qwen3 235B Thinking (needs THINKING_STRIPPED + STRIP_THINKING_TAGS like primary)
export const Qwen3_235BThinking_OR = new OpenRouterProvider(
  'qwen3-235b-thinking-or',
  'openrouter',
  'qwen/qwen3-235b-a22b-thinking-2507',
  'Qwen3 235B Thinking (OpenRouter)',
  'budget',
  { promptPer1M: 0.11, completionPer1M: 0.60 },
  false,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
    supportsJsonMode: false,
    maxTokensSingle: 500,
    maxTokensBatch: 800,
  }
);

// 17. GPT-OSS 120B (needs JSON_STRICT + EXTRACT_JSON like primary)
export const GPTOSS120B_OR = new OpenRouterProvider(
  'gpt-oss-120b-or',
  'openrouter',
  'openai/gpt-oss-120b',
  'GPT-OSS 120B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.039, completionPer1M: 0.19 },
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

// 18. GLM 4.7 Flash (GLM models don't support json_object; needs ENGLISH_ENFORCED + EXTRACT_JSON)
export const GLM47Flash_OR = new OpenRouterProvider(
  'glm-4.7-flash',
  'openrouter',
  'z-ai/glm-4.7-flash',
  'GLM 4.7 Flash (OpenRouter)',
  'budget',
  { promptPer1M: 0.06, completionPer1M: 0.40 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 60000,
    supportsJsonMode: false,
    maxTokensSingle: 1000,
    maxTokensBatch: 1500,
  }
);

// ============================================================================
// NEW OPENROUTER PROVIDERS (Phase 72-01)
// ============================================================================

// 19. GLM-5 (premium, reasoning model - needs ENGLISH_ENFORCED + EXTRACT_JSON like GLM-4.7)
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

// 20. DeepSeek V3.2 (budget - needs JSON_STRICT like V3.1)
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

// 21. DeepSeek R1-0528 (premium, reasoning - needs THINKING_STRIPPED + STRIP_THINKING_TAGS like R1)
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

// 22. Devstral Small (budget, code-focused)
export const DevstralSmall_OR = new OpenRouterProvider(
  'devstral-small-or',
  'openrouter',
  'mistralai/devstral-small',
  'Devstral Small (OpenRouter)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false,
  {}
);

// 23. Qwen3 30B A3B (ultra-budget, MoE)
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

// 24. GPT-OSS-20B (ultra-budget - needs JSON_STRICT + EXTRACT_JSON like GPT-OSS-120B)
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

// 25. Step 3.5 Flash (budget, MoE)
export const Step35Flash_OR = new OpenRouterProvider(
  'step-3.5-flash-or',
  'openrouter',
  'stepfun/step-3.5-flash',
  'Step 3.5 Flash (OpenRouter)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false,
  {}
);

// 26. Mistral Small 3.2 24B (ultra-budget, replaces Mistral Small 3)
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

// 27. Gemma 3 27B (ultra-budget)
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

// 28. Trinity Large Preview (free tier, MoE)
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

// 29. Phi-4 (ultra-budget, 14B)
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

// 30. Llama 4 Scout (ultra-budget, MoE)
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

// 31. Gemma 3 12B (ultra-budget)
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
  DeepSeekR1_OR,              // Reasoning model (premium)
  DeepSeekV31_OR,             // V3.1 primary

  // Moonshot Kimi (1 model)
  KimiK25_OR,                 // K2.5 (reasoning model)

  // Qwen (3 models)
  Qwen3_235B_OR,              // 235B primary
  Qwen3_235BThinking_OR,      // 235B Thinking variant
  Qwen25_7B_OR,               // 2.5 7B

  // Meta Llama (3 models)
  Llama4Maverick_OR,          // Llama 4 Maverick
  Llama31_8B_OR,              // Llama 3.1 8B (free tier)
  Llama32_3B_OR,              // Llama 3.2 3B (free tier)

  // OpenAI OSS (1 model)
  GPTOSS120B_OR,              // GPT-OSS 120B

  // Deep Cogito (1 model)
  Cogito671B_OR,              // Cogito 671B

  // Mistral (2 models)
  Ministral3_14B_OR,          // Ministral 3 14B
  MistralSmall3_24B_OR,       // Mistral Small 3 24B

  // NVIDIA (1 model)
  NemotronNano9Bv2_OR,        // Nemotron Nano 9B v2

  // Google (1 model)
  Gemma3nE4B_OR,              // Gemma 3n E4B (free tier)

  // Z-AI GLM (1 model)
  GLM47Flash_OR,              // GLM 4.7 Flash

  // MiniMax (1 model)
  MiniMaxM21_OR,              // MiniMax M2.1

  // Essential AI (1 model)
  RNJ1Instruct_OR,            // RNJ-1 Instruct
];
