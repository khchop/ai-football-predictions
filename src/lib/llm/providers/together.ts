import { OpenAICompatibleProvider } from './base';

// Cost per 1M tokens (in USD)
export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

// Tier determines budget priority
export type ModelTier = 'free' | 'ultra-budget' | 'budget' | 'premium';

// Generic Together AI provider that can be configured for any model
export class TogetherProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://api.together.xyz/v1/chat/completions';
  
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
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error('Together AI API key is not configured');
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
// 29 OPEN SOURCE MODELS FROM TOGETHER AI
// All models support json_object mode via Together AI
// Updated: January 23, 2026
// Direct provider pricing (no markup)
// Removed: thinking models, GLM (Chinese), unavailable models
// ============================================================================

// ============================================================================
// DEEPSEEK (2 models)
// ============================================================================

// 1. DeepSeek V3.1
export const DeepSeekV31Provider = new TogetherProvider(
  'deepseek-v3.1',
  'together',
  'deepseek-ai/DeepSeek-V3.1',
  'DeepSeek V3.1',
  'budget',
  { promptPer1M: 0.60, completionPer1M: 1.25 },
  false
);

// 2. DeepSeek R1
export const DeepSeekR1Provider = new TogetherProvider(
  'deepseek-r1',
  'together',
  'deepseek-ai/DeepSeek-R1',
  'DeepSeek R1 (Reasoning)',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 7.00 },
  true
);

// ============================================================================
// MOONSHOT (2 models)
// ============================================================================

// 3. Kimi K2 Instruct 0905
export const KimiK2_0905Provider = new TogetherProvider(
  'kimi-k2-0905',
  'together',
  'moonshotai/Kimi-K2-Instruct-0905',
  'Kimi K2 0905 (Moonshot)',
  'budget',
  { promptPer1M: 1.00, completionPer1M: 3.00 },
  false
);

// 4. Kimi K2 Instruct
export const KimiK2InstructProvider = new TogetherProvider(
  'kimi-k2-instruct',
  'together',
  'moonshotai/Kimi-K2-Instruct',
  'Kimi K2 Instruct (Moonshot)',
  'budget',
  { promptPer1M: 1.00, completionPer1M: 3.00 },
  false
);

// ============================================================================
// QWEN (4 models)
// ============================================================================

// 5. Qwen3 235B A22B Instruct (non-thinking version)
export const Qwen3_235BInstructProvider = new TogetherProvider(
  'qwen3-235b-instruct',
  'together',
  'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',
  'Qwen3 235B Instruct (Alibaba)',
  'premium',
  { promptPer1M: 0.65, completionPer1M: 3.00 },
  true
);

// 6. Qwen3 Next 80B Instruct
export const Qwen3Next80BInstructProvider = new TogetherProvider(
  'qwen3-next-80b-instruct',
  'together',
  'Qwen/Qwen3-Next-80B-A3B-Instruct',
  'Qwen3 Next 80B (Alibaba)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 1.50 },
  false
);

// 7. Qwen 2.5 7B Turbo
export const Qwen25_7BTurboProvider = new TogetherProvider(
  'qwen2.5-7b-turbo',
  'together',
  'Qwen/Qwen2.5-7B-Instruct-Turbo',
  'Qwen 2.5 7B Turbo (Alibaba)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 0.30 },
  false
);

// 8. Qwen 2.5 72B Turbo
export const Qwen25_72BTurboProvider = new TogetherProvider(
  'qwen2.5-72b-turbo',
  'together',
  'Qwen/Qwen2.5-72B-Instruct-Turbo',
  'Qwen 2.5 72B Turbo (Alibaba)',
  'budget',
  { promptPer1M: 1.20, completionPer1M: 1.20 },
  false
);

// ============================================================================
// META LLAMA (8 models)
// ============================================================================

// 9. Llama 4 Maverick
export const Llama4MaverickProvider = new TogetherProvider(
  'llama-4-maverick',
  'together',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  'Llama 4 Maverick (Meta)',
  'premium',
  { promptPer1M: 0.27, completionPer1M: 0.85 },
  false
);

// 10. Llama 4 Scout
export const Llama4ScoutProvider = new TogetherProvider(
  'llama-4-scout',
  'together',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'Llama 4 Scout (Meta)',
  'budget',
  { promptPer1M: 0.18, completionPer1M: 0.59 },
  false
);

// 11. Llama 3.3 70B Turbo
export const Llama33_70BTurboProvider = new TogetherProvider(
  'llama-3.3-70b-turbo',
  'together',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'Llama 3.3 70B Turbo (Meta)',
  'budget',
  { promptPer1M: 0.88, completionPer1M: 0.88 },
  false
);

