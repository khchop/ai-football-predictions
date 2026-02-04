import { OpenAICompatibleProvider } from './base';
import { ModelPricing, ModelTier } from './together';

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
// 13 SYNTHETIC-EXCLUSIVE MODELS
// Models available on Synthetic.new but not on Together AI
// Updated: February 2026
// Pricing: Placeholder estimates based on model size (pricing TBD)
// Model IDs use hf:org/model format
// ============================================================================

// ============================================================================
// REASONING MODELS (3) - Premium Tier
// Advanced thinking/reasoning capabilities
// ============================================================================

// 1. DeepSeek R1 0528
export const DeepSeekR1_0528_SynProvider = new SyntheticProvider(
  'deepseek-r1-0528-syn',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-R1-0528',
  'DeepSeek R1 0528 (Synthetic)',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 7.00 },
  true
);

// 2. Kimi K2 Thinking
export const KimiK2Thinking_SynProvider = new SyntheticProvider(
  'kimi-k2-thinking-syn',
  'synthetic',
  'hf:moonshotai/Kimi-K2-Thinking',
  'Kimi K2 Thinking (Synthetic)',
  'premium',
  { promptPer1M: 2.00, completionPer1M: 6.00 },
  true
);

// 3. Qwen3 235B Thinking
export const Qwen3_235BThinking_SynProvider = new SyntheticProvider(
  'qwen3-235b-thinking-syn',
  'synthetic',
  'hf:Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen3 235B Thinking (Synthetic)',
  'premium',
  { promptPer1M: 2.50, completionPer1M: 6.00 },
  true
);

// ============================================================================
// DEEPSEEK FAMILY (3) - Budget Tier
// DeepSeek V3 variants exclusive to Synthetic
// ============================================================================

// 4. DeepSeek V3 0324
export const DeepSeekV3_0324_SynProvider = new SyntheticProvider(
  'deepseek-v3-0324-syn',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3-0324',
  'DeepSeek V3 0324 (Synthetic)',
  'budget',
  { promptPer1M: 0.60, completionPer1M: 1.25 },
  false
);

// 5. DeepSeek V3.1 Terminus
export const DeepSeekV31_Terminus_SynProvider = new SyntheticProvider(
  'deepseek-v3.1-terminus-syn',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3.1-Terminus',
  'DeepSeek V3.1 Terminus (Synthetic)',
  'budget',
  { promptPer1M: 0.70, completionPer1M: 1.40 },
  false
);

// 6. DeepSeek V3.2
export const DeepSeekV32_SynProvider = new SyntheticProvider(
  'deepseek-v3.2-syn',
  'synthetic',
  'hf:deepseek-ai/DeepSeek-V3.2',
  'DeepSeek V3.2 (Synthetic)',
  'budget',
  { promptPer1M: 0.65, completionPer1M: 1.30 },
  false
);

// ============================================================================
// MINIMAX (2) - Budget Tier
// MiniMax AI models
// ============================================================================

// 7. MiniMax M2
export const MiniMaxM2_SynProvider = new SyntheticProvider(
  'minimax-m2-syn',
  'synthetic',
  'hf:MiniMaxAI/MiniMax-M2',
  'MiniMax M2 (Synthetic)',
  'budget',
  { promptPer1M: 0.50, completionPer1M: 1.00 },
  false
);

// 8. MiniMax M2.1
export const MiniMaxM21_SynProvider = new SyntheticProvider(
  'minimax-m2.1-syn',
  'synthetic',
  'hf:MiniMaxAI/MiniMax-M2.1',
  'MiniMax M2.1 (Synthetic)',
  'budget',
  { promptPer1M: 0.55, completionPer1M: 1.10 },
  false
);

// ============================================================================
// MOONSHOT (1) - Budget Tier
// Kimi K2.5 (non-thinking version)
// ============================================================================

