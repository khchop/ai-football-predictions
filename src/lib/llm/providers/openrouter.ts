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
  {}
);

// 3. Llama 4 Scout
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

// ============================================================================
// TOGETHER AI MODELS → OPENROUTER FALLBACKS (13)
// ============================================================================

// 4. Llama 4 Maverick
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

// 5. Llama 3.3 70B
export const Llama33_70B_OR = new OpenRouterProvider(
  'llama-3.3-70b-or',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.20 },
  false,
  {}
);

// 6. Llama 3.1 8B
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

// 7. Llama 3.1 405B
export const Llama31_405B_OR = new OpenRouterProvider(
  'llama-3.1-405b-or',
  'openrouter',
  'meta-llama/llama-3.1-405b-instruct',
  'Llama 3.1 405B (OpenRouter)',
  'budget',
  { promptPer1M: 0.80, completionPer1M: 0.80 },
  false,
  {}
);

// 8. Llama 3.2 3B
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

// 9. Llama 3 8B
export const Llama3_8B_OR = new OpenRouterProvider(
  'llama-3-8b-or',
  'openrouter',
  'meta-llama/llama-3-8b-instruct',
  'Llama 3 8B (OpenRouter)',
  'free',
  { promptPer1M: 0.00, completionPer1M: 0.00 },
  false,
  {}
);

// 10. Llama 3 70B
export const Llama3_70B_OR = new OpenRouterProvider(
  'llama-3-70b-or',
  'openrouter',
  'meta-llama/llama-3-70b-instruct',
  'Llama 3 70B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.20 },
  false,
  {}
);

// 11. Qwen3 Next 80B
export const Qwen3Next80B_OR = new OpenRouterProvider(
  'qwen3-next-80b-or',
  'openrouter',
  'qwen/qwen3-next-80b-a3b-instruct-2509',
  'Qwen3 Next 80B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.20 },
  false,
  {}
);

// 12. Qwen 2.5 7B
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

// 13. Qwen 2.5 72B
export const Qwen25_72B_OR = new OpenRouterProvider(
  'qwen2.5-72b-or',
  'openrouter',
  'qwen/qwen-2.5-72b-instruct',
  'Qwen 2.5 72B (OpenRouter)',
  'budget',
  { promptPer1M: 0.18, completionPer1M: 0.30 },
  false,
  {}
);

// 14. Cogito 671B
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

// 15. Ministral 3 14B
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

// 16. RNJ-1 Instruct
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

// ============================================================================
// TOGETHER AI MODELS → OPENROUTER FALLBACKS - BATCH 2 (10)
// Added: 2026-02-10 (Quick-37 + Quick-38)
// ============================================================================

// 17. DeepSeek V3.1
export const DeepSeekV31_OR = new OpenRouterProvider(
  'deepseek-v3.1-or',
  'openrouter',
  'deepseek/deepseek-chat-v3.1',
  'DeepSeek V3.1 (OpenRouter)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.75 },
  false,
  {}
);

// 18. Kimi K2 0905
export const KimiK2_0905_OR = new OpenRouterProvider(
  'kimi-k2-0905-or',
  'openrouter',
  'moonshotai/kimi-k2-0905',
  'Kimi K2 0905 (OpenRouter)',
  'budget',
  { promptPer1M: 0.39, completionPer1M: 1.90 },
  false,
  {}
);

// 19. Kimi K2 Instruct
export const KimiK2Instruct_OR = new OpenRouterProvider(
  'kimi-k2-instruct-or',
  'openrouter',
  'moonshotai/kimi-k2',
  'Kimi K2 Instruct (OpenRouter)',
  'budget',
  { promptPer1M: 0.50, completionPer1M: 2.40 },
  false,
  {}
);

// 20. Kimi K2.5
export const KimiK25_OR = new OpenRouterProvider(
  'kimi-k2.5-or',
  'openrouter',
  'moonshotai/kimi-k2.5',
  'Kimi K2.5 (OpenRouter)',
  'budget',
  { promptPer1M: 0.45, completionPer1M: 2.25 },
  false,
  {}
);

// 21. GPT-OSS 20B
export const GPTOSS20B_OR = new OpenRouterProvider(
  'gpt-oss-20b-or',
  'openrouter',
  'openai/gpt-oss-20b',
  'GPT-OSS 20B (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.14 },
  false,
  {}
);

// 22. Mistral Small 3 24B
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

// 23. Mistral 7B v0.2
export const Mistral7Bv02_OR = new OpenRouterProvider(
  'mistral-7b-v0.2-or',
  'openrouter',
  'mistralai/mistral-7b-instruct-v0.2',
  'Mistral 7B v0.2 (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false,
  {}
);

// 24. Mistral 7B v0.3
export const Mistral7Bv03_OR = new OpenRouterProvider(
  'mistral-7b-v0.3-or',
  'openrouter',
  'mistralai/mistral-7b-instruct-v0.3',
  'Mistral 7B v0.3 (OpenRouter)',
  'ultra-budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false,
  {}
);

// 25. Nemotron Nano 9B v2
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

// 26. Gemma 3n E4B
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

// ============================================================================
// SYNTHETIC MODELS → OPENROUTER FALLBACKS (6)
// ============================================================================

// 27. DeepSeek V3.2 (needs JSON_STRICT + EXTRACT_JSON like primary)
export const DeepSeekV32_OR = new OpenRouterProvider(
  'deepseek-v3.2-or',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2 (OpenRouter)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 0.88 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 45000,
  }
);

