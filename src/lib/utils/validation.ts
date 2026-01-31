/**
 * Score validation utilities for LLM predictions
 * Ensures scores are within valid range (0-20) and properly formatted
 */

/**
 * Validate single score value (0-20, not negative, not null/undefined)
 * Uses type predicate for TypeScript narrowing
 */
export function isValidScore(score: unknown): score is number {
  return (
    typeof score === 'number' &&
    !isNaN(score) &&
    score >= 0 &&
    score <= 20 &&
    Number.isInteger(score)
  );
}

/**
 * Validate score pair (both home and away are valid)
 * Supports multiple field name patterns (snake_case, camelCase)
 */
export function isValidScorePair(
  scores: { home_score?: unknown; away_score?: unknown; homeScore?: unknown; awayScore?: unknown }
): scores is { home_score: number; away_score: number } | { homeScore: number; awayScore: number } {
  const homeScore = scores.home_score ?? scores.homeScore;
  const awayScore = scores.away_score ?? scores.awayScore;
  return isValidScore(homeScore) && isValidScore(awayScore);
}

/**
 * Validated prediction interface
 */
export interface ValidatedPrediction {
  homeScore: number;
  awayScore: number;
}

/**
 * Validate prediction object structure
 * Tries multiple field name patterns (home_score, homeScore, home)
 */
export function validatePrediction(input: unknown): ValidatedPrediction | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const scores = input as Record<string, unknown>;

  // Try multiple field name patterns
  const homeScore = scores.home_score ?? scores.homeScore ?? scores.home;
  const awayScore = scores.away_score ?? scores.awayScore ?? scores.away;

  if (!isValidScore(homeScore) || !isValidScore(awayScore)) {
    return null;
  }

  return {
    homeScore: homeScore as number,
    awayScore: awayScore as number,
  };
}
