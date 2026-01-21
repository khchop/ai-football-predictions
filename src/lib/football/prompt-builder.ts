import type { MatchAnalysis, LeagueStanding } from '@/lib/db/schema';
import type { KeyInjury } from '@/types';
import { format, parseISO } from 'date-fns';

export interface PromptContext {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTime: string;
  analysis: MatchAnalysis | null;
}

// Extended context for batch predictions
export interface BatchMatchContext extends PromptContext {
  matchId: string;
}

// ============================================================================
// OPENROUTER CONTEXT CACHING OPTIMIZATION
// ============================================================================
// OpenRouter caches based on prompt prefixes. To maximize cache hits:
// 1. Put static instructions at the START of the prompt
// 2. Put match-specific dynamic data at the END
// 3. The system prompt is handled separately and cached automatically
// ============================================================================

// Static analysis section headers - OPTIMIZED for token efficiency
// Scoring explanation is in system prompt - don't duplicate here
const ANALYSIS_HEADER = `Analyze match data and predict final score.

DATA FORMAT: Odds (lower=more likely), H2H, Form (WDLWW), Stats (%), Lineups, Absences

KEY FACTORS: Home advantage (~0.4 goals), form, H2H, key injuries, odds consensus

`;

// Get the cacheable prefix for prompts
export function getCacheablePromptPrefix(): string {
  return ANALYSIS_HEADER;
}

// Simple comparison format - numbers only (no visual bars to save tokens)
function buildComparisonBar(homePct: number | null, awayPct: number | null): string {
  if (homePct === null || awayPct === null) return '';
  return `${homePct}%-${awayPct}%`;
}

// Parse H2H results from JSON string
// Matches the H2HMatch structure from match-analysis.ts
interface H2HResult {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

function parseH2HResults(json: string | null): H2HResult[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as H2HResult[];
  } catch {
    return [];
  }
}

// Parse key injuries from JSON string
function parseKeyInjuries(json: string | null): KeyInjury[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as KeyInjury[];
  } catch {
    return [];
  }
}

// Format injuries for a team
function formatTeamInjuries(injuries: KeyInjury[], teamName: string, count: number): string {
  const teamInjuries = injuries.filter(i => i.teamName === teamName);
  
  if (teamInjuries.length === 0) {
    return `${count} absent`;
  }
  
  // Show first 3 injuries with reasons
  const shown = teamInjuries.slice(0, 3);
  const shownStr = shown.map(i => `${i.playerName} (${i.reason})`).join(', ');
  
  if (teamInjuries.length > 3) {
    return `${shownStr}, +${teamInjuries.length - 3} more`;
  }
  
  return shownStr;
}

// Extended context with optional standings data
export interface EnhancedPromptContext extends PromptContext {
  homeStanding?: LeagueStanding | null;
  awayStanding?: LeagueStanding | null;
}

// Format standing for display
function formatStanding(standing: LeagueStanding, isHome: boolean): string {
  const location = isHome ? 'Home' : 'Away';
  const record = `W${standing.won} D${standing.drawn} L${standing.lost}`;
  const homeRecord = standing.homeWon !== null 
    ? `${location}: W${isHome ? standing.homeWon : standing.awayWon} D${isHome ? standing.homeDrawn : standing.awayDrawn} L${isHome ? standing.homeLost : standing.awayLost} (${isHome ? standing.homeGoalsFor : standing.awayGoalsFor}-${isHome ? standing.homeGoalsAgainst : standing.awayGoalsAgainst})`
    : '';
  
  return `${standing.position}${getOrdinalSuffix(standing.position)} (${standing.points} pts, ${record}, ${standing.goalDiff >= 0 ? '+' : ''}${standing.goalDiff} GD)${homeRecord ? `\n  ${homeRecord}` : ''}`;
}

