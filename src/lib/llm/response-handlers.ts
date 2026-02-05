// Response handler functions for cleaning LLM outputs before JSON parsing
// Phase 40-01: Model-Specific Prompt Selection

/**
 * Available response handlers for cleaning model-specific output issues
 *
 * IMPORTANT: Handlers are applied BEFORE JSON parsing in the pipeline.
 * Order matters: strip thinking tags BEFORE extracting JSON.
 */
export enum ResponseHandler {
  /** Pass-through - no processing applied */
  DEFAULT = 'default',

  /** Extract JSON from markdown blocks and explanatory text */
  EXTRACT_JSON = 'extract-json',

  /** Remove <think>, <thinking>, <reasoning> tags before parsing */
  STRIP_THINKING_TAGS = 'strip-thinking-tags',
}

/**
 * Function signature for response handlers
 *
 * @param response - Raw LLM response text
 * @returns Cleaned response text ready for JSON parsing
 */
export type ResponseHandlerFn = (response: string) => string;

/**
 * DEFAULT handler: Pass-through with no modifications
 *
 * Use when: Model reliably returns clean JSON without wrapper tags or explanations
 */
const defaultHandler: ResponseHandlerFn = (response: string): string => {
  return response;
};

/**
 * EXTRACT_JSON handler: Remove markdown and extract JSON object/array
 *
 * Use when: Model wraps JSON in markdown code blocks or adds explanatory text
 * Examples: DeepSeek V3.2 adding "Here's my prediction:" before JSON
 *
 * Processing:
 * 1. Remove markdown code blocks (```json ... ```)
 * 2. Try to extract first JSON object {...}
 * 3. Fall back to first JSON array [...]
 * 4. Prefer object (single prediction format) over array
 */
const extractJsonHandler: ResponseHandlerFn = (response: string): string => {
  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try to extract JSON object first (prefer single prediction)
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return objMatch[0];
  }

  // Fall back to JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    return arrMatch[0];
  }

  // No JSON found, return cleaned input
  return cleaned;
};

/**
 * STRIP_THINKING_TAGS handler: Remove reasoning process tags
 *
 * Use when: Thinking/reasoning models wrap output in <think>, <thinking>, or <reasoning> tags
 * Examples: DeepSeek R1, Qwen3-235B-Thinking
 *
 * CRITICAL: This must run BEFORE JSON extraction in the pipeline.
 * Thinking tags often contain invalid JSON fragments that would break extraction.
 *
 * Processing:
 * 1. Remove <think>...</think> tags and contents
 * 2. Remove <thinking>...</thinking> tags and contents
 * 3. Remove <reasoning>...</reasoning> tags and contents
 * 4. Trim whitespace
 */
const stripThinkingTagsHandler: ResponseHandlerFn = (
  response: string
): string => {
  return response
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
};

/**
 * Registry of all response handlers
 *
 * Models reference handlers by enum name in their PromptConfig.
 * Handler selection is type-safe at compile time.
 */
export const RESPONSE_HANDLERS: Record<ResponseHandler, ResponseHandlerFn> = {
  [ResponseHandler.DEFAULT]: defaultHandler,
  [ResponseHandler.EXTRACT_JSON]: extractJsonHandler,
  [ResponseHandler.STRIP_THINKING_TAGS]: stripThinkingTagsHandler,
};

/**
 * Apply a response handler to clean LLM output
 *
 * @param response - Raw LLM response text
 * @param handler - Handler to apply (defaults to DEFAULT)
 * @returns Cleaned response ready for JSON parsing
 *
 * @example
 * // Strip thinking tags before parsing
 * const cleaned = applyResponseHandler(
 *   '<think>analyzing...</think>{"home_score": 2, "away_score": 1}',
 *   ResponseHandler.STRIP_THINKING_TAGS
 * );
 * // Returns: '{"home_score": 2, "away_score": 1}'
 */
export function applyResponseHandler(
  response: string,
  handler: ResponseHandler = ResponseHandler.DEFAULT
): string {
  const handlerFn = RESPONSE_HANDLERS[handler];
  return handlerFn(response);
}
