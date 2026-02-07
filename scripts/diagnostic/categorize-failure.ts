/**
 * Failure Categorization Module
 *
 * Classifies LLM failures into 6 categories with actionable fix recommendations.
 * Used by the diagnostic runner to systematically analyze why models fail
 * and suggest targeted fixes.
 *
 * Category priority order (checked top to bottom):
 * 1. TIMEOUT - Model took too long to respond
 * 2. API_ERROR - Rate limits, server errors, network issues
 * 3. EMPTY_RESPONSE - No content returned
 * 4. LANGUAGE - Non-English response (e.g., Chinese characters)
 * 5. THINKING_TAG - Unstripped thinking/reasoning tags in output
 * 6. PARSE - Default: response exists but can't be parsed as valid JSON
 */

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum FailureCategory {
  TIMEOUT = 'timeout',
  PARSE = 'parse',
  LANGUAGE = 'language',
  THINKING_TAG = 'thinking-tag',
  API_ERROR = 'api-error',
  EMPTY_RESPONSE = 'empty-response',
}

export interface CategorizedFailure {
  modelId: string;
  category: FailureCategory;
  error: string;
  rawResponse?: string;
  fix: string;
}

export interface DiagnosticResult {
  modelId: string;
  provider: 'together' | 'synthetic';
  success: boolean;
  prediction?: { homeScore: number; awayScore: number };
  error?: string;
  rawResponse: string;
  category?: FailureCategory;
  durationMs: number;
  timestamp: string;
  scenarioId: string;
}

// ============================================================================
// FIX RECOMMENDATIONS
// ============================================================================

/**
 * Actionable fix recommendations for each failure category.
 * These map directly to code changes in the prediction pipeline.
 */
export const FIX_RECOMMENDATIONS: Record<FailureCategory, string> = {
  [FailureCategory.TIMEOUT]:
    'Add model to REASONING_MODEL_IDS set for 90s timeout, or increase LLM_BATCH_TIMEOUT_MS',
  [FailureCategory.PARSE]:
    'Inspect raw response, adjust JSON extraction regex in parsePredictionResponse()',
  [FailureCategory.LANGUAGE]:
    'Add English-only instruction to prompt variant or switch to different model',
  [FailureCategory.THINKING_TAG]:
    'Set responseHandler: ResponseHandler.STRIP_THINKING_TAGS in model PromptConfig',
  [FailureCategory.API_ERROR]:
    'Check API service status, reduce concurrency, or implement circuit breaker',
  [FailureCategory.EMPTY_RESPONSE]:
    'Verify API response extraction in callAPI() method (content/reasoning/reasoning_details)',
};

// ============================================================================
// CATEGORIZATION LOGIC
// ============================================================================

/** Regex for detecting Chinese characters (CJK Unified Ideographs) */
const CHINESE_CHAR_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;

/** Regex for detecting unstripped thinking/reasoning tags */
const THINKING_TAG_REGEX = /<think>|<thinking>|<reasoning>/i;

/** Max length for rawResponse in CategorizedFailure output */
const MAX_RAW_RESPONSE_LENGTH = 300;

/**
 * Categorize a failure into one of 6 categories with a fix recommendation.
 *
 * IMPORTANT: Check order matters to avoid misclassification.
 * A timeout error that also has Chinese in partial response should be TIMEOUT, not LANGUAGE.
 * An API error with empty response should be API_ERROR, not EMPTY_RESPONSE.
 *
 * @param modelId - The model that failed
 * @param error - Error message string
 * @param rawResponse - Raw response text from the model (may be empty)
 * @returns CategorizedFailure with category, fix recommendation, and truncated raw response
 */
export function categorizeFailure(
  modelId: string,
  error: string,
  rawResponse: string
): CategorizedFailure {
  const errorLower = (error || '').toLowerCase();
  const trimmedResponse = (rawResponse || '').trim();

  let category: FailureCategory;

  // 1. Timeout: error message indicates timeout
  if (errorLower.includes('timeout') || errorLower.includes('timeout after')) {
    category = FailureCategory.TIMEOUT;
  }
  // 2. API error: rate limits, server errors, network issues
  else if (
    errorLower.includes('429') ||
    errorLower.includes('rate limit') ||
    errorLower.includes('5xx') ||
    errorLower.includes('api error') ||
    errorLower.includes('network') ||
    errorLower.includes('500') ||
    errorLower.includes('502') ||
    errorLower.includes('503')
  ) {
    category = FailureCategory.API_ERROR;
  }
  // 3. Empty response: no content returned
  else if (!rawResponse || trimmedResponse.length === 0) {
    category = FailureCategory.EMPTY_RESPONSE;
  }
  // 4. Language: non-English response (Chinese characters detected)
  else if (CHINESE_CHAR_REGEX.test(rawResponse)) {
    category = FailureCategory.LANGUAGE;
  }
  // 5. Thinking tags: unstripped <think>/<thinking>/<reasoning> tags
  else if (THINKING_TAG_REGEX.test(rawResponse)) {
    category = FailureCategory.THINKING_TAG;
  }
  // 6. Default: parse failure
  else {
    category = FailureCategory.PARSE;
  }

  return {
    modelId,
    category,
    error: error || '',
    rawResponse: rawResponse ? rawResponse.slice(0, MAX_RAW_RESPONSE_LENGTH) : undefined,
    fix: FIX_RECOMMENDATIONS[category],
  };
}
