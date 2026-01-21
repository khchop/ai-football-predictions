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

// Static analysis section headers - cacheable prefix
const ANALYSIS_HEADER = `You will receive match data in a structured format. Analyze ALL provided data:

DATA SECTIONS:
- BETTING ODDS: Market consensus (lower odds = higher probability)
- STANDINGS: League position, points, goal difference, home/away records
- HEAD-TO-HEAD: Historical meetings between these teams
- FORM: Recent results (W=Win, D=Draw, L=Loss)
- COMPARISON: Statistical ratings (higher % = stronger)
- LINEUPS: Starting XI and formations (when available)
- ABSENCES: Injured/suspended players

ODDS INTERPRETATION:
Lower odds = higher probability. Examples: 1.50 ≈ 67%, 3.00 ≈ 33%, 6.00 ≈ 17%
Note: Most models will follow odds → common prediction → low quota (2-3 pts)
Spot when data contradicts odds → rare prediction → high quota (5-6 pts)

KEY FACTORS:
1. Home advantage typically worth 0.3-0.5 goals
2. League position and form indicate current strength
3. Head-to-head matters especially for rivalries
4. Key injuries can shift expected outcome
5. Odds reflect market consensus but can be wrong

Your task: Predict the final score based on the data provided.
Response format: ONLY JSON {"home_score": X, "away_score": Y}

`;

// Get the cacheable prefix for prompts
export function getCacheablePromptPrefix(): string {
  return ANALYSIS_HEADER;
}

// Build a simple comparison bar for display
function buildComparisonBar(homePct: number | null, awayPct: number | null): string {
  if (homePct === null || awayPct === null) return '';
  
  const homeBlocks = Math.round(homePct / 5); // 20 blocks total
  const awayBlocks = 20 - homeBlocks;
  
  const homeBar = '█'.repeat(Math.max(0, homeBlocks));
  const awayBar = '█'.repeat(Math.max(0, awayBlocks));
  
  return `${homePct}% ${homeBar}${awayBar} ${awayPct}%`;
}

// Parse H2H results from JSON string
interface H2HResult {
  home: number;
  away: number;
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
  
  // Add separator before dynamic content
  lines.push('═'.repeat(60));
  lines.push('MATCH DATA:');
  lines.push('═'.repeat(60));
  lines.push('');
  
