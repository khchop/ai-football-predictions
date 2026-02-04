/**
 * AI Prompt Templates for Content Generation
 * 
 * These prompts are optimized for Gemini 3 Flash Preview to generate
 * high-quality, SEO-friendly content for football match predictions.
 */

interface MatchPreviewData {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTime: string;
  venue?: string;
  
  // Analysis data
  homeWinPct?: number;
  drawPct?: number;
  awayWinPct?: number;
  advice?: string;
  
  // Team form
  homeTeamForm?: string;
  awayTeamForm?: string;
  homeGoalsScored?: number;
  homeGoalsConceded?: number;
  awayGoalsScored?: number;
  awayGoalsConceded?: number;
  
  // Odds
  oddsHome?: string;
  oddsDraw?: string;
  oddsAway?: string;
  oddsOver25?: string;
  oddsUnder25?: string;
  oddsBttsYes?: string;
  
  // AI model predictions
  aiPredictions?: Array<{
    model: string;
    prediction: string;
  }>;
  
  // H2H data
  h2hHistory?: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    score: string;
  }>;
}

export function buildMatchPreviewPrompt(data: MatchPreviewData): string {
  const { homeTeam, awayTeam, competition, kickoffTime, venue } = data;
  
  return `Match Details:
- ${homeTeam} vs ${awayTeam}
- Competition: ${competition}
- Kickoff: ${kickoffTime}${venue ? `\n- Venue: ${venue}` : ''}

Team Form:
${data.homeTeamForm ? `- ${homeTeam}: ${data.homeTeamForm} (Goals: ${data.homeGoalsScored}F / ${data.homeGoalsConceded}A)` : ''}
${data.awayTeamForm ? `- ${awayTeam}: ${data.awayTeamForm} (Goals: ${data.awayGoalsScored}F / ${data.awayGoalsConceded}A)` : ''}

Betting Odds:
${data.oddsHome ? `- ${homeTeam} Win: ${data.oddsHome}` : ''}
${data.oddsDraw ? `- Draw: ${data.oddsDraw}` : ''}
${data.oddsAway ? `- ${awayTeam} Win: ${data.oddsAway}` : ''}
${data.oddsOver25 ? `- Over 2.5 Goals: ${data.oddsOver25}` : ''}
${data.oddsBttsYes ? `- Both Teams to Score: ${data.oddsBttsYes}` : ''}

Win Probability:
${data.homeWinPct ? `- ${homeTeam}: ${data.homeWinPct}%` : ''}
${data.drawPct ? `- Draw: ${data.drawPct}%` : ''}
${data.awayWinPct ? `- ${awayTeam}: ${data.awayWinPct}%` : ''}

${data.advice ? `Expert Advice: ${data.advice}` : ''}

${data.aiPredictions && data.aiPredictions.length > 0 ? `
AI Model Predictions:
${data.aiPredictions.map(p => `- ${p.model}: ${p.prediction}`).join('\n')}
` : ''}

${data.h2hHistory && data.h2hHistory.length > 0 ? `
Recent Head-to-Head:
${data.h2hHistory.slice(0, 3).map(h => `- ${h.date}: ${h.homeTeam} vs ${h.awayTeam} (${h.score})`).join('\n')}
` : ''}

Write a comprehensive match preview with the following sections in JSON format:

{
  "introduction": "2-3 paragraph introduction setting the scene (200-250 words). Include match importance, stakes, and context.",
  "teamFormAnalysis": "Detailed analysis of both teams' recent form and current situation (250-300 words). Discuss momentum, injuries, key player availability.",
  "headToHead": "H2H history analysis if data available, or tactical matchup discussion (150-200 words).",
  "keyPlayers": "Players to watch from both teams (150-200 words). Focus on impact players.",
  "tacticalAnalysis": "Expected tactics and game plan from both managers (200-250 words). Discuss formations and strategies.",
  "prediction": "AI-powered prediction with reasoning (150-200 words). Reference the odds and AI model consensus.",
  "bettingInsights": "Betting tips and value bets based on the analysis (150-200 words). Suggest 2-3 betting markets with reasoning.",
  "metaDescription": "SEO-optimized meta description (150-160 characters exactly)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Writing Guidelines:
- Write in a professional, engaging tone
- Use data and statistics to support analysis
- Be objective but insightful
- Optimize for both human readers and AI search engines
- Include relevant football terminology
- Make specific, data-backed predictions
- Focus on value and actionable insights
- Keep paragraphs concise and scannable
- Use transition phrases between sections
- Output plain text only, no HTML tags or entities

Return ONLY the JSON object, no additional text.`;
}

