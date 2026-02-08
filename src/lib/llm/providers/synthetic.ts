import { OpenAICompatibleProvider } from './base';
import { ModelPricing, ModelTier } from './together';
import { PromptConfig, PromptVariant } from '../prompt-variants';
import { ResponseHandler } from '../response-handlers';

/**
 * Synthetic.new LLM Provider
 *
 * Uses OpenAI-compatible API at https://api.synthetic.new/openai/v1/chat/completions
 * Authentication via SYNTHETIC_API_KEY environment variable
 * Model IDs use hf:org/model format (e.g., hf:THUDM/GLM-4-9B-0414)
 */
export class SyntheticProvider extends OpenAICompatibleProvider {
  protected endpoint = 'https://api.synthetic.new/openai/v1/chat/completions';

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
    const apiKey = process.env.SYNTHETIC_API_KEY;
    if (!apiKey) {
      throw new Error('Synthetic API key is not configured (SYNTHETIC_API_KEY)');
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Estimate cost for a prediction
   * @param inputTokens - Number of input tokens (default: 500 for enhanced prompt)
   * @param outputTokens - Number of output tokens (default: 50 for JSON response)
   * @returns Estimated cost in USD
   */
  estimateCost(inputTokens: number = 500, outputTokens: number = 50): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.promptPer1M;
    const outputCost = (outputTokens / 1_000_000) * this.pricing.completionPer1M;
    return inputCost + outputCost;
  }

  /**
   * Estimate cost for batch prediction
   * @param matchCount - Number of matches in the batch
   * @param hasAnalysis - Whether the prompt includes match analysis (default: true)
   * @returns Estimated cost in USD
   */
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
// 10 SYNTHETIC-EXCLUSIVE MODELS
// Models available on Synthetic.new but not on Together AI
// Updated: February 2026 (Phase 63 - CONS-03)
// Pricing: Placeholder estimates based on model size (pricing TBD)
// Model IDs use hf:org/model format
// Note: 3 models consolidated (deepseek-r1-0528, kimi-k2-thinking, kimi-k2.5) - see Phase 62
// ============================================================================

// ============================================================================
// REASONING MODELS (1) - Premium Tier
// Advanced thinking/reasoning capabilities
// ============================================================================

// 1. Qwen3 235B Thinking
export const Qwen3_235BThinking_SynProvider = new SyntheticProvider(
  'qwen3-235b-thinking',
  'synthetic',
  'hf:Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen3 235B Thinking',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 6.00 },
  true,
  {
    promptVariant: PromptVariant.THINKING_STRIPPED,
    responseHandler: ResponseHandler.STRIP_THINKING_TAGS,
    timeoutMs: 120000, // 2 min - large 235B thinking model warrants same buffer as DeepSeek R1
  }
);

// ============================================================================
// DEEPSEEK FAMILY (3) - Budget Tier
// DeepSeek V3 variants exclusive to Synthetic
// ============================================================================

// 2. DeepSeek V3 0324
export const DeepSeekV3_0324_SynProvider = new SyntheticProvider(
  'deepseek-v3-0324',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3-0324',
  'DeepSeek V3 0324',
  'budget',
  { promptPer1M: 0.60, completionPer1M: 1.25 },
  false
);

// 3. DeepSeek V3.1 Terminus
export const DeepSeekV31_Terminus_SynProvider = new SyntheticProvider(
  'deepseek-v3.1-terminus',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3.1-Terminus',
  'DeepSeek V3.1 Terminus',
  'budget',
  { promptPer1M: 0.70, completionPer1M: 1.40 },
  false
);

// 4. DeepSeek V3.2
export const DeepSeekV32_SynProvider = new SyntheticProvider(
  'deepseek-v3.2',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3.2',
  'DeepSeek V3.2',
  'budget',
  { promptPer1M: 0.65, completionPer1M: 1.30 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 45000,
  }
);

// ============================================================================
// MINIMAX (2) - Budget Tier
// MiniMax AI models
// ============================================================================

// 5. MiniMax M2
export const MiniMaxM2_SynProvider = new SyntheticProvider(
  'minimax-m2',
  'synthetic',
  'hf:MiniMaxAI/MiniMax-M2',
  'MiniMax M2',
  'budget',
  { promptPer1M: 0.50, completionPer1M: 1.00 },
  false
);

