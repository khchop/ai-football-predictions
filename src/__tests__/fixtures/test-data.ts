/**
 * Test Data Fixtures
 *
 * Shared test data and timeout constants for LLM integration tests.
 */

// Test match identifier for validation tests
export const TEST_MATCH_ID = 'test-validation-001';

/**
 * Standard test prompt for single match prediction
 * Based on existing validate-synthetic-models.ts format
 */
export const TEST_PROMPT = `Provide a prediction for 1 test match.
Match ID: ${TEST_MATCH_ID}
Home Team: Manchester United
Away Team: Liverpool
Competition: Premier League
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;

// ============================================================================
// TIMEOUT CONSTANTS
// Model-specific timeouts based on processing characteristics
// ============================================================================

/**
 * Timeout for reasoning models (deepseek-r1, kimi-thinking, qwen3-thinking)
 * These models have extended "thinking" phases and need more time
 */
export const REASONING_MODEL_TIMEOUT = 90000; // 90 seconds

/**
 * Standard timeout for most models
 */
export const STANDARD_MODEL_TIMEOUT = 60000; // 60 seconds

/**
 * Timeout for JSON-strict models
 * These tend to respond faster with structured output
 */
export const JSON_STRICT_TIMEOUT = 45000; // 45 seconds

// ============================================================================
// MODEL CLASSIFICATION
// ============================================================================

/**
 * Model IDs that use extended thinking/reasoning
 * These require REASONING_MODEL_TIMEOUT
 */
export const REASONING_MODEL_IDS = new Set([
  'deepseek-r1-0528-syn',
  'kimi-k2-thinking-syn',
  'qwen3-235b-thinking-syn',
  'deepseek-r1',
]);

/**
 * Get appropriate timeout for a model
 */
export function getModelTimeout(modelId: string): number {
  if (REASONING_MODEL_IDS.has(modelId)) {
    return REASONING_MODEL_TIMEOUT;
  }
  return STANDARD_MODEL_TIMEOUT;
}
