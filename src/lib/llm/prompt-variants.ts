// Prompt variant configurations for model-specific requirements
// Phase 40-01: Model-Specific Prompt Selection

import { ResponseHandler } from './response-handlers';

/**
 * Available prompt variants for handling model-specific output requirements
 */
export enum PromptVariant {
  /** No additional instructions - baseline behavior */
  BASE = 'base',

  /** Force English output for models that default to other languages (GLM) */
  ENGLISH_ENFORCED = 'english-enforced',

  /** Strict JSON-only output for models that add explanations (DeepSeek V3.2) */
  JSON_STRICT = 'json-strict',

  /** Prevent thinking tags in output for reasoning models (Qwen thinking) */
  THINKING_STRIPPED = 'thinking-stripped',

  /** Combined variant: English enforcement + thinking suppression */
  ENGLISH_THINKING_STRIPPED = 'english-thinking-stripped',
}

/**
 * Additional instructions appended to system prompt based on variant
 */
export const PROMPT_VARIANTS: Record<PromptVariant, string> = {
  [PromptVariant.BASE]: '',

  [PromptVariant.ENGLISH_ENFORCED]:
    '\n\nCRITICAL: Respond ONLY in English. Do not output Chinese or any other language.',

  [PromptVariant.JSON_STRICT]:
    '\n\nOUTPUT FORMAT - CRITICAL:\n' +
    '- Return ONLY valid JSON\n' +
    '- No explanations before or after the JSON\n' +
    '- No markdown code blocks\n' +
    '- No natural language\n' +
    '- Just the raw JSON object',

  [PromptVariant.THINKING_STRIPPED]:
    '\n\nOUTPUT FORMAT - CRITICAL:\n' +
    '- Do NOT use <think>, <thinking>, or <reasoning> tags\n' +
    '- Output ONLY the JSON prediction\n' +
    '- No thinking process in the response',

  [PromptVariant.ENGLISH_THINKING_STRIPPED]:
    '\n\nCRITICAL: Respond ONLY in English. Do not output Chinese or any other language.\n\n' +
    'OUTPUT FORMAT - CRITICAL:\n' +
    '- Do NOT use <think>, <thinking>, or <reasoning> tags\n' +
    '- Output ONLY the JSON prediction\n' +
    '- No thinking process in the response',
};

/**
 * Configuration for model-specific prompt and response handling
 */
export interface PromptConfig {
  /** Prompt variant to use (appends additional instructions) */
  promptVariant?: PromptVariant;

  /** Response handler to apply before JSON parsing */
  responseHandler?: ResponseHandler;

  /** Timeout in milliseconds (30000-90000 typical range) */
  timeoutMs?: number;

  /**
   * Whether the model supports `response_format: { type: 'json_object' }`.
   * When false, the parameter is omitted from the API request.
   * Defaults to true for backward compatibility.
   *
   * Set to false for:
   * - Synthetic.new models that return empty/text with json_object (MiniMax, GLM, GPT-OSS 120B)
   * - Models that explicitly error on json_object (GLM 4.7 SGLang bug)
   */
  supportsJsonMode?: boolean;

  /**
   * Max tokens for single-match predictions (default: 150).
   * Increase for reasoning/thinking models that need token budget
   * for internal reasoning before outputting JSON.
   */
  maxTokensSingle?: number;

  /**
   * Max tokens for batch predictions (default: 800).
   * Increase for reasoning models.
   */
  maxTokensBatch?: number;
}

/**
 * Enhances a base system prompt with variant-specific instructions
 *
 * @param basePrompt - The base system prompt
 * @param variant - The prompt variant to apply
 * @returns Enhanced prompt with additional instructions appended
 *
 * @example
 * const prompt = getEnhancedSystemPrompt(SYSTEM_PROMPT, PromptVariant.JSON_STRICT);
 * // Returns: base prompt + JSON-only formatting instructions
 */
export function getEnhancedSystemPrompt(
  basePrompt: string,
  variant: PromptVariant
): string {
  const addition = PROMPT_VARIANTS[variant];
  return basePrompt + addition;
}
