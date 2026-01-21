import { OpenAICompatibleProvider } from './base';

// Cost per 1M tokens (in USD) - blended rate
export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

// Tier determines budget priority
export type ModelTier = 'free' | 'cheap' | 'mid' | 'premium';

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
// META Llama Models (3) - Open Weights
// ============================================================================

// 1. Llama 4 Maverick (400B) - Paid (no free tier)
export const Llama4MaverickProvider = new OpenRouterProvider(
  'llama-4-maverick',
  'openrouter',
  'meta-llama/llama-4-maverick',
  'Llama 4 Maverick 400B (Meta)',
  'cheap',
  { promptPer1M: 0.15, completionPer1M: 0.40 },
  false
);

// 2. Llama 4 Scout (109B) - Paid (no free tier)
export const Llama4ScoutProvider = new OpenRouterProvider(
  'llama-4-scout',
  'openrouter',
  'meta-llama/llama-4-scout',
  'Llama 4 Scout 109B (Meta)',
  'cheap',
  { promptPer1M: 0.08, completionPer1M: 0.30 },
  false
);

// 3. Llama 3.3 70B - Paid ($0.45/1M blended)
export const Llama33_70BProvider = new OpenRouterProvider(
  'llama-3.3-70b',
  'openrouter',
  'meta-llama/llama-3.3-70b-instruct',
  'Llama 3.3 70B (Meta)',
  'cheap',
  { promptPer1M: 0.10, completionPer1M: 0.35 },
  false
);

// ============================================================================
// MISTRAL Models (3) - Open Weights
// ============================================================================