// 12. Llama 3.1 8B Turbo
export const Llama31_8BTurboProvider = new TogetherProvider(
  'llama-3.1-8b-turbo',
  'together',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'Llama 3.1 8B Turbo (Meta)',
  'ultra-budget',
  { promptPer1M: 0.18, completionPer1M: 0.18 },
  false
);

// 13. Llama 3.1 405B Turbo
export const Llama31_405BTurboProvider = new TogetherProvider(
  'llama-3.1-405b-turbo',
  'together',
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
  'Llama 3.1 405B Turbo (Meta)',
  'premium',
  { promptPer1M: 3.50, completionPer1M: 3.50 },
  true
);

// 14. Llama 3.2 3B Turbo
export const Llama32_3BTurboProvider = new TogetherProvider(
  'llama-3.2-3b-turbo',
  'together',
  'meta-llama/Llama-3.2-3B-Instruct-Turbo',
  'Llama 3.2 3B Turbo (Meta)',
  'ultra-budget',
  { promptPer1M: 0.06, completionPer1M: 0.06 },
  false
);

// 15. Llama 3 8B Lite
export const Llama3_8BLiteProvider = new TogetherProvider(
  'llama-3-8b-lite',
  'together',
  'meta-llama/Meta-Llama-3-8B-Instruct-Lite',
  'Llama 3 8B Lite (Meta)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.10 },
  false
);

// 16. Llama 3 70B Reference
export const Llama3_70BReferenceProvider = new TogetherProvider(
  'llama-3-70b-reference',
  'together',
  'meta-llama/Llama-3-70b-chat-hf',
  'Llama 3 70B Reference (Meta)',
  'budget',
  { promptPer1M: 0.90, completionPer1M: 0.90 },
  false
);

// ============================================================================
// OPENAI OSS (1 model)
// ============================================================================

// 17. GPT-OSS 20B
export const GPTOSS20BProvider = new TogetherProvider(
  'gpt-oss-20b',
  'together',
  'openai/gpt-oss-20b',
  'GPT-OSS 20B (OpenAI)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.20 },
  false
);

// ============================================================================
// DEEP COGITO (4 models)
// ============================================================================

// 18. Cogito v2 70B
export const Cogito70BProvider = new TogetherProvider(
  'cogito-70b',
  'together',
  'deepcogito/cogito-v2-preview-llama-70B',
  'Cogito v2 70B (Deep Cogito)',
  'budget',
  { promptPer1M: 0.88, completionPer1M: 0.88 },
  false
);

// 19. Cogito v2 109B MoE
export const Cogito109BMoEProvider = new TogetherProvider(
  'cogito-109b-moe',
  'together',
  'deepcogito/cogito-v2-preview-llama-109B-MoE',
  'Cogito v2 109B MoE (Deep Cogito)',
  'budget',
  { promptPer1M: 0.18, completionPer1M: 0.59 },
  false
);

// 20. Cogito v2 405B
export const Cogito405BProvider = new TogetherProvider(
  'cogito-405b',
  'together',
  'deepcogito/cogito-v2-preview-llama-405B',
  'Cogito v2 405B (Deep Cogito)',
  'premium',
  { promptPer1M: 3.50, completionPer1M: 3.50 },
  true
);

// 21. Cogito v2.1 671B
export const Cogito671BProvider = new TogetherProvider(
  'cogito-671b',
  'together',
  'deepcogito/cogito-v2-1-671b',
  'Cogito v2.1 671B (Deep Cogito)',
  'premium',
  { promptPer1M: 1.25, completionPer1M: 1.25 },
  true
);

// ============================================================================
// MISTRAL (4 models)
// ============================================================================

// 22. Ministral 3 14B
export const Ministral3_14BProvider = new TogetherProvider(
  'ministral-3-14b',
  'together',
  'mistralai/Ministral-3-14B-Instruct-2512',
  'Ministral 3 14B (Mistral)',
  'budget',
  { promptPer1M: 0.80, completionPer1M: 0.80 },
  false
);

// 23. Mistral Small 3 24B
export const MistralSmall3_24BProvider = new TogetherProvider(
  'mistral-small-3-24b',
  'together',
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'Mistral Small 3 24B (Mistral)',
  'budget',
  { promptPer1M: 0.80, completionPer1M: 0.80 },
  false
);

// 24. Mistral 7B v0.2
export const Mistral7Bv02Provider = new TogetherProvider(
  'mistral-7b-v0.2',
  'together',
  'mistralai/Mistral-7B-Instruct-v0.2',
  'Mistral 7B v0.2 (Mistral)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false
);

// 25. Mistral 7B v0.3
export const Mistral7Bv03Provider = new TogetherProvider(
  'mistral-7b-v0.3',
  'together',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'Mistral 7B v0.3 (Mistral)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false
);

// ============================================================================
// NVIDIA (1 model)
// ============================================================================