// Get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Build enhanced prompt with all available context
// Structure: CACHEABLE PREFIX + DYNAMIC MATCH DATA
// REMOVED: favoriteTeamName, homeWinPct/drawPct/awayWinPct, advice, likelyScores (biasing)
// ADDED: H2H history, standings context
export function buildEnhancedPrompt(context: PromptContext | EnhancedPromptContext): string {
  const { homeTeam, awayTeam, competition, kickoffTime, analysis } = context;
  const homeStanding = 'homeStanding' in context ? context.homeStanding : null;
  const awayStanding = 'awayStanding' in context ? context.awayStanding : null;
  
  const kickoff = parseISO(kickoffTime);
  const formattedDate = format(kickoff, "yyyy-MM-dd HH:mm 'UTC'");
  
  // Start with cacheable prefix (static instructions)
  const lines: string[] = [ANALYSIS_HEADER];
  
  // Minimal separator (save tokens - was 60 chars = ~15 tokens)
  lines.push('---');
  
  // Dynamic content: Match header (compact)
  lines.push(`${homeTeam} vs ${awayTeam} | ${competition} | ${formattedDate}`);
  lines.push('');
  
  // If we have analysis data, include it
  if (analysis) {
    // Betting Odds (keep - this is consensus signal, not a prediction)
    if (analysis.oddsHome || analysis.oddsDraw || analysis.oddsAway) {
      lines.push('BETTING ODDS:');
      lines.push(`Home Win: ${analysis.oddsHome || 'N/A'} | Draw: ${analysis.oddsDraw || 'N/A'} | Away Win: ${analysis.oddsAway || 'N/A'}`);
      lines.push('');
    }
    
    // League Standings (NEW - factual data)
    if (homeStanding || awayStanding) {
      lines.push('LEAGUE STANDINGS:');
      if (homeStanding) {
        lines.push(`${homeTeam}: ${formatStanding(homeStanding, true)}`);
      }
      if (awayStanding) {
        lines.push(`${awayTeam}: ${formatStanding(awayStanding, false)}`);
      }
      lines.push('');
    }
    
    // Head-to-Head History (NEW - factual data, extracted from existing API response)
    if (analysis.h2hTotal && analysis.h2hTotal > 0) {
      lines.push('HEAD-TO-HEAD:');
      lines.push(`Record (${analysis.h2hTotal} matches): ${homeTeam} ${analysis.h2hHomeWins} wins, ${analysis.h2hDraws} draws, ${awayTeam} ${analysis.h2hAwayWins} wins`);
      
      const h2hResults = parseH2HResults(analysis.h2hResults);
      if (h2hResults.length > 0) {
        const resultsStr = h2hResults.map(r => `${r.homeScore}-${r.awayScore}`).join(', ');
        lines.push(`Last ${h2hResults.length}: ${resultsStr} (home team score first)`);
      }
      lines.push('');
    }
    
    // Team comparison (compact format - no team names repeated)
    if (analysis.formHomePct || analysis.attackHomePct || analysis.defenseHomePct) {
      lines.push('STATS (Home-Away):');
      const stats: string[] = [];
      if (analysis.formHomePct && analysis.formAwayPct) {
        stats.push(`Form ${buildComparisonBar(analysis.formHomePct, analysis.formAwayPct)}`);
      }
      if (analysis.attackHomePct && analysis.attackAwayPct) {
        stats.push(`Atk ${buildComparisonBar(analysis.attackHomePct, analysis.attackAwayPct)}`);
      }
      if (analysis.defenseHomePct && analysis.defenseAwayPct) {
        stats.push(`Def ${buildComparisonBar(analysis.defenseHomePct, analysis.defenseAwayPct)}`);
      }
      lines.push(stats.join(' | '));
      lines.push('');
    }
    
    // Combined form section (compact)
    lines.push('FORM (last 5):');
    if (analysis.homeTeamForm) {
      const homeGoals = analysis.homeGoalsScored !== null && analysis.homeGoalsConceded !== null
        ? ` (${analysis.homeGoalsScored}GF/${analysis.homeGoalsConceded}GA)`
        : '';
      lines.push(`Home: ${analysis.homeTeamForm}${homeGoals}`);
    }
    if (analysis.awayTeamForm) {
      const awayGoals = analysis.awayGoalsScored !== null && analysis.awayGoalsConceded !== null
        ? ` (${analysis.awayGoalsScored}GF/${analysis.awayGoalsConceded}GA)`
        : '';
      lines.push(`Away: ${analysis.awayTeamForm}${awayGoals}`);
    }
    lines.push('');
    
    // Lineups - compressed format (formation + notable absences only)
    if (analysis.lineupsAvailable && analysis.homeFormation && analysis.awayFormation) {
      lines.push(`LINEUPS: ${analysis.homeFormation} vs ${analysis.awayFormation} (confirmed)`);
      lines.push('');
    }
    
    // Key absences
    const totalInjuries = (analysis.homeInjuriesCount || 0) + (analysis.awayInjuriesCount || 0);
    if (totalInjuries > 0) {
      const keyInjuries = parseKeyInjuries(analysis.keyInjuries);
      lines.push('KEY ABSENCES:');
      if (analysis.homeInjuriesCount && analysis.homeInjuriesCount > 0) {
        lines.push(`${homeTeam} (${analysis.homeInjuriesCount}): ${formatTeamInjuries(keyInjuries, homeTeam, analysis.homeInjuriesCount)}`);
      }
      if (analysis.awayInjuriesCount && analysis.awayInjuriesCount > 0) {
        lines.push(`${awayTeam} (${analysis.awayInjuriesCount}): ${formatTeamInjuries(keyInjuries, awayTeam, analysis.awayInjuriesCount)}`);
      }
      lines.push('');
    }
  } else {
    // No analysis available
    lines.push('Note: No detailed pre-match analysis available.');
    lines.push('');
  }
  
  // Final instruction (minimal separator)
  lines.push('---');
  lines.push('JSON: {"home_score": X, "away_score": Y}');
  
  return lines.join('\n');
}

