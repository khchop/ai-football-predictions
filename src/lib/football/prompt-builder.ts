import type { MatchAnalysis } from '@/lib/db/schema';
import type { LikelyScore, KeyInjury } from '@/types';
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
const ANALYSIS_HEADER = `You will receive match data in a structured format. Analyze ALL provided data carefully:

- BETTING ODDS: Market expectations (lower odds = more likely outcome)
- FORM: Recent results (W=Win, D=Draw, L=Loss) 
- COMPARISON: Statistical ratings (higher % = stronger in that area)
- LINEUPS: Confirmed starting players and formations
- ABSENCES: Injured/suspended players

SCORING SYSTEM (Kicktipp Quota Rule):
You are competing against other AI models. Points depend on prediction rarity:
- Correct tendency (H/D/A): 2-6 pts (rarer prediction = more points)
- Correct goal difference: +1 pt bonus
- Exact score: +3 pts bonus
- Maximum: 10 points per match

RISK/REWARD STRATEGY:
- "Safe" prediction (e.g., strong favorite wins): Low quota (2-3 pts), high probability
- "Risky" prediction (e.g., upset): High quota (5-6 pts), low probability
- Consider expected value: probability × points
- Only predict upsets when data genuinely supports it
- Don't be contrarian just to score more - accuracy still matters!

Key prediction factors:
1. Home advantage typically worth 0.3-0.5 goals
2. Recent form indicates current confidence/momentum  
3. Injury impact depends on player importance
4. Odds reflect collective market intelligence
5. Head-to-head history matters for derby matches

Your task: Predict the most likely final score.
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

// Parse likely scores from JSON string
function parseLikelyScores(json: string | null): LikelyScore[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as LikelyScore[];
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

// Build enhanced prompt with all available context
// Structure: CACHEABLE PREFIX + DYNAMIC MATCH DATA
export function buildEnhancedPrompt(context: PromptContext): string {
  const { homeTeam, awayTeam, competition, kickoffTime, analysis } = context;
  
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
    // Betting Odds
    if (analysis.oddsHome || analysis.oddsDraw || analysis.oddsAway) {
      lines.push('BETTING ODDS:');
      lines.push(`Home Win: ${analysis.oddsHome || 'N/A'} | Draw: ${analysis.oddsDraw || 'N/A'} | Away Win: ${analysis.oddsAway || 'N/A'}`);
      
      // Likely scores
      const likelyScores = parseLikelyScores(analysis.likelyScores);
      if (likelyScores.length > 0) {
        const scoresStr = likelyScores.slice(0, 3).map(s => `${s.score} (${s.odds})`).join(', ');
        lines.push(`Likely scores: ${scoresStr}`);
      }
      lines.push('');
    }
    
    // Pre-match analysis
    if (analysis.favoriteTeamName || analysis.advice) {
      lines.push('PRE-MATCH ANALYSIS:');
      if (analysis.favoriteTeamName && analysis.homeWinPct && analysis.awayWinPct) {
        const favoriteIsHome = analysis.favoriteTeamId && analysis.homeWinPct > analysis.awayWinPct;
        const favoritePct = favoriteIsHome ? analysis.homeWinPct : analysis.awayWinPct;
        lines.push(`Favorite: ${analysis.favoriteTeamName} (${favoritePct}% chance)`);
      }
      if (analysis.advice) {
        lines.push(`Advice: "${analysis.advice}"`);
      }
      lines.push('');
    }
    
    // Team comparison
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
const BATCH_ANALYSIS_HEADER = `You will receive MULTIPLE matches in a structured format. Analyze ALL provided data carefully for EACH match.

DATA SECTIONS PER MATCH:
- BETTING ODDS: Market expectations (lower odds = more likely outcome)
- FORM: Recent results (W=Win, D=Draw, L=Loss)
- COMPARISON: Statistical ratings (higher % = stronger in that area)
- LINEUPS: Confirmed starting players and formations (if available)
- ABSENCES: Injured/suspended players

SCORING SYSTEM (Kicktipp Quota Rule):
You are competing against other AI models. Points depend on prediction rarity:
- Correct tendency (H/D/A): 2-6 pts (rarer prediction = more points)
- Correct goal difference: +1 pt bonus
- Exact score: +3 pts bonus
- Maximum: 10 points per match

STRATEGY:
- Analyze each match independently based on its data
- Don't predict upsets just to be different - only when data supports it
- Consider expected value: probability × points

OUTPUT FORMAT - JSON ARRAY with ALL matches:
[
  {"match_id": "id1", "home_score": X, "away_score": Y},
  {"match_id": "id2", "home_score": X, "away_score": Y},
  ...
]

`;

// Build a compact match summary for batch prompts
function buildCompactMatchSummary(context: BatchMatchContext, index: number): string {
  const { matchId, homeTeam, awayTeam, competition, kickoffTime, analysis } = context;
  
  const kickoff = parseISO(kickoffTime);
  const formattedTime = format(kickoff, "HH:mm 'UTC'");
  
  const lines: string[] = [];
  
  // Match header with ID (important for matching responses)
  lines.push(`[${index + 1}] match_id: "${matchId}"`);
  lines.push(`    ${homeTeam} vs ${awayTeam} | ${competition} | ${formattedTime}`);
  
  if (analysis) {
    // Odds (compact)
    if (analysis.oddsHome || analysis.oddsDraw || analysis.oddsAway) {
      lines.push(`    Odds: H=${analysis.oddsHome || '-'} D=${analysis.oddsDraw || '-'} A=${analysis.oddsAway || '-'}`);
    }
    
    // Form (compact)
    const homeForm = analysis.homeTeamForm || '-';
    const awayForm = analysis.awayTeamForm || '-';
    lines.push(`    Form: ${homeTeam}=${homeForm} | ${awayTeam}=${awayForm}`);
    
    // Comparison (compact, only if available)
    if (analysis.formHomePct && analysis.formAwayPct) {
      lines.push(`    Stats: Form ${analysis.formHomePct}%-${analysis.formAwayPct}% | Atk ${analysis.attackHomePct || '-'}%-${analysis.attackAwayPct || '-'}% | Def ${analysis.defenseHomePct || '-'}%-${analysis.defenseAwayPct || '-'}%`);
    }
    
    // Favorite (compact)
    if (analysis.favoriteTeamName) {
      const favPct = analysis.homeWinPct && analysis.awayWinPct 
        ? Math.max(analysis.homeWinPct, analysis.awayWinPct)
        : null;
      lines.push(`    Favorite: ${analysis.favoriteTeamName}${favPct ? ` (${favPct}%)` : ''}`);
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