interface LeagueRoundupData {
  competition: string;
  competitionSlug: string;
  week: string;
  allowedTeams?: string[];
  summary?: {
    totalMatches: number;
    totalPredictions: number;
    avgTendencyAccuracyPct: number;
    avgExactHitPct: number;
  };
  topModelsByAvgPoints?: Array<{
    modelName: string;
    matchesCovered: number;
    totalPoints: number;
    avgPointsPerMatch: number;
    tendencyAccuracyPct: number;
    exactHitPct: number;
  }>;
  biggestConsensusMisses?: Array<{
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    finalScore: string | null;
    consensusOutcome: 'H' | 'D' | 'A';
    consensusSharePct: number;
    predictedResultCounts: { H: number; D: number; A: number };
  }>;
  matches: Array<{
    matchId?: string;
    kickoffTime?: string;
    round?: string | null;
    homeTeam: string;
    awayTeam: string;
    finalScore?: string | null;
    totalModels?: number;
    correctTendencyCount?: number;
    correctTendencyPct?: number;
    exactScoreCount?: number;
    exactScorePct?: number;
    predictedResultCounts?: { H: number; D: number; A: number };
    consensusOutcome?: 'H' | 'D' | 'A';
    consensusOutcomeSharePct?: number;
    consensusCorrect?: boolean | null;
    topScorelines?: Array<{ scoreline: string; count: number }>;
    topModels?: Array<{
      modelName: string;
      predictedScore: string;
      predictedResult: string;
      points: number;
    }>;
    wasUpset?: boolean;
  }>;
  standingsTop5?: Array<{
    position: number;
    team: string;
    points: number;
    played: number;
  }>;
}

