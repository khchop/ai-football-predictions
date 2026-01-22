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
      'X-OpenRouter-Plugin': 'response-healing', // Auto-fix malformed JSON (80-99% defect reduction)
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
// 30 OPEN SOURCE MODELS WITH JSON SUPPORT
// All models verified for json_object or json_schema support via OpenRouter
// Updated: January 22, 2026
// ============================================================================

// ============================================================================
// DEEPSEEK (2 models)
// ============================================================================

// 1. DeepSeek V3.2
export const DeepSeekV32Provider = new OpenRouterProvider(
  'deepseek-v3.2',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.38 },
  false
);

// 2. DeepSeek V3.1 Terminus
export const DeepSeekV31TerminusProvider = new OpenRouterProvider(
  'deepseek-v3.1-terminus',
  'openrouter',
  'deepseek/deepseek-v3.1-terminus',
  'DeepSeek V3.1 Terminus',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.75 },
  false
);

// ============================================================================
// META (3 models)
// ============================================================================

// 3. Llama 4 Maverick
export const Llama4MaverickProvider = new OpenRouterProvider(
  'llama-4-maverick',
  'openrouter',
  'meta-llama/llama-4-maverick',
  'Llama 4 Maverick (Meta)',
  'premium',
  { promptPer1M: 0.15, completionPer1M: 0.60 },
  false
);

// 4. Llama 4 Scout
export const Llama4ScoutProvider = new OpenRouterProvider(
  'llama-4-scout',
  'openrouter',
  'meta-llama/llama-4-scout',
  'Llama 4 Scout (Meta)',
  'budget',
  { promptPer1M: 0.08, completionPer1M: 0.30 },
  false
);

// 5. Llama 3.3 70B
export const Llama33_70BProvider = new OpenRouterProvider(
  'llama-3.3-70b',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B (Meta)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.32 },
  false
);

// ============================================================================
// QWEN (3 models)
// ============================================================================

// 6. Qwen3 235B
export const Qwen3_235BProvider = new OpenRouterProvider(
  'qwen3-235b',
  'openrouter',
  'qwen/qwen3-235b-a22b-instruct-2507',
  'Qwen3 235B (Alibaba)',
  'premium',
  { promptPer1M: 1.50, completionPer1M: 2.00 },
  false
);

// 7. Qwen3 Coder 480B
export const Qwen3Coder480BProvider = new OpenRouterProvider(
  'qwen3-coder-480b',
  'openrouter',
  'qwen/qwen3-coder-480b-a35b',
  'Qwen3 Coder 480B (Alibaba)',
  'premium',
  { promptPer1M: 2.00, completionPer1M: 3.00 },
  false
);

// 8. Qwen3 32B
export const Qwen3_32BProvider = new OpenRouterProvider(
  'qwen3-32b',
  'openrouter',
  'qwen/qwen3-32b',
  'Qwen3 32B (Alibaba)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.40 },
  false
);

// ============================================================================
// MISTRAL (3 models)
// ============================================================================

// 9. Mistral Large 3
export const MistralLarge3Provider = new OpenRouterProvider(
  'mistral-large-3',
  'openrouter',
  'mistralai/mistral-large-3',
  'Mistral Large 3',
  'premium',
  { promptPer1M: 2.00, completionPer1M: 6.00 },
  false
);

// 10. Devstral 2
export const Devstral2Provider = new OpenRouterProvider(
  'devstral-2',
  'openrouter',
  'mistralai/devstral-2',
  'Devstral 2 (Mistral)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.45 },
  false
);

// 11. Mistral Small 3.2 24B
export const MistralSmall32Provider = new OpenRouterProvider(
  'mistral-small-3.2',
  'openrouter',
  'mistralai/mistral-small-3.2-24b',
  'Mistral Small 3.2 (24B)',
  'budget',
  { promptPer1M: 0.20, completionPer1M: 0.60 },
  false
);

// ============================================================================
// MOONSHOT (2 models)
// ============================================================================

// 12. Kimi K2 Instruct
export const KimiK2InstructProvider = new OpenRouterProvider(
  'kimi-k2-instruct',
  'openrouter',
  'moonshotai/kimi-k2-instruct',
  'Kimi K2 Instruct (Moonshot)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 0.60 },
  false
);

// 13. Kimi K2 0905
export const KimiK2_0905Provider = new OpenRouterProvider(
  'kimi-k2-0905',
  'openrouter',
  'moonshotai/kimi-k2-0905',
  'Kimi K2 0905 (Moonshot)',
  'budget',
  { promptPer1M: 0.30, completionPer1M: 0.60 },
  false
);

