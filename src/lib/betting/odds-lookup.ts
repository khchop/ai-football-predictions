// Lookup odds for a specific bet selection from match analysis
import type { MatchAnalysis } from '@/lib/db/schema';

/**
 * Get odds for a result bet (1, 2, 1X, X2)
 */
export function getResultOdds(analysis: MatchAnalysis, selection: string): number | null {
  const oddsMap: Record<string, string | null> = {
    '1': analysis.oddsHome,
    '2': analysis.oddsAway,
    '1X': analysis.odds1X,
    'X2': analysis.oddsX2,
    '12': analysis.odds12,
  };

  const oddsStr = oddsMap[selection.toUpperCase()];
  if (!oddsStr) return null;
  
  const odds = parseFloat(oddsStr);
  return isNaN(odds) ? null : odds;
}

/**
 * Get odds for an over/under bet (O2.5, U1.5, etc.)
 */
export function getOverUnderOdds(analysis: MatchAnalysis, selection: string): number | null {
  const normalized = selection.toUpperCase().replace(/\s+/g, '');
  
  const oddsMap: Record<string, string | null> = {
    'O0.5': analysis.oddsOver05,
    'U0.5': analysis.oddsUnder05,
    'O1.5': analysis.oddsOver15,
    'U1.5': analysis.oddsUnder15,
    'O2.5': analysis.oddsOver25,
    'U2.5': analysis.oddsUnder25,
    'O3.5': analysis.oddsOver35,
    'U3.5': analysis.oddsUnder35,
    'O4.5': analysis.oddsOver45,
    'U4.5': analysis.oddsUnder45,
  };

  const oddsStr = oddsMap[normalized];
  if (!oddsStr) return null;
  
  const odds = parseFloat(oddsStr);
  return isNaN(odds) ? null : odds;
}

/**
 * Get odds for a BTTS bet (Yes, No)
 */
export function getBttsOdds(analysis: MatchAnalysis, selection: string): number | null {
  const normalized = selection.charAt(0).toUpperCase() + selection.slice(1).toLowerCase();
  
  const oddsMap: Record<string, string | null> = {
    'Yes': analysis.oddsBttsYes,
    'No': analysis.oddsBttsNo,
  };

  const oddsStr = oddsMap[normalized];
  if (!oddsStr) return null;
  
  const odds = parseFloat(oddsStr);
  return isNaN(odds) ? null : odds;
}

/**
 * Get odds for any bet type
 */
export function getBetOdds(
  analysis: MatchAnalysis,
  betType: 'result' | 'over_under' | 'btts',
  selection: string
): number | null {
  switch (betType) {
    case 'result':
      return getResultOdds(analysis, selection);
    case 'over_under':
      return getOverUnderOdds(analysis, selection);
    case 'btts':
      return getBttsOdds(analysis, selection);
    default:
      return null;
  }
}
