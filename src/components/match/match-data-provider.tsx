'use client';

import { createContext, useMemo } from 'react';
import type { Match, Competition, MatchAnalysis } from '@/types';

/**
 * Context value interface for match data distribution.
 * Provides single source of truth for match page components.
 */
export interface MatchContextValue {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  matchState: 'upcoming' | 'live' | 'finished';
}

/**
 * MatchContext for distributing match data to child components.
 * Use useMatch() hook to consume - it provides type safety and null checks.
 */
export const MatchContext = createContext<MatchContextValue | null>(null);

interface MatchDataProviderProps {
  match: Match;
  competition: Competition;
  analysis: MatchAnalysis | null;
  children: React.ReactNode;
}

/**
 * MatchDataProvider - Client Component that provides match data via React Context.
 *
 * Features:
 * - Derives matchState once (not in consumers)
 * - Memoizes context value to prevent unnecessary re-renders
 * - Single source of truth for match/competition/analysis data
 *
 * @example
 * ```tsx
 * <MatchDataProvider match={match} competition={competition} analysis={analysis}>
 *   <MatchHeader />
 *   <MatchContent />
 * </MatchDataProvider>
 * ```
 */
export function MatchDataProvider({
  match,
  competition,
  analysis,
  children,
}: MatchDataProviderProps) {
  // Derive match state once in provider (not left for consumers)
  const matchState = useMemo((): 'upcoming' | 'live' | 'finished' => {
    if (match.status === 'finished') return 'finished';
    if (match.status === 'live') return 'live';
    return 'upcoming';
  }, [match.status]);

  // Memoize context value to prevent re-renders from object identity
  const contextValue = useMemo(
    (): MatchContextValue => ({
      match,
      competition,
      analysis,
      matchState,
    }),
    [match, competition, analysis, matchState]
  );

  return (
    <MatchContext.Provider value={contextValue}>
      {children}
    </MatchContext.Provider>
  );
}