// ============================================================================
// XAI (2 models)
// ============================================================================

// 14. Grok 4.1 Fast
export const Grok41FastProvider = new OpenRouterProvider(
  'grok-4.1-fast',
  'openrouter',
  'x-ai/grok-4.1-fast',
  'Grok 4.1 Fast (xAI)',
  'premium',
  { promptPer1M: 0.20, completionPer1M: 0.50 },
  false
);

// 15. Grok 4 Fast
export const Grok4FastProvider = new OpenRouterProvider(
  'grok-4-fast',
  'openrouter',
  'x-ai/grok-4-fast',
  'Grok 4 Fast (xAI)',
  'premium',
  { promptPer1M: 0.20, completionPer1M: 0.50 },
  false
);

// ============================================================================
// ZHIPU (2 models)
// ============================================================================

// 16. GLM 4.7
export const GLM47Provider = new OpenRouterProvider(
  'glm-4.7',
  'openrouter',
  'z-ai/glm-4.7',
  'GLM 4.7 (Zhipu)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.30 },
  false
);

// 17. GLM 4.5 Air
export const GLM45AirProvider = new OpenRouterProvider(
  'glm-4.5-air',
  'openrouter',
  'z-ai/glm-4.5-air',
  'GLM 4.5 Air (Zhipu)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.15 },
  false
);

// ============================================================================
// MINIMAX (2 models)
// ============================================================================

// 18. MiniMax M2
export const MiniMaxM2Provider = new OpenRouterProvider(
  'minimax-m2',
  'openrouter',
  'minimax/minimax-m2',
  'MiniMax M2',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.50 },
  false
);

// 19. MiniMax M2.1
export const MiniMaxM21Provider = new OpenRouterProvider(
  'minimax-m2.1',
  'openrouter',
  'minimax/minimax-m2.1',
  'MiniMax M2.1',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.50 },
  false
);

// ============================================================================
// XIAOMI (1 model)
// ============================================================================

// 20. MiMo V2 Flash
export const MiMoV2FlashProvider = new OpenRouterProvider(
  'mimo-v2-flash',
  'openrouter',
  'xiaomi/mimo-v2-flash',
  'MiMo V2 Flash (Xiaomi)',
  'ultra-budget',
  { promptPer1M: 0.08, completionPer1M: 0.20 },
  false
);

// ============================================================================
// NVIDIA (2 models)
// ============================================================================

// 21. Llama 3.1 Nemotron Ultra 253B
export const NemotronUltra253BProvider = new OpenRouterProvider(
  'nemotron-ultra-253b',
  'openrouter',
  'nvidia/llama-3.1-nemotron-ultra-253b',
  'Nemotron Ultra 253B (NVIDIA)',
  'premium',
  { promptPer1M: 0.50, completionPer1M: 1.00 },
  false
);

// 22. Nemotron 3 Nano 30B
export const Nemotron3Nano30BProvider = new OpenRouterProvider(
  'nemotron-3-nano-30b',
  'openrouter',
  'nvidia/nemotron-3-nano-30b-a3b',
  'Nemotron 3 Nano 30B (NVIDIA)',
  'budget',
  { promptPer1M: 0.12, completionPer1M: 0.25 },
  false
);

// ============================================================================
// COHERE (2 models)
// ============================================================================

// 23. Command R+
export const CommandRPlusProvider = new OpenRouterProvider(
  'command-r-plus',
  'openrouter',
  'cohere/command-r-plus-08-2024',
  'Command R+ (Cohere)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 10.00 },
  false
);

// 24. Command R
export const CommandRProvider = new OpenRouterProvider(
  'command-r',
  'openrouter',
  'cohere/command-r-08-2024',
  'Command R (Cohere)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.60 },
  false
);

// ============================================================================
// OPENAI OSS (2 models)
// ============================================================================

// 25. GPT OSS 120B
export const GPTOSS120BProvider = new OpenRouterProvider(
  'gpt-oss-120b',
  'openrouter',
  'openai/gpt-oss-120b',
  'GPT OSS 120B (OpenAI)',
  'premium',
  { promptPer1M: 0.80, completionPer1M: 1.50 },
  false
);

// 26. GPT OSS 20B
export const GPTOSS20BProvider = new OpenRouterProvider(
  'gpt-oss-20b',
  'openrouter',
  'openai/gpt-oss-20b',
  'GPT OSS 20B (OpenAI)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false
);

// ============================================================================
// GOOGLE (1 model)
// ============================================================================

// 27. Gemma 3 27B
export const Gemma3_27BProvider = new OpenRouterProvider(
  'gemma-3-27b',
  'openrouter',
  'google/gemma-3-27b-it',
  'Gemma 3 27B (Google)',
  'budget',
  { promptPer1M: 0.12, completionPer1M: 0.35 },
  false
);