// 6. MiniMax M2.1
export const MiniMaxM21_SynProvider = new SyntheticProvider(
  'minimax-m2.1',
  'synthetic',
  'hf:MiniMaxAI/MiniMax-M2.1',
  'MiniMax M2.1',
  'budget',
  { promptPer1M: 0.55, completionPer1M: 1.10 },
  false
);

// ============================================================================
// GLM (2) - Budget Tier
// ZAI GLM models (may output Chinese text)
// ============================================================================

// 7. GLM 4.6
export const GLM46_SynProvider = new SyntheticProvider(
  'glm-4.6',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.DEFAULT,
    timeoutMs: 60000,
  }
);

// 8. GLM 4.7
export const GLM47_SynProvider = new SyntheticProvider(
  'glm-4.7',
  'synthetic',
  'hf:zai-org/GLM-4.7',
  'GLM 4.7',
  'budget',
  { promptPer1M: 0.45, completionPer1M: 0.90 },
  false,
  {
    promptVariant: PromptVariant.ENGLISH_ENFORCED,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 60000,
  }
);

// ============================================================================
// QWEN CODER (1) - Premium Tier
// Large coding-focused model
// ============================================================================

// 9. Qwen3 Coder 480B
export const Qwen3Coder480B_SynProvider = new SyntheticProvider(
  'qwen3-coder-480b',
  'synthetic',
  'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'Qwen3 Coder 480B',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 6.00 },
  true
);

// ============================================================================
// OPENAI OSS (1) - Budget Tier
// OpenAI open-source model
// ============================================================================

// 10. GPT-OSS 120B
export const GPTOSS120B_SynProvider = new SyntheticProvider(
  'gpt-oss-120b',
  'synthetic',
  'hf:openai/gpt-oss-120b',
  'GPT-OSS 120B',
  'budget',
  { promptPer1M: 1.20, completionPer1M: 2.40 },
  false,
  {
    promptVariant: PromptVariant.JSON_STRICT,
    responseHandler: ResponseHandler.EXTRACT_JSON,
    timeoutMs: 45000,
  }
);

// ============================================================================
// Export all Synthetic providers (10 models with model-specific configurations)
// ============================================================================

export const SYNTHETIC_PROVIDERS = [
  // Reasoning models (1) - Premium
  Qwen3_235BThinking_SynProvider,     // 1  - $2.50/$6.00 (premium, reasoning)

  // DeepSeek family (3) - Budget
  DeepSeekV3_0324_SynProvider,        // 2  - $0.60/$1.25
  DeepSeekV31_Terminus_SynProvider,   // 3  - $0.70/$1.40
  DeepSeekV32_SynProvider,            // 4  - $0.65/$1.30

  // MiniMax (2) - Budget
  MiniMaxM2_SynProvider,              // 5  - $0.50/$1.00
  MiniMaxM21_SynProvider,             // 6  - $0.55/$1.10

  // GLM (2) - Budget
  GLM46_SynProvider,                  // 7  - $0.40/$0.80
  GLM47_SynProvider,                  // 8  - $0.45/$0.90

  // Qwen Coder (1) - Premium
  Qwen3Coder480B_SynProvider,         // 9  - $3.00/$6.00 (premium)

  // OpenAI OSS (1) - Budget
  GPTOSS120B_SynProvider,             // 10 - $1.20/$2.40
];

// ============================================================================
// Summary (February 2026 - Phase 63):
// - 10 Synthetic-exclusive models (not available on Together AI)
// - 3 models consolidated in Phase 62 (deepseek-r1-0528, kimi-k2-thinking, kimi-k2.5)
// - 10 models ACTIVE with model-specific prompt variants and response handlers
// - 0 models DISABLED (all re-enabled with appropriate configurations)
// - Prompt variants: THINKING_STRIPPED (reasoning), ENGLISH_ENFORCED (GLM), JSON_STRICT (DeepSeek V3.2, GPT-OSS)
// - Response handlers: STRIP_THINKING_TAGS, EXTRACT_JSON, DEFAULT
// - Timeout configurations: 45s-120s based on model characteristics
// - All use hf:org/model format for Synthetic.new API
// - Pricing: Placeholder estimates (actual pricing TBD)
// ============================================================================
