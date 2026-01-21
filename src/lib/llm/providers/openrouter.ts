import { OpenAICompatibleProvider } from './base';

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

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly model: string,
    public readonly displayName: string,
    tier: ModelTier,
    pricing: ModelPricing,
    public readonly isPremium: boolean = false
  ) {
    super();
    this.tier = tier;
    this.pricing = pricing;
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
// TIER 1: FREE / COMMUNITY HEROES (10)
// These do the heavy lifting for $0 cost.
// ============================================================================

// 1. Llama 3.3 70B (Free) - Meta
export const Llama33_70B_FreeProvider = new OpenRouterProvider(
  'llama-3.3-70b-free',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct:free',
  'Llama 3.3 70B (Meta)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 2. Mistral Small 3.1 - Mistral (Free)
export const MistralSmall31Provider = new OpenRouterProvider(
  'mistral-small-3.1',
  'openrouter',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'Mistral Small 3.1 (Mistral)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 3. Gemma 3 27B - Google (Free)
export const Gemma3_27BProvider = new OpenRouterProvider(
  'gemma-3-27b',
  'openrouter',
  'google/gemma-3-27b-it:free',
  'Gemma 3 27B (Google)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 4. DeepSeek V3 - DeepSeek (Free)
export const DeepSeekV3FreeProvider = new OpenRouterProvider(
  'deepseek-v3-free',
  'openrouter',
  'deepseek/deepseek-chat:free',
  'DeepSeek V3 (DeepSeek)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 5. Qwen 2.5 72B - Alibaba (Free)
export const Qwen25_72BProvider = new OpenRouterProvider(
  'qwen-2.5-72b',
  'openrouter',
  'qwen/qwen-2.5-72b-instruct:free',
  'Qwen 2.5 72B (Alibaba)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 6. Nemotron 3 Nano - NVIDIA (Free)
export const Nemotron3NanoProvider = new OpenRouterProvider(
  'nemotron-3-nano',
  'openrouter',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'Nemotron 3 Nano (NVIDIA)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 7. Phi-4 - Microsoft (Free)
export const Phi4FreeProvider = new OpenRouterProvider(
  'phi-4-free',
  'openrouter',
  'microsoft/phi-4:free',
  'Phi-4 (Microsoft)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 8. Dolphin Mistral 24B - Venice (Free)
export const DolphinMistral24BProvider = new OpenRouterProvider(
  'dolphin-mistral-24b',
  'openrouter',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'Dolphin Mistral 24B (Venice)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 9. Hermes 3 405B - NousResearch (Free)
export const Hermes3_405B_FreeProvider = new OpenRouterProvider(
  'hermes-3-405b-free',
  'openrouter',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'Hermes 3 405B (NousResearch)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 10. Llama 3.2 11B Vision - Meta (Free)
export const Llama32_11BProvider = new OpenRouterProvider(
  'llama-3.2-11b',
  'openrouter',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'Llama 3.2 11B (Meta)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// TIER 2: ULTRA-BUDGET LOGIC (8)
// Very fast, non-reasoning models for simple data parsing.
// ============================================================================

// 11. Llama 3.2 3B - Meta
export const Llama32_3BProvider = new OpenRouterProvider(
  'llama-3.2-3b',
  'openrouter',
  'meta-llama/llama-3.2-3b-instruct',
  'Llama 3.2 3B (Meta)',
  'ultra-budget',
  { promptPer1M: 0.02, completionPer1M: 0.02 },
  false
);

// 12. Gemma 3 4B - Google
export const Gemma3_4BProvider = new OpenRouterProvider(
  'gemma-3-4b',
  'openrouter',
  'google/gemma-3-4b-it',
  'Gemma 3 4B (Google)',
  'ultra-budget',
  { promptPer1M: 0.017, completionPer1M: 0.068 },
  false
);

// 13. Gemma 3 12B - Google
export const Gemma3_12BProvider = new OpenRouterProvider(
  'gemma-3-12b',
  'openrouter',
  'google/gemma-3-12b-it',
  'Gemma 3 12B (Google)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.10 },
  false
);

// 14. Mistral 7B - Mistral
export const Mistral7BProvider = new OpenRouterProvider(
  'mistral-7b',
  'openrouter',
  'mistralai/mistral-7b-instruct',
  'Mistral 7B (Mistral)',
  'ultra-budget',
  { promptPer1M: 0.028, completionPer1M: 0.054 },
  false
);

// 15. Qwen 2.5 7B - Alibaba
export const Qwen25_7BProvider = new OpenRouterProvider(
  'qwen-2.5-7b',
  'openrouter',
  'qwen/qwen-2.5-7b-instruct',
  'Qwen 2.5 7B (Alibaba)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.10 },
  false
);

// 16. Qwen 2.5 Coder 32B - Alibaba
export const Qwen25Coder32BProvider = new OpenRouterProvider(
  'qwen-2.5-coder-32b',
  'openrouter',
  'qwen/qwen-2.5-coder-32b-instruct',
  'Qwen 2.5 Coder 32B (Alibaba)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.11 },
  false
);

// 17. Nemotron Nano 9B - NVIDIA
export const NemotronNano9BProvider = new OpenRouterProvider(
  'nemotron-nano-9b',
  'openrouter',
  'nvidia/nemotron-nano-9b-v2',
  'Nemotron Nano 9B (NVIDIA)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.16 },
  false
);

// 18. Command R 7B - Cohere
export const CommandR7BProvider = new OpenRouterProvider(
  'command-r-7b',
  'openrouter',
  'cohere/command-r7b-12-2024',
  'Command R 7B (Cohere)',
  'ultra-budget',
  { promptPer1M: 0.037, completionPer1M: 0.15 },
  false
);

// ============================================================================
// TIER 3: VALUE WORKHORSES (7)
// The sweet spot between cost and performance.
// ============================================================================

// 19. Llama 3.3 70B (Paid) - Meta
export const Llama33_70BProvider = new OpenRouterProvider(
  'llama-3.3-70b',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B Paid (Meta)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.32 },
  false
);

// 20. Llama 4 Scout - Meta
export const Llama4ScoutProvider = new OpenRouterProvider(
  'llama-4-scout',
  'openrouter',
  'meta-llama/llama-4-scout',
  'Llama 4 Scout (Meta)',
  'budget',
  { promptPer1M: 0.08, completionPer1M: 0.30 },
  false
);

// 21. DeepSeek V3.2 - DeepSeek
export const DeepSeekV32Provider = new OpenRouterProvider(
  'deepseek-v3.2',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2 (DeepSeek)',
  'budget',
  { promptPer1M: 0.14, completionPer1M: 0.28 },
  false
);

// 22. DeepSeek V3.1 - DeepSeek
export const DeepSeekV31Provider = new OpenRouterProvider(
  'deepseek-v3.1',
  'openrouter',
  'deepseek/deepseek-chat-v3.1',
  'DeepSeek V3.1 (DeepSeek)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.75 },
  false
);

// 23. Mistral Saba - Mistral
export const MistralSabaProvider = new OpenRouterProvider(
  'mistral-saba',
  'openrouter',
  'mistralai/mistral-saba',
  'Mistral Saba (Mistral)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.60 },
  false
);

// 24. Command R - Cohere
export const CommandRProvider = new OpenRouterProvider(
  'command-r',
  'openrouter',
  'cohere/command-r-08-2024',
  'Command R (Cohere)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.60 },
  false
);

// 25. OLMo 2 7B - AllenAI
export const OLMo2_7BProvider = new OpenRouterProvider(
  'olmo-2-7b',
  'openrouter',
  'allenai/olmo-2-7b-instruct',
  'OLMo 2 7B (AllenAI)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.10 },
  false
);

// ============================================================================
// TIER 4: PREMIUM OPEN WEIGHTS (5)
// Expensive, but needed for the "Correct Answer" benchmark.
// ============================================================================

// 26. Llama 3.1 405B - Meta
export const Llama31_405BProvider = new OpenRouterProvider(
  'llama-3.1-405b',
  'openrouter',
  'meta-llama/llama-3.1-405b-instruct',
  'Llama 3.1 405B (Meta)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 2.50 },
  true
);

// 27. Mistral Large 2 - Mistral
export const MistralLarge2Provider = new OpenRouterProvider(
  'mistral-large-2',
  'openrouter',
  'mistralai/mistral-large-2411',
  'Mistral Large 2 (Mistral)',
  'premium',
  { promptPer1M: 2.00, completionPer1M: 6.00 },
  true
);

// 28. Command R+ - Cohere
export const CommandRPlusProvider = new OpenRouterProvider(
  'command-r-plus',
  'openrouter',
  'cohere/command-r-plus-08-2024',
  'Command R+ (Cohere)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 10.00 },
  true
);

// 29. Nemotron Ultra 253B - NVIDIA
export const NemotronUltra253BProvider = new OpenRouterProvider(
  'nemotron-ultra-253b',
  'openrouter',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'Nemotron Ultra 253B (NVIDIA)',
  'premium',
  { promptPer1M: 0.60, completionPer1M: 1.80 },
  true
);

// 30. Hermes 3 405B (Paid) - NousResearch
export const Hermes3_405BProvider = new OpenRouterProvider(
  'hermes-3-405b',
  'openrouter',
  'nousresearch/hermes-3-llama-3.1-405b',
  'Hermes 3 405B Paid (NousResearch)',
  'premium',
  { promptPer1M: 1.00, completionPer1M: 1.00 },
  true
);

// ============================================================================
// Export all OpenRouter providers (30 open-source models)
// ============================================================================

export const OPENROUTER_PROVIDERS = [
  // TIER 1: FREE (10)
  Llama33_70B_FreeProvider,      // 1  - FREE
  MistralSmall31Provider,        // 2  - FREE
  Gemma3_27BProvider,            // 3  - FREE
  DeepSeekV3FreeProvider,        // 4  - FREE
  Qwen25_72BProvider,            // 5  - FREE
  Nemotron3NanoProvider,         // 6  - FREE
  Phi4FreeProvider,              // 7  - FREE
  DolphinMistral24BProvider,     // 8  - FREE
  Hermes3_405B_FreeProvider,     // 9  - FREE
  Llama32_11BProvider,           // 10 - FREE
  
  // TIER 2: ULTRA-BUDGET (8)
  Llama32_3BProvider,            // 11 - $0.02/$0.02
  Gemma3_4BProvider,             // 12 - $0.017/$0.068
  Gemma3_12BProvider,            // 13 - $0.03/$0.10
  Mistral7BProvider,             // 14 - $0.028/$0.054
  Qwen25_7BProvider,             // 15 - $0.04/$0.10
  Qwen25Coder32BProvider,        // 16 - $0.03/$0.11
  NemotronNano9BProvider,        // 17 - $0.04/$0.16
  CommandR7BProvider,            // 18 - $0.037/$0.15
  
  // TIER 3: BUDGET (7)
  Llama33_70BProvider,           // 19 - $0.10/$0.32
  Llama4ScoutProvider,           // 20 - $0.08/$0.30
  DeepSeekV32Provider,           // 21 - $0.14/$0.28
  DeepSeekV31Provider,           // 22 - $0.15/$0.75
  MistralSabaProvider,           // 23 - $0.20/$0.60
  CommandRProvider,              // 24 - $0.15/$0.60
  OLMo2_7BProvider,              // 25 - $0.10/$0.10
  
  // TIER 4: PREMIUM (5)
  Llama31_405BProvider,          // 26 - $2.50/$2.50
  MistralLarge2Provider,         // 27 - $2.00/$6.00
  CommandRPlusProvider,          // 28 - $2.50/$10.00
  NemotronUltra253BProvider,     // 29 - $0.60/$1.80
  Hermes3_405BProvider,          // 30 - $1.00/$1.00
];

// Summary:
// - 10 FREE models (no cost)
// - 8 ULTRA-BUDGET models ($0.02-$0.16 per 1M tokens)
// - 7 BUDGET models ($0.08-$0.75 per 1M tokens)
// - 5 PREMIUM models ($0.60-$10.00 per 1M tokens)
// - All 30 models are open-source/open-weights