// 28. MiniMax M2
export const MiniMaxM2_OR = new OpenRouterProvider(
  'minimax-m2-or',
  'openrouter',
  'minimax/minimax-m2',
  'MiniMax M2 (OpenRouter)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 0.60 },
  false,
  {}
);

// 29. MiniMax M2.1
export const MiniMaxM21_OR = new OpenRouterProvider(
  'minimax-m2.1-or',
  'openrouter',
  'minimax/minimax-m2.1',
  'MiniMax M2.1 (OpenRouter)',
  'budget',
  { promptPer1M: 0.35, completionPer1M: 0.70 },
  false,
  {}
);

// 30. GLM 4.6 (needs ENGLISH_ENFORCED like primary)
export const GLM46_OR = new OpenRouterProvider(
  'glm-4.6-or',
  'openrouter',
  'z-ai/glm-4.6v',
  'GLM 4.6 (OpenRouter)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.40 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000,
  }
);

// 31. GLM 4.7 (needs ENGLISH_ENFORCED + EXTRACT_JSON like primary)
export const GLM47_OR = new OpenRouterProvider(
  'glm-4.7-or',
  'openrouter',
  'z-ai/glm-4.7',
  'GLM 4.7 (OpenRouter)',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.50 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 60000,
  }
);

// 32. Qwen3 Coder 480B
export const Qwen3Coder480B_OR = new OpenRouterProvider(
  'qwen3-coder-480b-or',
  'openrouter',
  'qwen/qwen3-coder-480b-a35b-07-25',
  'Qwen3 Coder 480B (OpenRouter)',
  'premium',
  { promptPer1M: 1.50, completionPer1M: 3.00 },
  true,
  {}
);

// ============================================================================
// SYNTHETIC MODELS → OPENROUTER FALLBACKS - BATCH 2 (4)
// Added: 2026-02-10 (Quick-37)
// ============================================================================

// 33. Qwen3 235B Thinking (needs THINKING_STRIPPED + STRIP_THINKING_TAGS like primary)
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
  }
);

// 34. DeepSeek V3 0324
export const DeepSeekV3_0324_OR = new OpenRouterProvider(
  'deepseek-v3-0324-or',
  'openrouter',
  'deepseek/deepseek-chat-v3-0324',
  'DeepSeek V3 0324 (OpenRouter)',
  'budget',
  { promptPer1M: 0.19, completionPer1M: 0.87 },
  false,
  {}
);

// 35. DeepSeek V3.1 Terminus
export const DeepSeekV31Terminus_OR = new OpenRouterProvider(
  'deepseek-v3.1-terminus-or',
  'openrouter',
  'deepseek/deepseek-v3.1-terminus',
  'DeepSeek V3.1 Terminus (OpenRouter)',
  'budget',
  { promptPer1M: 0.21, completionPer1M: 0.79 },
  false,
  {}
);

// 36. GPT-OSS 120B (needs JSON_STRICT + EXTRACT_JSON like primary)
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
  }
);

// ============================================================================
// OPENROUTER-ONLY PRIMARY MODELS (2)
// Models only available on OpenRouter, used as standalone primaries
// Added: 2026-02-10 (Quick-38)
// ============================================================================

// 37. GLM 4.7 Flash (needs ENGLISH_ENFORCED + EXTRACT_JSON like GLM 4.7)
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
  }
);

// 38. DeepSeek R1 0528 (needs THINKING_STRIPPED + STRIP_THINKING_TAGS like DeepSeek R1)
export const DeepSeekR1_0528_OR = new OpenRouterProvider(
  'deepseek-r1-0528',
  'openrouter',
  'deepseek/deepseek-r1-0528',
  'DeepSeek R1 0528 (OpenRouter)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 1.75 },
  false,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000,
  }
);

// ============================================================================
// ALL OPENROUTER PROVIDERS (38)
// ============================================================================

export const OPENROUTER_PROVIDERS: OpenRouterProvider[] = [
  // Existing (3)
  DeepSeekR1_OR,
  Qwen3_235B_OR,
  Llama4Scout_OR,
  // Together AI fallbacks - Batch 1 (13)
  Llama4Maverick_OR,
  Llama33_70B_OR,
  Llama31_8B_OR,
  Llama31_405B_OR,
  Llama32_3B_OR,
  Llama3_8B_OR,
  Llama3_70B_OR,
  Qwen3Next80B_OR,
  Qwen25_7B_OR,
  Qwen25_72B_OR,
  Cogito671B_OR,
  Ministral3_14B_OR,
  RNJ1Instruct_OR,
  // Together AI fallbacks - Batch 2 (10)
  DeepSeekV31_OR,
  KimiK2_0905_OR,
  KimiK2Instruct_OR,
  KimiK25_OR,
  GPTOSS20B_OR,
  MistralSmall3_24B_OR,
  Mistral7Bv02_OR,
  Mistral7Bv03_OR,
  NemotronNano9Bv2_OR,
  Gemma3nE4B_OR,
  // Synthetic fallbacks - Batch 1 (6)
  DeepSeekV32_OR,
  MiniMaxM2_OR,
  MiniMaxM21_OR,
  GLM46_OR,
  GLM47_OR,
  Qwen3Coder480B_OR,
  // Synthetic fallbacks - Batch 2 (4)
  Qwen3_235BThinking_OR,
  DeepSeekV3_0324_OR,
  DeepSeekV31Terminus_OR,
  GPTOSS120B_OR,
  // OpenRouter-only primaries (2)
  GLM47Flash_OR,
  DeepSeekR1_0528_OR,
];