  // Dynamic content: Match header
  lines.push(`Match: ${homeTeam} vs ${awayTeam}`);
  lines.push(`Competition: ${competition}`);
  lines.push(`Date: ${formattedDate}`);
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
        const resultsStr = h2hResults.map(r => `${r.home}-${r.away}`).join(', ');
        lines.push(`Last ${h2hResults.length}: ${resultsStr} (home team score first)`);
      }
      lines.push('');
    }
    
    // Team comparison (keep - derived stats but not predictive)
    if (analysis.formHomePct || analysis.attackHomePct || analysis.defenseHomePct) {
      lines.push('TEAM COMPARISON:');
      if (analysis.formHomePct && analysis.formAwayPct) {
        lines.push(`Form: ${homeTeam} ${buildComparisonBar(analysis.formHomePct, analysis.formAwayPct)} ${awayTeam}`);
      }
      if (analysis.attackHomePct && analysis.attackAwayPct) {
        lines.push(`Attack: ${homeTeam} ${buildComparisonBar(analysis.attackHomePct, analysis.attackAwayPct)} ${awayTeam}`);
      }
      if (analysis.defenseHomePct && analysis.defenseAwayPct) {
        lines.push(`Defense: ${homeTeam} ${buildComparisonBar(analysis.defenseHomePct, analysis.defenseAwayPct)} ${awayTeam}`);
      }
      lines.push('');
    }
    
    // Home team form
    lines.push(`${homeTeam.toUpperCase()} (Home):`);
    if (analysis.homeTeamForm) {
      const form = analysis.homeTeamForm.split('').join('-');
      const goalsInfo = analysis.homeGoalsScored !== null && analysis.homeGoalsConceded !== null
        ? ` (${analysis.homeGoalsScored} scored, ${analysis.homeGoalsConceded} conceded in last 5)`
        : '';
      lines.push(`Recent Form: ${form}${goalsInfo}`);
    }
    if (analysis.lineupsAvailable && analysis.homeFormation) {
      lines.push(`Formation: ${analysis.homeFormation}`);
      if (analysis.homeCoach) {
        lines.push(`Coach: ${analysis.homeCoach}`);
      }
    }
    lines.push('');
    
    // Away team form
    lines.push(`${awayTeam.toUpperCase()} (Away):`);
    if (analysis.awayTeamForm) {
      const form = analysis.awayTeamForm.split('').join('-');
      const goalsInfo = analysis.awayGoalsScored !== null && analysis.awayGoalsConceded !== null
        ? ` (${analysis.awayGoalsScored} scored, ${analysis.awayGoalsConceded} conceded in last 5)`
        : '';
      lines.push(`Recent Form: ${form}${goalsInfo}`);
    }
    if (analysis.lineupsAvailable && analysis.awayFormation) {
      lines.push(`Formation: ${analysis.awayFormation}`);
      if (analysis.awayCoach) {
        lines.push(`Coach: ${analysis.awayCoach}`);
      }
    }
    lines.push('');
    
    // Lineups (if available)
    if (analysis.lineupsAvailable && analysis.homeStartingXI && analysis.awayStartingXI) {
      lines.push('CONFIRMED LINEUPS:');
      lines.push(`${homeTeam} XI: ${analysis.homeStartingXI}`);
      lines.push(`${awayTeam} XI: ${analysis.awayStartingXI}`);
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
  
  // Final instruction (kept short)
  lines.push('═'.repeat(60));
  lines.push('Predict final score as JSON: {"home_score": X, "away_score": Y}');
  
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

// Static header for batch prompts - cacheable across all batches
const BATCH_ANALYSIS_HEADER = `You will receive MULTIPLE matches. Analyze ALL data for EACH match.

DATA PER MATCH:
- ODDS: Market consensus (lower = higher probability). 1.50≈67%, 3.00≈33%, 6.00≈17%
- H2H: Historical head-to-head results
- FORM: Recent results (W=Win, D=Draw, L=Loss)
- STATS: Form/Attack/Defense comparison %
- LINEUPS: Starting XI (when available)
- ABSENCES: Injured/suspended players

ODDS NOTE: Most models follow odds → common prediction → low quota (2-3 pts)
Spot when data contradicts odds → rare prediction → high quota (5-6 pts)

STRATEGY:
- Analyze each match independently
- Upset needs ~30%+ real probability to be worth predicting
- Expected value = probability × quota points

OUTPUT: JSON ARRAY with ALL matches:
[{"match_id": "id1", "home_score": X, "away_score": Y}, ...]

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
      const resultsStr = h2hResults.length > 0 ? h2hResults.slice(0, 3).map(r => `${r.home}-${r.away}`).join(',') : '';
      lines.push(`    H2H: ${analysis.h2hHomeWins}W-${analysis.h2hDraws}D-${analysis.h2hAwayWins}L${resultsStr ? ` (last: ${resultsStr})` : ''}`);
    }
    
    // Form (compact)
    const homeForm = analysis.homeTeamForm || '-';
    const awayForm = analysis.awayTeamForm || '-';
    lines.push(`    Form: ${homeTeam}=${homeForm} | ${awayTeam}=${awayForm}`);
    
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

// Build batch prompt for multiple matches
export function buildBatchPrompt(matches: BatchMatchContext[]): string {
  if (matches.length === 0) {
    return '';
  }
  
  const lines: string[] = [BATCH_ANALYSIS_HEADER];
  
  // Add competition/date context if all matches are same competition
  const competitions = [...new Set(matches.map(m => m.competition))];
  if (competitions.length === 1) {
    lines.push(`Competition: ${competitions[0]}`);
  }
  
  const matchDate = matches[0] ? format(parseISO(matches[0].kickoffTime), 'yyyy-MM-dd') : '';
  lines.push(`Match Date: ${matchDate}`);
  lines.push(`Total Matches: ${matches.length}`);
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('MATCHES:');
  lines.push('═'.repeat(60));
  lines.push('');
  
  // Add each match summary
  for (let i = 0; i < matches.length; i++) {
    lines.push(buildCompactMatchSummary(matches[i], i));
    lines.push('');
  }
  
  // Final instruction
  lines.push('═'.repeat(60));
  lines.push(`Predict ALL ${matches.length} matches. Output JSON array only:`);
  lines.push('[{"match_id": "...", "home_score": X, "away_score": Y}, ...]');
  
  return lines.join('\n');
}

// Get the cacheable prefix for batch prompts
export function getBatchCacheablePrefix(): string {
  return BATCH_ANALYSIS_HEADER;
}