export function buildLeagueRoundupPrompt(data: LeagueRoundupData): string {
  const {
    competition,
    week,
    allowedTeams,
    summary,
    topModelsByAvgPoints,
    biggestConsensusMisses,
    matches,
  } = data;

  const factsOnlyRules = [
    'Use ONLY the facts and numbers provided under DATA. Do not infer missing facts.',
    'Mention ONLY teams that appear in ALLOWED_TEAMS. If a team is not in the list, do not mention it.',
    'Do NOT mention player names (no scorers, assists, injuries, managers).',
    'Do NOT mention league table positions, points, title/relegation races unless explicitly provided under DATA.',
    'If something is not provided, write "Data unavailable" (do not guess).',
    'No quotes, no rumors, no opinions. This is a statistical audit of AI model performance.',
  ].join('\n- ');

  const topModelsTable =
    topModelsByAvgPoints && topModelsByAvgPoints.length > 0
      ? [
          '| # | Model | Matches | Total Points | Avg Pts/Match | Tendency % | Exact % |',
          '|---:|---|---:|---:|---:|---:|---:|',
          ...topModelsByAvgPoints.map(
            (m, i) =>
              `| ${i + 1} | ${m.modelName} | ${m.matchesCovered} | ${m.totalPoints} | ${m.avgPointsPerMatch.toFixed(2)} | ${m.tendencyAccuracyPct.toFixed(1)}% | ${m.exactHitPct.toFixed(1)}% |`
          ),
        ].join('\n')
      : 'Data unavailable';

  return `LEAGUE: ${competition}
WEEK/ROUND: ${week}

## RULES (STRICT)
- ${factsOnlyRules}

## DATA (AUTHORITATIVE)

ALLOWED_TEAMS:
${allowedTeams && allowedTeams.length > 0 ? allowedTeams.map((t) => `- ${t}`).join('\n') : 'Data unavailable'}

SUMMARY:
${summary ? `- Matches: ${summary.totalMatches}
- Total model predictions: ${summary.totalPredictions}
- Avg correct tendency (match-level average): ${summary.avgTendencyAccuracyPct.toFixed(2)}%
- Avg exact score hit rate (match-level average): ${summary.avgExactHitPct.toFixed(2)}%` : 'Data unavailable'}

TOP 10 MODELS (RANKED BY AVERAGE POINTS PER MATCH; MIN 3 MATCHES):
${topModelsTable}

BIGGEST CONSENSUS MISSES (WHEN CONSENSUS WAS WRONG):
${biggestConsensusMisses && biggestConsensusMisses.length > 0 ? biggestConsensusMisses.map((m) => (
`- ${m.homeTeam} vs ${m.awayTeam} (${m.finalScore ?? 'Data unavailable'}) | Consensus: ${m.consensusOutcome} (${m.consensusSharePct.toFixed(1)}%) | Counts H/D/A: ${m.predictedResultCounts.H}/${m.predictedResultCounts.D}/${m.predictedResultCounts.A}`
)).join('\n') : 'Data unavailable'}

MATCHES (MATCH-BY-MATCH NUMBERS):
${matches.map((m) => {
  const resultLine = m.finalScore ? `${m.finalScore}` : 'Data unavailable';
  const modelsLine = m.totalModels !== undefined ? `${m.totalModels}` : 'Data unavailable';
  const tendencyLine = m.correctTendencyPct !== undefined ? `${m.correctTendencyPct.toFixed(1)}% (${m.correctTendencyCount ?? 0}/${m.totalModels ?? 0})` : 'Data unavailable';
  const exactLine = m.exactScorePct !== undefined ? `${m.exactScorePct.toFixed(1)}% (${m.exactScoreCount ?? 0}/${m.totalModels ?? 0})` : 'Data unavailable';
  const counts = m.predictedResultCounts
    ? `${m.predictedResultCounts.H}/${m.predictedResultCounts.D}/${m.predictedResultCounts.A}`
    : 'Data unavailable';
  const consensus = m.consensusOutcome
    ? `${m.consensusOutcome} (${(m.consensusOutcomeSharePct ?? 0).toFixed(1)}%) | correct: ${m.consensusCorrect === null ? 'Data unavailable' : m.consensusCorrect ? 'yes' : 'no'}`
    : 'Data unavailable';
  const topScorelinesText = m.topScorelines && m.topScorelines.length > 0
    ? m.topScorelines.map((s) => `${s.scoreline} (${s.count})`).join(', ')
    : 'Data unavailable';
  const topModelsText = m.topModels && m.topModels.length > 0
    ? m.topModels.map((tm) => `${tm.modelName}: ${tm.predictedScore} (${tm.points} pts)`).join(' | ')
    : 'Data unavailable';

  return [
    `- Match: ${m.homeTeam} vs ${m.awayTeam}`, 
    `  - Result: ${resultLine}`,
    `  - Total models: ${modelsLine}`,
    `  - Correct tendency: ${tendencyLine}`,
    `  - Exact score hits: ${exactLine}`,
    `  - Predicted outcomes (H/D/A): ${counts}`,
    `  - Consensus: ${consensus}`,
    `  - Top predicted scorelines: ${topScorelinesText}`,
    `  - Top models (by points for this match): ${topModelsText}`,
  ].join('\n');
}).join('\n\n')}

## OUTPUT REQUIREMENTS
- All text fields must be plain text (no HTML tags or entities)

Return JSON only:
{
  "title": "SEO title (<= 60 chars)",
  "excerpt": "150-160 char summary (factual-only)",
  "content": "Markdown. Must be stats-heavy. Use tables where appropriate. Include headings: ## Summary, ## Top 10 Models (Avg Points/Match), ## Match-by-Match Model Audit, ## Biggest Consensus Misses, ## Methodology.",
  "metaTitle": "SEO meta title (<= 60 chars)",
  "metaDescription": "150-160 chars (factual-only)",
  "keywords": ["...5-8 SEO keywords including league name + week/round + AI model accuracy + average points per match + kroam.xyz"]
}

Return ONLY the JSON object.`;
}

