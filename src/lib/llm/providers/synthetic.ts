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
