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

Return ONLY the JSON object, no additional text.`;
}

interface LeagueRoundupData {
  competition: string;
  competitionSlug: string;
  week: string;
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    result?: string;
    prediction?: string;
    wasUpset?: boolean;
  }>;
  standingsTop5?: Array<{
    position: number;
    team: string;
    points: number;
    played: number;
  }>;
  topScorers?: Array<{
    player: string;
    team: string;
    goals: number;
  }>;
}

export function buildLeagueRoundupPrompt(data: LeagueRoundupData): string {
  const { competition, week, matches, standingsTop5 } = data;
  
  return `Week: ${week}

Matches Covered:
${matches.map(m => {
  let line = `- ${m.homeTeam} vs ${m.awayTeam}`;
  if (m.result) line += ` (${m.result})`;
  if (m.wasUpset) line += ' [UPSET]';
  if (m.prediction) line += ` | Predicted: ${m.prediction}`;
  return line;
}).join('\n')}

${standingsTop5 && standingsTop5.length > 0 ? `
Current Standings (Top 5):
${standingsTop5.map(t => `${t.position}. ${t.team} - ${t.points} pts (${t.played} played)`).join('\n')}
` : ''}

Write a comprehensive league roundup article with:

1. Compelling headline (60 characters max, SEO-optimized)
2. Engaging introduction (2-3 paragraphs, 200-250 words)
3. Match-by-match analysis (300-400 words)
   - Highlight key results and upsets
   - Analyze surprising outcomes
   - Note standout performances
4. League table implications (200-250 words)
   - Title race updates
   - Relegation battle changes
   - European qualification race
5. Looking ahead (150-200 words)
   - Preview next week's key fixtures
   - What to watch for
6. Conclusion (100-150 words)

Return as JSON:
{
  "title": "Article headline (60 chars max)",
  "excerpt": "Brief summary (150-160 characters for meta)",
  "content": "Full article in markdown format (1200-1500 words total)",
  "metaTitle": "SEO title (60 chars)",
  "metaDescription": "Meta description (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Writing Guidelines:
- Professional sports journalism tone
- Use storytelling to engage readers
- Reference specific moments and statistics
- Connect results to broader narratives
- Balance analysis with entertainment
- Optimize for SEO and AI search engines
- Include relevant quotes or manager perspectives when appropriate
- Use markdown formatting (## headers, **bold**, bullet points)

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
