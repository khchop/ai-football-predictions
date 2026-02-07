/**
 * Diverse Match Scenario Fixtures
 *
 * Provides typed match scenarios covering different prediction contexts
 * for diagnostic testing. Each scenario represents a distinct match type
 * that may challenge models differently (defensive matches, high-scoring,
 * upsets, derbies).
 *
 * Used by the diagnostic runner (Plan 02) to test all models against
 * varied match contexts rather than a single fixture.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DiagnosticScenario {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  description: string;
}

// ============================================================================
// SCENARIOS
// ============================================================================

/**
 * 5 diverse match scenarios covering different prediction contexts.
 * Keyed by scenario ID for easy lookup.
 */
export const DIVERSE_SCENARIOS: Record<string, DiagnosticScenario> = {
  standard: {
    id: 'standard',
    homeTeam: 'Everton',
    awayTeam: 'Crystal Palace',
    competition: 'Premier League',
    description: 'Mid-table clash, no clear favorite',
  },
  'high-scoring': {
    id: 'high-scoring',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Bochum',
    competition: 'Bundesliga',
    description: 'Top team vs struggling defense, expected 4+ goals',
  },
  'low-scoring': {
    id: 'low-scoring',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Getafe',
    competition: 'La Liga',
    description: 'Defensive teams, expected 0-1 goals',
  },
  'upset-potential': {
    id: 'upset-potential',
    homeTeam: 'Luton Town',
    awayTeam: 'Arsenal',
    competition: 'Premier League',
    description: 'Bottom vs top, away win expected',
  },
  derby: {
    id: 'derby',
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    competition: 'Premier League',
    description: 'High-stakes rivalry, draws common',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a test prompt for a given scenario ID.
 * Format matches the existing pattern from test-data.ts with diag- prefix.
 *
 * @param scenarioId - Key from DIVERSE_SCENARIOS
 * @returns Formatted prompt string for LLM prediction
 * @throws Error if scenarioId not found
 */
export function buildTestPrompt(scenarioId: string): string {
  const scenario = DIVERSE_SCENARIOS[scenarioId];
  if (!scenario) {
    throw new Error(
      `Unknown scenario ID: ${scenarioId}. Available: ${getAllScenarioIds().join(', ')}`
    );
  }

  return `Provide a prediction for 1 test match.
Match ID: diag-${scenarioId}
Home Team: ${scenario.homeTeam}
Away Team: ${scenario.awayTeam}
Competition: ${scenario.competition}
Kickoff: 2026-02-10

Respond with JSON array containing match_id, home_score, away_score.`;
}

/**
 * Get all scenario IDs as an array.
 * Useful for parameterized test loops.
 */
export function getAllScenarioIds(): string[] {
  return Object.keys(DIVERSE_SCENARIOS);
}