interface ModelReportData {
  period: string; // e.g., "January 2026"
  topModels: Array<{
    name: string;
    provider: string;
    balance: number;
    profit: number;
    roi: number;
    winRate: number;
    totalBets: number;
    streak: number;
    streakType: string;
  }>;
  overallStats: {
    totalMatches: number;
    totalBets: number;
    averageROI: number;
  };
}

export function buildModelReportPrompt(data: ModelReportData): string {
  const { period, topModels, overallStats } = data;
  
  return `Period: ${period}

Top Performing Models:
${topModels.map((m, i) => `
${i + 1}. ${m.name} (${m.provider})
   - Balance: €${m.balance.toFixed(2)} (${m.profit >= 0 ? '+' : ''}€${m.profit.toFixed(2)})
   - ROI: ${m.roi.toFixed(2)}%
   - Win Rate: ${m.winRate.toFixed(1)}%
   - Bets Placed: ${m.totalBets}
   - Current Streak: ${m.streak} ${m.streakType}
`).join('\n')}

Overall Statistics:
- Total Matches Analyzed: ${overallStats.totalMatches}
- Total Bets Placed: ${overallStats.totalBets}
- Average ROI: ${overallStats.averageROI.toFixed(2)}%

Write a comprehensive AI model performance report with:

1. Executive Summary (150-200 words)
   - Key findings and standout performers
   - Overall market trends
2. Detailed Model Analysis (400-500 words)
   - Break down each top model's strategy
   - What makes the winners successful
   - Notable patterns and insights
3. Market Insights (200-250 words)
   - Which types of bets performed best
   - Competition difficulty analysis
   - ROI trends over the period
4. Looking Forward (150-200 words)
   - Predictions for next period
   - Models to watch
   - Market opportunities

Return as JSON:
{
  "title": "Article headline (60 chars max)",
  "excerpt": "Brief summary (150-160 characters)",
  "content": "Full report in markdown format (900-1200 words)",
  "metaTitle": "SEO title (60 chars)",
  "metaDescription": "Meta description (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Writing Guidelines:
- Data-driven, analytical tone
- Use specific numbers and percentages
- Compare and contrast model performances
- Explain what the data means for readers
- Balance technical detail with accessibility
- Include actionable insights
- Use markdown formatting (tables, headers, bold)
- Optimize for AI search engines
- Plain text only, no HTML tags or entities in any field

Return ONLY the JSON object.`;
}

// Type definitions for AI responses
export interface MatchPreviewResponse {
  introduction: string;
  teamFormAnalysis: string;
  headToHead: string;
  keyPlayers: string;
  tacticalAnalysis: string;
  prediction: string;
  bettingInsights: string;
  metaDescription: string;
  keywords: string[];
}