// 4. Devstral 2512 - FREE
export const Devstral2Provider = new OpenRouterProvider(
  'devstral-2',
  'openrouter',
  'mistralai/devstral-2512:free',
  'Devstral 2512 (Mistral)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 5. Mistral Large 3 (2512) - Paid ($1.00/1M blended)
export const MistralLarge3Provider = new OpenRouterProvider(
  'mistral-large-3',
  'openrouter',
  'mistralai/mistral-large-2512',
  'Mistral Large 3 (Mistral)',
  'mid',
  { promptPer1M: 0.50, completionPer1M: 1.50 },
  false
);

// 6. Mistral Small 3.1 - FREE
export const MistralSmall31Provider = new OpenRouterProvider(
  'mistral-small-3.1',
  'openrouter',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'Mistral Small 3.1 (Mistral)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// DEEPSEEK Models (3) - Open Weights
// ============================================================================

// 7. DeepSeek V3.2 - Paid ($0.35/1M blended)
export const DeepSeekV32Provider = new OpenRouterProvider(
  'deepseek-v3.2',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2 (DeepSeek)',
  'cheap',
  { promptPer1M: 0.25, completionPer1M: 0.38 },
  false
);

// 8. DeepSeek V3.1 Terminus - Paid ($0.60/1M blended)
export const DeepSeekV31TerminusProvider = new OpenRouterProvider(
  'deepseek-v3.1-terminus',
  'openrouter',
  'deepseek/deepseek-v3.1-terminus',
  'DeepSeek V3.1 Terminus (DeepSeek)',
  'cheap',
  { promptPer1M: 0.27, completionPer1M: 1.00 },
  false
);

// 9. DeepSeek V2.5 - Paid ($0.20/1M blended)
export const DeepSeekV25Provider = new OpenRouterProvider(
  'deepseek-v2.5',
  'openrouter',
  'deepseek/deepseek-chat',
  'DeepSeek V2.5 (DeepSeek)',
  'cheap',
  { promptPer1M: 0.14, completionPer1M: 0.28 },
  false
);

// ============================================================================
// QWEN Models (3) - Open Weights (Alibaba)
// ============================================================================

// 10. Qwen3 235B (A22B) - Paid ($0.20/1M blended)
export const Qwen3235BProvider = new OpenRouterProvider(
  'qwen3-235b',
  'openrouter',
  'qwen/qwen3-235b-a22b',
  'Qwen3 235B (Alibaba)',
  'cheap',
  { promptPer1M: 0.07, completionPer1M: 0.28 },
  false
);

// 11. Qwen3 Coder - Paid ($0.80/1M blended)
export const Qwen3CoderProvider = new OpenRouterProvider(
  'qwen3-coder',
  'openrouter',
  'qwen/qwen3-coder:free',
  'Qwen3 Coder (Alibaba)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 12. Qwen3 4B - FREE
export const Qwen3_4BProvider = new OpenRouterProvider(
  'qwen3-4b',
  'openrouter',
  'qwen/qwen3-4b:free',
  'Qwen3 4B (Alibaba)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// GOOGLE Models (3) - Open Weights
// ============================================================================

// 13. Gemma 3 27B - FREE
export const Gemma3_27BProvider = new OpenRouterProvider(
  'gemma-3-27b',
  'openrouter',
  'google/gemma-3-27b-it:free',
  'Gemma 3 27B (Google)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 14. Gemma 3 4B - FREE  
export const Gemma3_4BProvider = new OpenRouterProvider(
  'gemma-3-4b',
  'openrouter',
  'google/gemma-3-4b-it:free',
  'Gemma 3 4B (Google)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 15. Gemini 2.0 Flash Lite - FREE
export const Gemini20FlashLiteProvider = new OpenRouterProvider(
  'gemini-2.0-flash-lite',
  'openrouter',
  'google/gemini-2.0-flash-lite-001',
  'Gemini 2.0 Flash Lite (Google)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// NVIDIA Models (3) - Open Weights
// ============================================================================

// 16. Nemotron 3 Nano (30B) - FREE
export const Nemotron3NanoProvider = new OpenRouterProvider(
  'nemotron-3-nano',
  'openrouter',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'Nemotron 3 Nano 30B (NVIDIA)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 17. Nemotron 3 70B - Paid ($0.50/1M blended)
export const Nemotron3_70BProvider = new OpenRouterProvider(
  'nemotron-3-70b',
  'openrouter',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'Nemotron 3 70B (NVIDIA)',
  'cheap',
  { promptPer1M: 0.20, completionPer1M: 0.50 },
  false
);

// 18. Nemotron 4 340B - Paid ($1.20/1M blended)
export const Nemotron4_340BProvider = new OpenRouterProvider(
  'nemotron-4-340b',
  'openrouter',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'Nemotron Ultra 253B (NVIDIA)',
  'mid',
  { promptPer1M: 0.50, completionPer1M: 1.50 },
  false
);

// ============================================================================
// Z.AI GLM Models (2) - Open Weights
// ============================================================================

// 19. GLM-4.5 Air - FREE
export const GLM45AirProvider = new OpenRouterProvider(
  'glm-4.5-air',
  'openrouter',
  'z-ai/glm-4.5-air:free',
  'GLM-4.5 Air (Z.AI)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 20. GLM-4.7 Flash - Paid ($0.20/1M blended)
export const GLM47FlashProvider = new OpenRouterProvider(
  'glm-4.7-flash',
  'openrouter',
  'z-ai/glm-4.7-flash',
  'GLM-4.7 Flash (Z.AI)',
  'cheap',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false
);

// ============================================================================
// MICROSOFT Models (2) - Open Weights
// ============================================================================

// 21. Phi-4 - Paid (no free tier available)
export const Phi4Provider = new OpenRouterProvider(
  'phi-4',
  'openrouter',
  'microsoft/phi-4',
  'Phi-4 (Microsoft)',
  'cheap',
  { promptPer1M: 0.06, completionPer1M: 0.18 },
  false
);

// 22. Qwen3 Next 80B - FREE (replacing Phi-3.5)
export const Qwen3Next80BProvider = new OpenRouterProvider(
  'qwen3-next-80b',
  'openrouter',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'Qwen3 Next 80B (Alibaba)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// XIAOMI Models (2) - Open Weights
// ============================================================================

// 23. MiMo-V2-Flash (309B) - FREE
export const MiMoV2FlashProvider = new OpenRouterProvider(
  'mimo-v2-flash',
  'openrouter',
  'xiaomi/mimo-v2-flash:free',
  'MiMo-V2-Flash 309B (Xiaomi)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 24. Gemma 3n 4B - FREE (replacing MiMo-V2-Small)
export const Gemma3n4BProvider = new OpenRouterProvider(
  'gemma-3n-4b',
  'openrouter',
  'google/gemma-3n-e4b-it:free',
  'Gemma 3n 4B (Google)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// TNG Models (1) - Open Weights
// ============================================================================

// 25. DeepSeek R1T Chimera - FREE
export const DeepSeekR1TChimeraProvider = new OpenRouterProvider(
  'deepseek-r1t-chimera',
  'openrouter',
  'tngtech/deepseek-r1t-chimera:free',
  'DeepSeek R1T Chimera (TNG)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// COHERE Models (2) - Open Weights
// ============================================================================

// 26. Command R7 - Paid ($0.65/1M blended)
export const CohereCommandR7Provider = new OpenRouterProvider(
  'cohere-command-r7',
  'openrouter',
  'cohere/command-r7b-12-2024',
  'Command R7B (Cohere)',
  'cheap',
  { promptPer1M: 0.30, completionPer1M: 1.00 },
  false
);

// 27. Command A - Paid ($1.50/1M blended)
export const CohereCommandAProvider = new OpenRouterProvider(
  'cohere-command-a',
  'openrouter',
  'cohere/command-a',
  'Command A (Cohere)',
  'mid',
  { promptPer1M: 2.50, completionPer1M: 10 },
  false
);

// ============================================================================
// OTHER OPEN Models (3) - Open Weights
// ============================================================================

// 28. Olmo 3.1 32B - Paid ($0.30/1M blended)
export const Olmo31Provider = new OpenRouterProvider(
  'olmo-3.1-32b',
  'openrouter',
  'allenai/olmo-3.1-32b-instruct',
  'OLMo 3.1 32B (AI2)',
  'cheap',
  { promptPer1M: 0.10, completionPer1M: 0.30 },
  false
);

// 29. Hermes 3 Llama 3.1 - Paid ($0.25/1M blended)
export const Hermes3Provider = new OpenRouterProvider(
  'hermes-3-llama',
  'openrouter',
  'nousresearch/hermes-3-llama-3.1-405b',
  'Hermes 3 405B (Nous)',
  'cheap',
  { promptPer1M: 0.10, completionPer1M: 0.40 },
  false
);

// 30. Dolphin Mistral Venice - FREE
export const DolphinMistralVeniceProvider = new OpenRouterProvider(
  'dolphin-mistral-venice',
  'openrouter',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'Dolphin Mistral Venice (CC)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// ============================================================================
// Export all OpenRouter providers (30 open-source models)
// ============================================================================

export const OPENROUTER_PROVIDERS = [
  // Meta (3)
  Llama4MaverickProvider,        // 1  - Paid
  Llama4ScoutProvider,           // 2  - Paid
  Llama33_70BProvider,           // 3  - $0.45/1M
  // Mistral (3)
  Devstral2Provider,             // 4  - FREE
  MistralLarge3Provider,         // 5  - $1.00/1M
  MistralSmall31Provider,        // 6  - FREE
  // DeepSeek (3)
  DeepSeekV32Provider,           // 7  - $0.35/1M
  DeepSeekV31TerminusProvider,   // 8  - $0.60/1M
  DeepSeekV25Provider,           // 9  - $0.20/1M
  // Qwen (3)
  Qwen3235BProvider,             // 10 - $0.20/1M
  Qwen3CoderProvider,            // 11 - FREE
  Qwen3_4BProvider,              // 12 - FREE
  // Google (3)
  Gemma3_27BProvider,            // 13 - FREE
  Gemma3_4BProvider,             // 14 - FREE
  Gemini20FlashLiteProvider,     // 15 - FREE
  // NVIDIA (3)
  Nemotron3NanoProvider,         // 16 - FREE
  Nemotron3_70BProvider,         // 17 - $0.50/1M
  Nemotron4_340BProvider,        // 18 - $1.20/1M
  // Z.AI (2)
  GLM45AirProvider,              // 19 - FREE
  GLM47FlashProvider,            // 20 - $0.20/1M
  // Microsoft + Qwen (2)
  Phi4Provider,                  // 21 - Paid
  Qwen3Next80BProvider,          // 22 - FREE
  // Xiaomi + Google (2)
  MiMoV2FlashProvider,           // 23 - FREE
  Gemma3n4BProvider,             // 24 - FREE
  // TNG (1)
  DeepSeekR1TChimeraProvider,    // 25 - FREE
  // Cohere (2)
  CohereCommandR7Provider,       // 26 - $0.65/1M
  CohereCommandAProvider,        // 27 - $1.50/1M
  // Other Open (3)
  Olmo31Provider,                // 28 - $0.30/1M
  Hermes3Provider,               // 29 - $0.25/1M
  DolphinMistralVeniceProvider,  // 30 - FREE
];

// Summary:
// - 15 FREE models (no cost)
// - 15 Paid models (low cost, mostly under $1/1M tokens)
// - All 30 models are open-source/open-weights