// 26. Nemotron Nano 9B v2
export const NemotronNano9Bv2Provider = new TogetherProvider(
  'nemotron-nano-9b-v2',
  'together',
  'nvidia/NVIDIA-Nemotron-Nano-9B-v2',
  'Nemotron Nano 9B v2 (NVIDIA)',
  'budget',
  { promptPer1M: 0.88, completionPer1M: 0.88 },
  false
);

// ============================================================================
// GOOGLE (1 model)
// ============================================================================

// 27. Gemma 3n E4B
export const Gemma3nE4BProvider = new TogetherProvider(
  'gemma-3n-e4b',
  'together',
  'google/gemma-3n-E4B-it',
  'Gemma 3n E4B (Google)',
  'ultra-budget',
  { promptPer1M: 0.02, completionPer1M: 0.04 },
  false
);

// ============================================================================
// OTHER (2 models)
// ============================================================================

// 28. Rnj-1 Instruct
export const Rnj1InstructProvider = new TogetherProvider(
  'rnj-1-instruct',
  'together',
  'essentialai/rnj-1-instruct',
  'Rnj-1 Instruct (Essential AI)',
  'budget',
  { promptPer1M: 0.88, completionPer1M: 0.88 },
  false
);

// 29. Marin 8B Instruct
export const Marin8BInstructProvider = new TogetherProvider(
  'marin-8b-instruct',
  'together',
  'marin-community/marin-8b-instruct',
  'Marin 8B Instruct (Marin Community)',
  'ultra-budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false
);

// ============================================================================
// Export all Together AI providers (29 open-source models)
// ============================================================================

export const TOGETHER_PROVIDERS = [
  // DeepSeek (2)
  DeepSeekV31Provider,           // 1  - $0.60/$1.25
  DeepSeekR1Provider,            // 2  - $3.00/$7.00 (premium)
  
  // Moonshot (2)
  KimiK2_0905Provider,           // 3  - $1.00/$3.00
  KimiK2InstructProvider,        // 4  - $1.00/$3.00
  
  // Qwen (4)
  Qwen3_235BInstructProvider,    // 5  - $0.65/$3.00 (premium)
  Qwen3Next80BInstructProvider,  // 6  - $0.15/$1.50
  Qwen25_7BTurboProvider,        // 7  - $0.30/$0.30
  Qwen25_72BTurboProvider,       // 8  - $1.20/$1.20
  
  // Meta Llama (8)
  Llama4MaverickProvider,        // 9  - $0.27/$0.85
  Llama4ScoutProvider,           // 10 - $0.18/$0.59
  Llama33_70BTurboProvider,      // 11 - $0.88/$0.88
  Llama31_8BTurboProvider,       // 12 - $0.18/$0.18
  Llama31_405BTurboProvider,     // 13 - $3.50/$3.50 (premium)
  Llama32_3BTurboProvider,       // 14 - $0.06/$0.06
  Llama3_8BLiteProvider,         // 15 - $0.10/$0.10
  Llama3_70BReferenceProvider,   // 16 - $0.90/$0.90
  
  // OpenAI OSS (1)
  GPTOSS20BProvider,             // 17 - $0.05/$0.20
  
  // Deep Cogito (4)
  Cogito70BProvider,             // 18 - $0.88/$0.88
  Cogito109BMoEProvider,         // 19 - $0.18/$0.59
  Cogito405BProvider,            // 20 - $3.50/$3.50 (premium)
  Cogito671BProvider,            // 21 - $1.25/$1.25 (premium)
  
  // Mistral (4)
  Ministral3_14BProvider,        // 22 - $0.80/$0.80
  MistralSmall3_24BProvider,     // 23 - $0.80/$0.80
  Mistral7Bv02Provider,          // 24 - $0.20/$0.20
  Mistral7Bv03Provider,          // 25 - $0.20/$0.20
  
  // NVIDIA (1)
  NemotronNano9Bv2Provider,      // 26 - $0.88/$0.88
  
  // Google (1)
  Gemma3nE4BProvider,            // 27 - $0.02/$0.04
  
  // Other (2)
  Rnj1InstructProvider,          // 28 - $0.88/$0.88
  Marin8BInstructProvider,       // 29 - $0.20/$0.20
];

// ============================================================================
// Summary (Updated January 2026):
// - 29 open-source models with full JSON support
// - Removed: thinking models, GLM (Chinese output), unavailable models
// - All models support json_object mode via Together AI
// - Direct provider pricing (no OpenRouter markup)
// - Provider diversity: 9 different providers
// - Better reliability: single-hop API, no routing layer
// - Lower latency: direct connection to Together AI infrastructure
// - Estimated cost at 25 matches/day: ~$7.50-10/month (5-15% savings vs OpenRouter)
// ============================================================================