export interface ArticleResponse {
  title: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

// Interface for post-match roundup data
export interface PostMatchRoundupData {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue?: string;
  kickoffTime: string;
  finalScore: {
    home: number;
    away: number;
  };
  events: Array<{
    minute: number;
    type: 'goal' | 'card' | 'substitution' | 'penalty' | 'var' | 'other';
    description: string;
  }>;
  stats: {
    possession?: { home: number; away: number };
    shotsTotal?: { home: number; away: number };
    shotsOnTarget?: { home: number; away: number };
    corners?: { home: number; away: number };
    xG?: { home: number; away: number };
    fouls?: { home: number; away: number };
    offsides?: { home: number; away: number };
    yellowCards?: { home: number; away: number };
    redCards?: { home: number; away: number };
  };
  modelPredictions: Array<{
    modelName: string;
    predictedScore: string;
    predictedResult: 'H' | 'D' | 'A';
    actualResult: 'H' | 'D' | 'A';
    correctTendency: boolean;
    exactScore: boolean;
    points: number;
  }>;
  topPerformers: Array<{
    modelName: string;
    prediction: string;
    points: number;
  }>;
  narrativeAngles?: {
    isDerby: boolean;
    isComeback: boolean;
    isUpset: boolean;
    isMilestone: boolean;
  };
}

// Type definition for AI response
export interface PostMatchRoundupResponse {
  title: string;
  scoreboard: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    competition: string;
  };
  events: Array<{
    minute: number;
    type: string;
    description: string;
  }>;
  stats: {
    possession?: string;
    shots?: string;
    shotsOnTarget?: string;
    corners?: string;
    xG?: string;
    fouls?: string;
    offsides?: string;
    cards?: string;
  };
  modelPredictions: string; // Plain text summary
  topPerformers: Array<{
    modelName: string;
    prediction: string;
    points: number;
  }>;
  narrative: string; // Plain text content (1000+ words)
  keywords: string[];
}