// 9. Kimi K2.5
export const KimiK25_SynProvider = new SyntheticProvider(
  'kimi-k2.5-syn',
  'synthetic',
  'hf:moonshotai/Kimi-K2.5',
  'Kimi K2.5 (Synthetic)',
  'budget',
  { promptPer1M: 1.00, completionPer1M: 3.00 },
  false
);

// ============================================================================
// GLM (2) - Budget Tier
// ZAI GLM models (may output Chinese text)
// ============================================================================

// 10. GLM 4.6
export const GLM46_SynProvider = new SyntheticProvider(
  'glm-4.6-syn',
  'synthetic',
  'hf:zai-org/GLM-4.6',
  'GLM 4.6 (Synthetic)',
  'budget',
  { promptPer1M: 0.40, completionPer1M: 0.80 },
  false
);

// 11. GLM 4.7
export const GLM47_SynProvider = new SyntheticProvider(
  'glm-4.7-syn',
  'synthetic',
  'hf:zai-org/GLM-4.7',
  'GLM 4.7 (Synthetic)',
  'budget',
  { promptPer1M: 0.45, completionPer1M: 0.90 },
  false
);

// ============================================================================
// QWEN CODER (1) - Premium Tier
// Large coding-focused model
// ============================================================================

// 12. Qwen3 Coder 480B
export const Qwen3Coder480B_SynProvider = new SyntheticProvider(
  'qwen3-coder-480b-syn',
  'synthetic',
  'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'Qwen3 Coder 480B (Synthetic)',
  'premium',
  { promptPer1M: 3.00, completionPer1M: 6.00 },
  true
);

// ============================================================================
// OPENAI OSS (1) - Budget Tier
// OpenAI open-source model
// ============================================================================

// 13. GPT-OSS 120B
export const GPTOSS120B_SynProvider = new SyntheticProvider(
  'gpt-oss-120b-syn',
  'synthetic',
  'hf:openai/gpt-oss-120b',
  'GPT-OSS 120B (Synthetic)',
  'budget',
  { promptPer1M: 1.20, completionPer1M: 2.40 },
  false
);

// ============================================================================
// Export all Synthetic providers (13 exclusive models)
// ============================================================================

export const SYNTHETIC_PROVIDERS = [
  // Reasoning models (3) - Premium
  DeepSeekR1_0528_SynProvider,        // 1  - $3.00/$7.00 (premium, reasoning)
  KimiK2Thinking_SynProvider,         // 2  - $2.00/$6.00 (premium, reasoning)
  Qwen3_235BThinking_SynProvider,     // 3  - $2.50/$6.00 (premium, reasoning)

  // DeepSeek family (3) - Budget
  DeepSeekV3_0324_SynProvider,        // 4  - $0.60/$1.25
  DeepSeekV31_Terminus_SynProvider,   // 5  - $0.70/$1.40
  DeepSeekV32_SynProvider,            // 6  - $0.65/$1.30

  // MiniMax (2) - Budget
  MiniMaxM2_SynProvider,              // 7  - $0.50/$1.00
  MiniMaxM21_SynProvider,             // 8  - $0.55/$1.10

  // Moonshot (1) - Budget
  KimiK25_SynProvider,                // 9  - $1.00/$3.00

  // GLM (2) - Budget (may output Chinese)
  GLM46_SynProvider,                  // 10 - $0.40/$0.80
  GLM47_SynProvider,                  // 11 - $0.45/$0.90

  // Qwen Coder (1) - Premium
  Qwen3Coder480B_SynProvider,         // 12 - $3.00/$6.00 (premium)

  // OpenAI OSS (1) - Budget
  GPTOSS120B_SynProvider,             // 13 - $1.20/$2.40
];

// ============================================================================
// Summary (February 2026):
// - 13 Synthetic-exclusive models (not available on Together AI)
// - 4 premium models: 3 reasoning + 1 large coder
// - 9 budget models: DeepSeek variants, MiniMax, GLM, OpenAI OSS
// - All use hf:org/model format for Synthetic.new API
// - Pricing: Placeholder estimates (actual pricing TBD)
// - Note: GLM models may output Chinese text
// ============================================================================