// Simple prompt for when no analysis is available (backward compatible)
export function buildSimplePrompt(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  matchDate: string
): string {
  return buildEnhancedPrompt({
    homeTeam,
    awayTeam,
    competition,
    kickoffTime: matchDate,
    analysis: null,
  });
}

// ============================================================================
// BATCH PROMPT BUILDING (Multiple Matches in One API Call)
// ============================================================================

// Static header for batch prompts - OPTIMIZED for token efficiency
const BATCH_ANALYSIS_HEADER = `Predict scores for ALL matches. Output JSON array only.

DATA: Odds (lower=likely), H2H, Form, Stats %, Lineups, Absences

`;

// Build a compact match summary for batch prompts
// REMOVED: favoriteTeamName, winPct (biasing)
// ADDED: H2H summary
function buildCompactMatchSummary(context: BatchMatchContext, index: number): string {
  const { matchId, homeTeam, awayTeam, competition, kickoffTime, analysis } = context;
  
  const kickoff = parseISO(kickoffTime);
  const formattedTime = format(kickoff, "HH:mm 'UTC'");
  
  const lines: string[] = [];
  
  // Match header with ID (important for matching responses)
  lines.push(`[${index + 1}] match_id: "${matchId}"`);
  lines.push(`    ${homeTeam} vs ${awayTeam} | ${competition} | ${formattedTime}`);
  
  if (analysis) {
    // Odds (compact) - consensus signal, not a prediction
    if (analysis.oddsHome || analysis.oddsDraw || analysis.oddsAway) {
      lines.push(`    Odds: H=${analysis.oddsHome || '-'} D=${analysis.oddsDraw || '-'} A=${analysis.oddsAway || '-'}`);
    }
    
    // H2H (compact) - factual historical data
    if (analysis.h2hTotal && analysis.h2hTotal > 0) {
      const h2hResults = parseH2HResults(analysis.h2hResults);
      const resultsStr = h2hResults.length > 0 ? h2hResults.slice(0, 3).map(r => `${r.homeScore}-${r.awayScore}`).join(',') : '';
      lines.push(`    H2H: ${analysis.h2hHomeWins}W-${analysis.h2hDraws}D-${analysis.h2hAwayWins}L${resultsStr ? ` (last: ${resultsStr})` : ''}`);
    }
    
    // Form (compact - just the letters)
    const homeForm = analysis.homeTeamForm || '-';
    const awayForm = analysis.awayTeamForm || '-';
    lines.push(`    Form: H=${homeForm} A=${awayForm}`);
    
    // Comparison (compact, only if available)
    if (analysis.formHomePct && analysis.formAwayPct) {
      lines.push(`    Stats: Form ${analysis.formHomePct}%-${analysis.formAwayPct}% | Atk ${analysis.attackHomePct || '-'}%-${analysis.attackAwayPct || '-'}% | Def ${analysis.defenseHomePct || '-'}%-${analysis.defenseAwayPct || '-'}%`);
    }
    
    // Key absences (very compact)
    const totalInjuries = (analysis.homeInjuriesCount || 0) + (analysis.awayInjuriesCount || 0);
    if (totalInjuries > 0) {
      const keyInjuries = parseKeyInjuries(analysis.keyInjuries);
      const topInjuries = keyInjuries.slice(0, 4).map(i => `${i.playerName}(${i.teamName.substring(0, 3)})`).join(', ');
      lines.push(`    Absences: ${topInjuries}${keyInjuries.length > 4 ? ` +${keyInjuries.length - 4} more` : ''}`);
    }
    
    // Lineups indicator
    if (analysis.lineupsAvailable) {
      lines.push(`    Lineups: ${analysis.homeFormation || '?'} vs ${analysis.awayFormation || '?'} (confirmed)`);
    }
  } else {
    lines.push(`    [No detailed analysis available]`);
  }
  
  return lines.join('\n');
}

// Build batch prompt for multiple matches - OPTIMIZED for tokens
export function buildBatchPrompt(matches: BatchMatchContext[]): string {
  if (matches.length === 0) {
    return '';
  }
  
  const lines: string[] = [BATCH_ANALYSIS_HEADER];
  
  // Compact header
  const matchDate = matches[0] ? format(parseISO(matches[0].kickoffTime), 'yyyy-MM-dd') : '';
  lines.push(`Date: ${matchDate} | Matches: ${matches.length}`);
  lines.push('---');
  
  // Add each match summary
  for (let i = 0; i < matches.length; i++) {
    lines.push(buildCompactMatchSummary(matches[i], i));
    lines.push('');
  }
  
  // Final instruction (compact)
  lines.push('---');
  lines.push(`JSON: [{"match_id": "...", "home_score": X, "away_score": Y}, ...]`);
  
  return lines.join('\n');
}

// Get the cacheable prefix for batch prompts
export function getBatchCacheablePrefix(): string {
  return BATCH_ANALYSIS_HEADER;
}