// ============================================================================
// IBM (1 model)
// ============================================================================

// 28. Granite 3.2 8B
export const Granite32_8BProvider = new OpenRouterProvider(
  'granite-3.2-8b',
  'openrouter',
  'ibm-granite/granite-3.2-8b-instruct',
  'Granite 3.2 8B (IBM)',
  'ultra-budget',
  { promptPer1M: 0.05, completionPer1M: 0.15 },
  false
);

// ============================================================================
// ARCEE (1 model)
// ============================================================================

// 29. Trinity Mini
export const TrinityMiniProvider = new OpenRouterProvider(
  'trinity-mini',
  'openrouter',
  'arcee-ai/trinity-mini',
  'Trinity Mini (Arcee)',
  'ultra-budget',
  { promptPer1M: 0.06, completionPer1M: 0.18 },
  false
);

// ============================================================================
// BYTEDANCE (1 model)
// ============================================================================

// 30. Seed OSS 36B
export const SeedOSS36BProvider = new OpenRouterProvider(
  'seed-oss-36b',
  'openrouter',
  'bytedance/seed-oss-36b',
  'Seed OSS 36B (ByteDance)',
  'budget',
  { promptPer1M: 0.18, completionPer1M: 0.40 },
  false
);

// ============================================================================
// Export all OpenRouter providers (30 open-source models)
// ============================================================================

export const OPENROUTER_PROVIDERS = [
  // DeepSeek (2)
  DeepSeekV32Provider,           // 1  - $0.25/$0.38
  DeepSeekV31TerminusProvider,   // 2  - $0.15/$0.75
  
  // Meta (3)
  Llama4MaverickProvider,        // 3  - $0.15/$0.60
  Llama4ScoutProvider,           // 4  - $0.08/$0.30
  Llama33_70BProvider,           // 5  - $0.10/$0.32
  
  // Qwen (3)
  Qwen3_235BProvider,            // 6  - $1.50/$2.00
  Qwen3Coder480BProvider,        // 7  - $2.00/$3.00
  Qwen3_32BProvider,             // 8  - $0.20/$0.40
  
  // Mistral (3)
  MistralLarge3Provider,         // 9  - $2.00/$6.00
  Devstral2Provider,             // 10 - $0.15/$0.45
  MistralSmall32Provider,        // 11 - $0.20/$0.60
  
  // Moonshot (2)
  KimiK2InstructProvider,        // 12 - $0.30/$0.60
  KimiK2_0905Provider,           // 13 - $0.30/$0.60
  
  // xAI (2)
  Grok41FastProvider,            // 14 - $0.20/$0.50
  Grok4FastProvider,             // 15 - $0.20/$0.50
  
  // Zhipu (2)
  GLM47Provider,                 // 16 - $0.15/$0.30
  GLM45AirProvider,              // 17 - $0.05/$0.15
  
  // MiniMax (2)
  MiniMaxM2Provider,             // 18 - $0.25/$0.50
  MiniMaxM21Provider,            // 19 - $0.25/$0.50
  
  // Xiaomi (1)
  MiMoV2FlashProvider,           // 20 - $0.08/$0.20
  
  // NVIDIA (2)
  NemotronUltra253BProvider,     // 21 - $0.50/$1.00
  Nemotron3Nano30BProvider,      // 22 - $0.12/$0.25
  
  // Cohere (2)
  CommandRPlusProvider,          // 23 - $2.50/$10.00
  CommandRProvider,              // 24 - $0.15/$0.60
  
  // OpenAI OSS (2)
  GPTOSS120BProvider,            // 25 - $0.80/$1.50
  GPTOSS20BProvider,             // 26 - $0.10/$0.30
  
  // Google (1)
  Gemma3_27BProvider,            // 27 - $0.12/$0.35
  
  // IBM (1)
  Granite32_8BProvider,          // 28 - $0.05/$0.15
  
  // Arcee (1)
  TrinityMiniProvider,           // 29 - $0.06/$0.18
  
  // ByteDance (1)
  SeedOSS36BProvider,            // 30 - $0.18/$0.40
];

// ============================================================================
// Summary (Updated January 2026):
// - 30 open-source models with full JSON support
// - All models support json_object mode or json_schema
// - Response-healing header enabled for 80-99% JSON defect reduction
// - Provider diversity: 12 different providers
// - No reasoning models (pure instruct/chat models only)
// - Estimated cost at 25 matches/day: ~$8-12/month (depending on model selection)
// ============================================================================
