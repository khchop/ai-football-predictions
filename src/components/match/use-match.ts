import { useContext } from 'react';
import { MatchContext, type MatchContextValue } from './match-data-provider';

/**
 * useMatch - Type-safe hook for accessing match data from MatchDataProvider.
 *
 * Features:
 * - Throws descriptive error if used outside MatchDataProvider
 * - Returns non-null MatchContextValue (guaranteed by throw)
 * - Single point of Context consumption for match data
 *
 * @returns MatchContextValue with match, competition, analysis, and matchState
 * @throws Error if component is not wrapped in MatchDataProvider
 *
 * @example
 * ```tsx
 * function MatchHeader() {
 *   const { match, competition, matchState } = useMatch();
 *   return <h1>{match.homeTeam} vs {match.awayTeam}</h1>;
 * }
 * ```
 */
export function useMatch(): MatchContextValue {
  const context = useContext(MatchContext);

  if (context === null) {
    throw new Error(
      'useMatch must be used within MatchDataProvider. Make sure your component is wrapped with <MatchDataProvider>.'
    );
  }

  return context;
}
