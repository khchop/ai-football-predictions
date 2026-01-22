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
// All open-source models with free inference on OpenRouter.
// Note: Some hybrid models (MiMo, Nemotron) default to Instruct mode.
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

// 2. Gemini 2.0 Flash Experimental - Google (Free)
export const Gemini20FlashExpProvider = new OpenRouterProvider(
  'gemini-2.0-flash-exp-free',
  'openrouter',
  'google/gemini-2.0-flash-exp:free',
  'Gemini 2.0 Flash Exp (Google)',
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

// 4. Devstral 2512 - Mistral (Free)
export const Devstral2512Provider = new OpenRouterProvider(
  'devstral-2512-free',
  'openrouter',
  'mistralai/devstral-2512:free',
  'Devstral 2512 (Mistral)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// 5. Qwen3 4B - Alibaba (Free)
export const Qwen3_4BFreeProvider = new OpenRouterProvider(
  'qwen3-4b-free',
  'openrouter',
  'qwen/qwen3-4b:free',
  'Qwen3 4B (Alibaba)',
  'free',
  { promptPer1M: 0, completionPer1M: 0 },
  false
);

// Note: Removed 3 models that consistently fail with 404 errors:
// - llama-3.1-405b-free (ModelRun gateway not configured)
// - gpt-oss-20b-free (Data policy error)
// - kimi-k2-free (Data policy error)

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
  { promptPer1M: 0.02, completionPer1M: 0.07 },
  false
);

// 13. Mistral 7B - Mistral
export const Mistral7BProvider = new OpenRouterProvider(
  'mistral-7b',
  'openrouter',
  'mistralai/mistral-7b-instruct',
  'Mistral 7B (Mistral)',
  'ultra-budget',
  { promptPer1M: 0.20, completionPer1M: 0.20 },
  false
);

// 14. Qwen 2.5 7B - Alibaba
export const Qwen25_7BProvider = new OpenRouterProvider(
  'qwen-2.5-7b',
  'openrouter',
  'qwen/qwen-2.5-7b-instruct',
  'Qwen 2.5 7B (Alibaba)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.10 },
  false
);

// 15. Qwen 2.5 Coder 32B - Alibaba
export const Qwen25Coder32BProvider = new OpenRouterProvider(
  'qwen-2.5-coder-32b',
  'openrouter',
  'qwen/qwen-2.5-coder-32b-instruct',
  'Qwen 2.5 Coder 32B (Alibaba)',
  'ultra-budget',
  { promptPer1M: 0.03, completionPer1M: 0.11 },
  false
);

// 16. Gemini 2.5 Flash Lite - Google
export const Gemini25FlashLiteProvider = new OpenRouterProvider(
  'gemini-2.5-flash-lite',
  'openrouter',
  'google/gemini-2.5-flash-lite',
  'Gemini 2.5 Flash Lite (Google)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.40 },
  false
);

// 17. Command R 7B - Cohere (optimized for RAG and tool use)
export const CommandR7BProvider = new OpenRouterProvider(
  'command-r-7b',
  'openrouter',
  'cohere/command-r7b-12-2024',
  'Command R 7B (Cohere)',
  'ultra-budget',
  { promptPer1M: 0.04, completionPer1M: 0.15 },
  false
);

// 18. GPT-4.1 Nano - OpenAI
export const GPT41NanoProvider = new OpenRouterProvider(
  'gpt-4.1-nano',
  'openrouter',
  'openai/gpt-4.1-nano',
  'GPT-4.1 Nano (OpenAI)',
  'ultra-budget',
  { promptPer1M: 0.10, completionPer1M: 0.40 },
  false
);

// ============================================================================
// TIER 3: VALUE WORKHORSES (7)
// The sweet spot between cost and performance.
// Note: DeepSeek V3.x are hybrid but default to Instruct mode.
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

// 21. DeepSeek V3.2 - DeepSeek (Hybrid, defaults to Instruct)
export const DeepSeekV32Provider = new OpenRouterProvider(
  'deepseek-v3.2',
  'openrouter',
  'deepseek/deepseek-v3.2',
  'DeepSeek V3.2 (DeepSeek)',
  'budget',
  { promptPer1M: 0.25, completionPer1M: 0.38 },
  false
);

// 22. DeepSeek V3.1 - DeepSeek (Hybrid, defaults to Instruct)
export const DeepSeekV31Provider = new OpenRouterProvider(
  'deepseek-v3.1',
  'openrouter',
  'deepseek/deepseek-chat-v3.1',
  'DeepSeek V3.1 (DeepSeek)',
  'budget',
  { promptPer1M: 0.15, completionPer1M: 0.75 },
  false
);

// 23. Mistral Saba - Mistral (24B, multilingual optimized)
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

// 25. OLMo 3 7B - AllenAI (Open source)
export const OLMo3_7BProvider = new OpenRouterProvider(
  'olmo-3-7b',
  'openrouter',
  'allenai/olmo-3-7b-instruct',
  'OLMo 3 7B (AllenAI)',
  'budget',
  { promptPer1M: 0.10, completionPer1M: 0.20 },
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
  { promptPer1M: 3.50, completionPer1M: 3.50 },
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

// 29. Claude Haiku 4.5 - Anthropic
export const ClaudeHaiku45Provider = new OpenRouterProvider(
  'claude-haiku-4.5',
  'openrouter',
  'anthropic/claude-haiku-4.5',
  'Claude Haiku 4.5 (Anthropic)',
  'premium',
  { promptPer1M: 1.00, completionPer1M: 5.00 },
  true
);

// 30. Grok 4.1 Fast - xAI
export const Grok41FastProvider = new OpenRouterProvider(
  'grok-4.1-fast',
  'openrouter',
  'x-ai/grok-4.1-fast',
  'Grok 4.1 Fast (xAI)',
  'premium',
  { promptPer1M: 0.20, completionPer1M: 0.50 },
  true
);

// 31. Llama 4 Maverick - Meta
export const Llama4MaverickProvider = new OpenRouterProvider(
  'llama-4-maverick',
  'openrouter',
  'meta-llama/llama-4-maverick',
  'Llama 4 Maverick (Meta)',
  'premium',
  { promptPer1M: 0.15, completionPer1M: 0.60 },
  true
);

// 32. Gemini 3 Flash Preview - Google
export const Gemini3FlashPreviewProvider = new OpenRouterProvider(
  'gemini-3-flash-preview',
  'openrouter',
  'google/gemini-3-flash-preview',
  'Gemini 3 Flash Preview (Google)',
  'premium',
  { promptPer1M: 0.50, completionPer1M: 3.00 },
  true
);



// ============================================================================
// Export all OpenRouter providers (30 open-source models)
// ============================================================================

export const OPENROUTER_PROVIDERS = [
  // TIER 1: FREE (5) - Removed 3 models with persistent 404 errors
  Llama33_70B_FreeProvider,      // 1  - FREE - Meta
  Gemini20FlashExpProvider,      // 2  - FREE - Google
  Gemma3_27BProvider,            // 3  - FREE - Google
  Devstral2512Provider,          // 4  - FREE - Mistral
  Qwen3_4BFreeProvider,          // 5  - FREE - Alibaba (may have temp rate limits)
  
  // TIER 2: ULTRA-BUDGET (8)
  Llama32_3BProvider,            // 6  - $0.02/$0.02 - Meta
  Gemma3_4BProvider,             // 7  - $0.02/$0.07 - Google
  Mistral7BProvider,             // 8  - $0.20/$0.20 - Mistral
  Qwen25_7BProvider,             // 9  - $0.04/$0.10 - Alibaba
  Qwen25Coder32BProvider,        // 10 - $0.03/$0.11 - Alibaba
  CommandR7BProvider,            // 11 - $0.04/$0.15 - Cohere
  Gemini25FlashLiteProvider,     // 12 - $0.10/$0.40 - Google
  GPT41NanoProvider,             // 13 - $0.10/$0.40 - OpenAI
  
  // TIER 3: BUDGET (7)
  Llama33_70BProvider,           // 14 - $0.10/$0.32 - Meta
  Llama4ScoutProvider,           // 15 - $0.08/$0.30 - Meta
  DeepSeekV32Provider,           // 16 - $0.25/$0.38 - DeepSeek
  DeepSeekV31Provider,           // 17 - $0.15/$0.75 - DeepSeek
  MistralSabaProvider,           // 18 - $0.20/$0.60 - Mistral
  CommandRProvider,              // 19 - $0.15/$0.60 - Cohere
  OLMo3_7BProvider,              // 20 - $0.10/$0.20 - AllenAI
  
  // TIER 4: PREMIUM (7)
  Llama31_405BProvider,          // 21 - $3.50/$3.50 - Meta (paid version)
  MistralLarge2Provider,         // 22 - $2.00/$6.00 - Mistral
  CommandRPlusProvider,          // 23 - $2.50/$10.00 - Cohere
  ClaudeHaiku45Provider,         // 24 - $1.00/$5.00 - Anthropic
  Grok41FastProvider,            // 25 - $0.20/$0.50 - xAI
  Llama4MaverickProvider,        // 26 - $0.15/$0.60 - Meta
  Gemini3FlashPreviewProvider,   // 27 - $0.50/$3.00 - Google
];

// ============================================================================
// Summary (Updated January 2025):
// - 5 FREE models (no cost) from 4 providers
// - 8 ULTRA-BUDGET models ($0.02-$0.40 per 1M tokens)
// - 7 BUDGET models ($0.08-$0.75 per 1M tokens)
// - 7 PREMIUM models ($0.15-$5.00 per 1M tokens)
// - Total: 27 models (down from 30, removed 3 with persistent 404 errors)
// - Mix of open-source and proprietary models (Google, Anthropic, xAI)
// - Provider diversity: 9 different providers, max 6 from any single provider (Meta)
// - All non-reasoning models (no o1, o3, r1, thinking models)
// - Model IDs verified against OpenRouter API as of January 22, 2026
// 
// Removed models (persistent failures):
// - llama-3.1-405b-free (404 ModelRun gateway error)
// - gpt-oss-20b-free (404 data policy error)
// - kimi-k2-free (404 data policy error)
// 
// Estimated monthly cost at 25 matches/day: ~$5.40/month
// 
// Hybrid Model Notes (default to Instruct mode, don't send reasoning flags):
// - deepseek/deepseek-v3.2, deepseek/deepseek-chat-v3.1
// ============================================================================