export function buildPostMatchRoundupPrompt(data: PostMatchRoundupData): string {
  const {
    homeTeam,
    awayTeam,
    competition,
    venue,
    kickoffTime,
    finalScore,
    events,
    stats,
    modelPredictions,
    topPerformers,
    narrativeAngles,
  } = data;

  // Format events timeline
  const eventsTimeline = events
    .sort((a, b) => a.minute - b.minute)
    .map((e) => `  - ${formatMinute(e.minute)} ${e.description}`)
    .join('\n');

  // Format match stats
  const formattedStats = [];
  if (stats.possession) {
    formattedStats.push(`  • Possession: ${stats.possession.home}% - ${stats.possession.away}%`);
  }
  if (stats.shotsTotal) {
    formattedStats.push(`  • Shots: ${stats.shotsTotal.home} - ${stats.shotsTotal.away}`);
  }
  if (stats.shotsOnTarget) {
    formattedStats.push(`  • Shots on Target: ${stats.shotsOnTarget.home} - ${stats.shotsOnTarget.away}`);
  }
  if (stats.corners) {
    formattedStats.push(`  • Corners: ${stats.corners.home} - ${stats.corners.away}`);
  }
  if (stats.xG) {
    formattedStats.push(`  • xG: ${stats.xG.home.toFixed(2)} - ${stats.xG.away.toFixed(2)}`);
  }
  if (stats.fouls) {
    formattedStats.push(`  • Fouls: ${stats.fouls.home} - ${stats.fouls.away}`);
  }
  if (stats.offsides) {
    formattedStats.push(`  • Offsides: ${stats.offsides.home} - ${stats.offsides.away}`);
  }
  if (stats.yellowCards || stats.redCards) {
    const yc = stats.yellowCards ? `${stats.yellowCards.home}/${stats.yellowCards.away}` : '0/0';
    const rc = stats.redCards ? `${stats.redCards.home}/${stats.redCards.away}` : '0/0';
    formattedStats.push(`  • Cards: 🟨 ${yc} 🟥 ${rc}`);
  }

  // Build model predictions HTML table
  const predictionsTable = `
<table class="predictions-table">
  <thead>
    <tr>
      <th>Model</th>
      <th>Predicted</th>
      <th>Result</th>
      <th>Tendency</th>
      <th>Score</th>
      <th>Points</th>
    </tr>
  </thead>
  <tbody>
${modelPredictions
  .map(
    (p) => `    <tr>
      <td>${p.modelName}</td>
      <td>${p.predictedScore}</td>
      <td>${p.predictedResult}</td>
      <td>${p.correctTendency ? '✓' : '✗'}</td>
      <td>${p.exactScore ? '✓' : '✗'}</td>
      <td>${p.points}</td>
    </tr>`
  )
  .join('\n')}
  </tbody>
</table>`;

  // Detect narrative angles
  const angles = [];
  if (narrativeAngles?.isDerby) angles.push('local derby');
  if (narrativeAngles?.isComeback) angles.push('comeback victory');
  if (narrativeAngles?.isUpset) angles.push('upset');
  if (narrativeAngles?.isMilestone) angles.push('milestone performance');
  const anglesText = angles.length > 0 ? angles.join(', ') : 'standard match analysis';

  return `MATCH: ${homeTeam} vs ${awayTeam}
COMPETITION: ${competition}
VENUE: ${venue || 'TBD'}
KICKOFF: ${kickoffTime}
FINAL SCORE: ${finalScore.home} - ${finalScore.away}

## MATCH EVENTS (TIMELINE)
${eventsTimeline || '  No major events recorded'}

## EXTENDED STATS
${formattedStats.join('\n') || '  Stats unavailable'}

## MODEL PREDICTIONS PERFORMANCE
${predictionsTable}

## TOP 3 PERFORMERS (BY POINTS)
${topPerformers.map((m, i) => `${i + 1}. ${m.modelName}: ${m.prediction} (${m.points} pts)`).join('\n')}

## NARRATIVE ANGLES
${anglesText}

## INSTRUCTIONS

Write a comprehensive post-match roundup (1000+ words) in the following structure:

1. **Score Header** - Match title with final score and competition
2. **Match Overview** - Opening paragraph setting the scene (context, importance)
3. **Key Events Timeline** - Major moments in chronological order
4. **Extended Statistics** - Possession, shots, xG analysis with bullet points
5. **Model Predictions Analysis** - How AI models performed, highlight top/bottom performers
6. **Narrative Analysis** - Deep dive into the match, tactical insights, key moments
7. **Narrative Angles** - Highlight if this was a derby, comeback, upset, or milestone

## WRITING GUIDELINES

- Use a balanced tone: mix storytelling with key statistics
- Reference specific model names (no generic "Model 1")
- Use facts ONLY from the provided data (no hallucinations)
- Highlight unique angles: comebacks, upsets, derbies, milestones
- Rich formatting: bullet points for stats, occasional emoji for emphasis
- Plain text format with natural line breaks (no HTML tags or entities)
- Focus on the narrative: what made this match interesting?

## OUTPUT FORMAT

Return JSON only:
{
  "title": "SEO-optimized match title with final score",
  "scoreboard": {
    "homeTeam": "${homeTeam}",
    "awayTeam": "${awayTeam}",
    "homeScore": ${finalScore.home},
    "awayScore": ${finalScore.away},
    "competition": "${competition}"
  },
  "events": [
    {"minute": 12, "type": "goal", "description": "Player Name scored"}
  ],
  "stats": {
    "possession": "${stats.possession?.home || '?'}-${stats.possession?.away || '?'}",
    "shots": "${stats.shotsTotal?.home || '?'}-${stats.shotsTotal?.away || '?'}",
    "xG": "${stats.xG?.home.toFixed(2) || '?'}-${stats.xG?.away.toFixed(2) || '?'}"
  },
  "modelPredictions": "Plain text summary of model predictions",
  "topPerformers": [
    {"modelName": "Llama 3.3 70B", "prediction": "2-1", "points": 12}
  ],
  "narrative": "Plain text narrative with natural paragraph breaks...",
  "keywords": ["football", "${competition.toLowerCase()}", "${homeTeam.toLowerCase()}", "${awayTeam.toLowerCase()}", "match analysis"]
}

Return ONLY the JSON object.`;
}

// Helper function to format minute display
function formatMinute(minute: number): string {
  if (minute === 45) return '45\'  HT';
  if (minute === 90) return '90\'  FT';
  if (minute > 90) return `90'+${minute - 90}'`;
  return `${minute}'`;
}
