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
export function buildEnhancedPrompt(context: PromptContext): string {
  const { homeTeam, awayTeam, competition, kickoffTime, analysis } = context;
  
  const kickoff = parseISO(kickoffTime);
  const formattedDate = format(kickoff, "yyyy-MM-dd HH:mm 'UTC'");
  
  const lines: string[] = [];
  
  // Header
  lines.push('═'.repeat(60));
  lines.push(`MATCH: ${homeTeam} vs ${awayTeam}`);
  lines.push(`Competition: ${competition}`);
  lines.push(`Date: ${formattedDate}`);
  lines.push('═'.repeat(60));
  lines.push('');
  
  // If we have analysis data, include it
  if (analysis) {
    // Betting Odds
    if (analysis.oddsHome || analysis.oddsDraw || analysis.oddsAway) {
      lines.push('📊 BETTING ODDS:');
      lines.push(`   Home Win: ${analysis.oddsHome || 'N/A'} | Draw: ${analysis.oddsDraw || 'N/A'} | Away Win: ${analysis.oddsAway || 'N/A'}`);
      
      // Likely scores
      const likelyScores = parseLikelyScores(analysis.likelyScores);
      if (likelyScores.length > 0) {
        const scoresStr = likelyScores.slice(0, 3).map(s => `${s.score} (${s.odds})`).join(', ');
        lines.push(`   Likely scores: ${scoresStr}`);
      }
      lines.push('');
    }
    
    // Pre-match analysis
    if (analysis.favoriteTeamName || analysis.advice) {
      lines.push('⭐ PRE-MATCH ANALYSIS:');
      if (analysis.favoriteTeamName && analysis.homeWinPct && analysis.awayWinPct) {
        const favoriteIsHome = analysis.favoriteTeamId && analysis.homeWinPct > analysis.awayWinPct;
        const favoritePct = favoriteIsHome ? analysis.homeWinPct : analysis.awayWinPct;
        lines.push(`   Favorite: ${analysis.favoriteTeamName} (${favoritePct}% chance)`);
      }
      if (analysis.advice) {
        lines.push(`   Advice: "${analysis.advice}"`);
      }
      lines.push('');
    }
    
    // Team comparison
    if (analysis.formHomePct || analysis.attackHomePct || analysis.defenseHomePct) {
      lines.push('⚔️ TEAM COMPARISON:');
      if (analysis.formHomePct && analysis.formAwayPct) {
        lines.push(`   Form:    ${homeTeam} ${buildComparisonBar(analysis.formHomePct, analysis.formAwayPct)} ${awayTeam}`);
      }
      if (analysis.attackHomePct && analysis.attackAwayPct) {
        lines.push(`   Attack:  ${homeTeam} ${buildComparisonBar(analysis.attackHomePct, analysis.attackAwayPct)} ${awayTeam}`);
      }
      if (analysis.defenseHomePct && analysis.defenseAwayPct) {
        lines.push(`   Defense: ${homeTeam} ${buildComparisonBar(analysis.defenseHomePct, analysis.defenseAwayPct)} ${awayTeam}`);
      }
      lines.push('');
    }
    
    // Home team form
    lines.push(`🏠 ${homeTeam.toUpperCase()} (Home):`);
    if (analysis.homeTeamForm) {
      const form = analysis.homeTeamForm.split('').join('-');
      const goalsInfo = analysis.homeGoalsScored !== null && analysis.homeGoalsConceded !== null
        ? ` (${analysis.homeGoalsScored} scored, ${analysis.homeGoalsConceded} conceded in last 5)`
        : '';
      lines.push(`   Recent Form: ${form}${goalsInfo}`);
    }
    if (analysis.lineupsAvailable && analysis.homeFormation) {
      lines.push(`   Formation: ${analysis.homeFormation}`);
      if (analysis.homeCoach) {
        lines.push(`   Coach: ${analysis.homeCoach}`);
      }
    }
    lines.push('');
    
    // Away team form
    lines.push(`🚌 ${awayTeam.toUpperCase()} (Away):`);
    if (analysis.awayTeamForm) {
      const form = analysis.awayTeamForm.split('').join('-');
      const goalsInfo = analysis.awayGoalsScored !== null && analysis.awayGoalsConceded !== null
        ? ` (${analysis.awayGoalsScored} scored, ${analysis.awayGoalsConceded} conceded in last 5)`
        : '';
      lines.push(`   Recent Form: ${form}${goalsInfo}`);
    }
    if (analysis.lineupsAvailable && analysis.awayFormation) {
      lines.push(`   Formation: ${analysis.awayFormation}`);
      if (analysis.awayCoach) {
        lines.push(`   Coach: ${analysis.awayCoach}`);
      }
    }
    lines.push('');
    
    // Lineups (if available)
    if (analysis.lineupsAvailable && analysis.homeStartingXI && analysis.awayStartingXI) {
      lines.push('📋 CONFIRMED LINEUPS:');
      lines.push(`   ${homeTeam} XI: ${analysis.homeStartingXI}`);
      lines.push(`   ${awayTeam} XI: ${analysis.awayStartingXI}`);
      lines.push('');
    }
    
    // Key absences
    const totalInjuries = (analysis.homeInjuriesCount || 0) + (analysis.awayInjuriesCount || 0);
    if (totalInjuries > 0) {
      const keyInjuries = parseKeyInjuries(analysis.keyInjuries);
      lines.push('🏥 KEY ABSENCES:');
      if (analysis.homeInjuriesCount && analysis.homeInjuriesCount > 0) {
        lines.push(`   ${homeTeam} (${analysis.homeInjuriesCount}): ${formatTeamInjuries(keyInjuries, homeTeam, analysis.homeInjuriesCount)}`);
      }
      if (analysis.awayInjuriesCount && analysis.awayInjuriesCount > 0) {
        lines.push(`   ${awayTeam} (${analysis.awayInjuriesCount}): ${formatTeamInjuries(keyInjuries, awayTeam, analysis.awayInjuriesCount)}`);
      }
      lines.push('');
    }
  } else {
    // No analysis available
    lines.push('Note: No pre-match analysis data available.');
    lines.push('Consider team strength, recent form, and historical results.');
    lines.push('');
  }
  
  // Footer with instructions
  lines.push('═'.repeat(60));
  lines.push('Based on this analysis, predict the final score.');
  lines.push('Respond with ONLY JSON: {"home_score": X, "away_score": Y}');
  lines.push('═'.repeat(60));
  
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
