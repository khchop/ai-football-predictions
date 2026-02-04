/**
 * Content Generation Service
 * 
 * Orchestrates AI content generation for match previews, league roundups,
 * and model reports using OpenRouter and Gemini 3 Flash Preview.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, matchPreviews, blogPosts, models, matchContent, matchRoundups } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import type { NewMatchPreview, NewBlogPost, NewMatchRoundup } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithTogetherAI } from './together-client';
import {
  buildMatchPreviewPrompt,
  buildLeagueRoundupPrompt,
  buildModelReportPrompt,
  buildPostMatchRoundupPrompt,
  type MatchPreviewResponse,
  type ArticleResponse,
  type PostMatchRoundupResponse,
  type PostMatchRoundupData,
} from './prompts';
import { CONTENT_CONFIG } from './config';
import { slugify } from '@/lib/utils/slugify';
import { getMatchPredictionsWithAccuracy, getMatchById, getMatchAnalysisByMatchId } from '@/lib/db/queries';
import {
  checkForDuplicates,
  computeContentHash,
  DEDUPLICATION_CONFIG,
} from './deduplication';
import { sanitizeContent, validateNoHtml } from './sanitization';

function normalizePhrase(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize('NFKD')
    // Remove diacritics (e.g. ü -> u)
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    // Keep only word-ish chars and spaces
    .replace(/[^a-z0-9&'\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getProperNounPhrases(text: string) {
  // 2-5 word capitalized phrases, e.g. "Manchester City", "Erling Haaland".
  // NOTE: Use [ \t]+ instead of \s+ to avoid matching across newlines.
  const regex = /\b([A-Z][A-Za-z0-9&'.-]*(?:[ \t]+[A-Z][A-Za-z0-9&'.-]*){1,4})\b/g;
  const found: string[] = [];
  for (const match of text.matchAll(regex)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

function validateLeagueRoundupOutput(input: {
  competition: string;
  week: string;
  allowedTeams?: string[];
  allowedModelNames?: string[];
  title: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}) {
  const text = [input.title, input.excerpt, input.metaTitle, input.metaDescription, input.content].join('\n');

  const allowedTeamsNormalized = (input.allowedTeams || []).map(normalizePhrase);
  const allowedTeams = new Set(allowedTeamsNormalized);
  const allowedModelNames = new Set((input.allowedModelNames || []).map(normalizePhrase));

  const allowlistPhrases = new Set(
    [
      input.competition,
      input.week,
      'kroam.xyz',
      // Common structural headings / phrases
      'ai',
      'ai model',
      'ai model audit',
      'ai model predictions',
      'ai model predictions audit',
      'ai model accuracy audit',
      'ai model performance',
      'predictions',
      'seo',
      'geo',
      'summary',
      'analysis',
      'methodology',
      'top 10 models',
      'avg points/match',
      'average points per match',
      'match-by-match model audit',
      'biggest consensus misses',
      'data unavailable',
      // Common table headers / metrics
      'avg points',
      'avg pts',
      'total points',
      'total models',
      'correct tendency',
      'exact score hits',
      'consensus',
      'consensus outcome',
      'h',
      'd',
      'a',
    ].map(normalizePhrase)
  );

  const isAllowedTeamPhrase = (phrase: string) => {
    const norm = normalizePhrase(phrase);
    if (!norm) return false;
    if (allowedTeams.has(norm)) return true;
    // Allow partial matches to reduce false positives (e.g. "Stade Brestois" vs "Stade Brestois 29")
    if (norm.length < 5) return false;
    return allowedTeamsNormalized.some((t) => t.includes(norm) || norm.includes(t));
  };

  const candidates = getProperNounPhrases(text);
  const suspicious = Array.from(
    new Set(
      candidates.filter((p) => {
        const norm = normalizePhrase(p);
        if (isAllowedTeamPhrase(p)) return false;
        if (allowedModelNames.has(norm)) return false;
        if (allowlistPhrases.has(norm)) return false;
        return true;
      })
    )
  );

  if (suspicious.length > 0) {
    return {
      ok: false,
      error:
        `League roundup validation failed: found disallowed proper-noun phrases ` +
        `(possible hallucinated teams/people). First 15: ${suspicious.slice(0, 15).join(', ')}`,
    };
  }

  return { ok: true as const };
}

/**
 * Generate a match preview using AI
 */
export async function generateMatchPreview(matchData: {
   matchId: string;
   homeTeam: string;
   awayTeam: string;
   competition: string;
   kickoffTime: string;
   venue?: string;
   analysis?: Record<string, unknown>;
   aiPredictions?: Array<{ model: string; prediction: string }>;
}): Promise<string> {
   loggers.content.info({
     matchId: matchData.matchId,
     homeTeam: matchData.homeTeam,
     awayTeam: matchData.awayTeam,
   }, 'Generating match preview');
  
  const systemPrompt = 'You are a professional football analyst writing a match preview for SEO and AI search engines (ChatGPT, Perplexity, Claude).';
  const userPrompt = buildMatchPreviewPrompt({
    homeTeam: matchData.homeTeam,
    awayTeam: matchData.awayTeam,
    competition: matchData.competition,
    kickoffTime: matchData.kickoffTime,
    venue: matchData.venue,
    // Extract analysis data if available
    homeWinPct: matchData.analysis?.homeWinPct as number | undefined,
    drawPct: matchData.analysis?.drawPct as number | undefined,
    awayWinPct: matchData.analysis?.awayWinPct as number | undefined,
    advice: matchData.analysis?.advice as string | undefined,
    homeTeamForm: matchData.analysis?.homeTeamForm as string | undefined,
    awayTeamForm: matchData.analysis?.awayTeamForm as string | undefined,
    homeGoalsScored: matchData.analysis?.homeGoalsScored as number | undefined,
    homeGoalsConceded: matchData.analysis?.homeGoalsConceded as number | undefined,
    awayGoalsScored: matchData.analysis?.awayGoalsScored as number | undefined,
    awayGoalsConceded: matchData.analysis?.awayGoalsConceded as number | undefined,
    oddsHome: matchData.analysis?.oddsHome as string | undefined,
    oddsDraw: matchData.analysis?.oddsDraw as string | undefined,
    oddsAway: matchData.analysis?.oddsAway as string | undefined,
    oddsOver25: matchData.analysis?.oddsOver25 as string | undefined,
    oddsUnder25: matchData.analysis?.oddsUnder25 as string | undefined,
    oddsBttsYes: matchData.analysis?.oddsBttsYes as string | undefined,
    aiPredictions: matchData.aiPredictions,
  });

  const result = await generateWithTogetherAI<MatchPreviewResponse>(systemPrompt, userPrompt);

  // Sanitize all text fields before save
  const introduction = sanitizeContent(result.content.introduction);
  const teamFormAnalysis = sanitizeContent(result.content.teamFormAnalysis);
  const headToHead = sanitizeContent(result.content.headToHead);
  const keyPlayers = sanitizeContent(result.content.keyPlayers);
  const tacticalAnalysis = sanitizeContent(result.content.tacticalAnalysis);
  const prediction = sanitizeContent(result.content.prediction);
  const bettingInsights = sanitizeContent(result.content.bettingInsights);
  const metaDescription = sanitizeContent(result.content.metaDescription);

  // Validate no HTML remains
  validateNoHtml(introduction);
  validateNoHtml(teamFormAnalysis);
  validateNoHtml(headToHead);
  validateNoHtml(keyPlayers);
  validateNoHtml(tacticalAnalysis);
  validateNoHtml(prediction);
  validateNoHtml(bettingInsights);
  validateNoHtml(metaDescription);

  // Save to database
  const db = getDb();
  const previewId = uuidv4();

  const newPreview: NewMatchPreview = {
    id: previewId,
    matchId: matchData.matchId,
    introduction,
    teamFormAnalysis,
    headToHead,
    keyPlayers,
    tacticalAnalysis,
    prediction,
    bettingInsights,
    metaDescription,
    keywords: result.content.keywords.join(', '),
    status: 'published',
    publishedAt: new Date().toISOString(),
    generatedBy: CONTENT_CONFIG.model,
    generationCost: result.cost.toFixed(4),
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
  };

  await db.insert(matchPreviews).values(newPreview).onConflictDoUpdate({
    target: matchPreviews.matchId,
    set: {
      ...newPreview,
      updatedAt: new Date().toISOString(),
    },
  });

   loggers.content.info({
     previewId,
     cost: result.cost,
     tokens: result.usage.totalTokens,
   }, 'Match preview generated');

  return previewId;
}

/**
 * Generate a league roundup article
 */
export async function generateLeagueRoundup(roundupData: {
  competition: string;
  competitionSlug: string;
  competitionId: string;
  week: string;
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
  standings?: Array<{
    position: number;
    team: string;
    points: number;
    played: number;
  }>;
}): Promise<string> {
   loggers.content.info({
     competition: roundupData.competition,
     week: roundupData.week,
   }, 'Generating league roundup');
  
  const systemPrompt = `You are a data analyst writing a factual, stats-heavy weekly audit of AI model predictions for ${roundupData.competition}. Use only the provided data and do not add outside facts.`;
  const userPrompt = buildLeagueRoundupPrompt({
    competition: roundupData.competition,
    competitionSlug: roundupData.competitionSlug,
    week: roundupData.week,
    matches: roundupData.matches,
    allowedTeams: roundupData.allowedTeams,
    summary: roundupData.summary,
    topModelsByAvgPoints: roundupData.topModelsByAvgPoints,
    biggestConsensusMisses: roundupData.biggestConsensusMisses,
    standingsTop5: roundupData.standings?.slice(0, 5),
  });

  const result = await generateWithTogetherAI<ArticleResponse>(systemPrompt, userPrompt);

  const activeModelRows = await getDb()
    .select({ modelName: models.displayName })
    .from(models)
    .where(eq(models.active, true));

  const allowedModelNames = Array.from(
    new Set(
      [
        ...activeModelRows.map((m) => m.modelName),
        ...(roundupData.topModelsByAvgPoints || []).map((m) => m.modelName),
        ...(roundupData.matches || []).flatMap((m) =>
          (m.topModels || []).map((tm: { modelName: string }) => tm.modelName)
        ),
      ].filter(Boolean)
    )
  );

  const validation = validateLeagueRoundupOutput({
    competition: roundupData.competition,
    week: roundupData.week,
    allowedTeams: roundupData.allowedTeams,
    allowedModelNames,
    title: result.content.title,
    excerpt: result.content.excerpt,
    content: result.content.content,
    metaTitle: result.content.metaTitle,
    metaDescription: result.content.metaDescription,
  });

  if (!validation.ok) {
    loggers.content.error(
      {
        competition: roundupData.competition,
        week: roundupData.week,
        error: validation.error,
      },
      'Generated league roundup failed validation'
    );
    throw new Error(validation.error);
  }

  // Sanitize all text fields before save
  const title = sanitizeContent(result.content.title);
  const excerpt = sanitizeContent(result.content.excerpt);
  const content = sanitizeContent(result.content.content);
  const metaTitle = sanitizeContent(result.content.metaTitle);
  const metaDescription = sanitizeContent(result.content.metaDescription);

  // Validate no HTML remains
  validateNoHtml(title);
  validateNoHtml(excerpt);
  validateNoHtml(content);
  validateNoHtml(metaTitle);
  validateNoHtml(metaDescription);

  // Save to database
  const db = getDb();
  const postId = uuidv4();
  const slug = slugify(
    `${roundupData.competitionSlug}-${roundupData.week}-roundup`
  );

  const newPost: NewBlogPost = {
    id: postId,
    slug,
    title,
    excerpt,
    content,
    contentType: 'league_roundup',
    metaTitle,
    metaDescription,
    keywords: result.content.keywords.join(', '),
    competitionId: roundupData.competitionId,
    status: 'published',
    publishedAt: new Date().toISOString(),
    generatedBy: CONTENT_CONFIG.model,
    generationCost: result.cost.toFixed(4),
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
  };

  await db.insert(blogPosts).values(newPost).onConflictDoUpdate({
    target: blogPosts.slug,
    set: {
      ...newPost,
      updatedAt: new Date().toISOString(),
    },
  });

   loggers.content.info({
     postId,
     competition: roundupData.competition,
     cost: result.cost,
     tokens: result.usage.totalTokens,
   }, 'League roundup generated');

  return postId;
}

/**
 * Generate a model performance report
 */
export async function generateModelReport(reportData: {
  period: string;
  topModels: Array<{
    id: string;
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
}): Promise<string> {
   loggers.content.info({
     period: reportData.period,
   }, 'Generating model performance report');
  
  const systemPrompt = 'You are a data analyst writing a performance report on AI football betting models.';
  const userPrompt = buildModelReportPrompt({
    period: reportData.period,
    topModels: reportData.topModels,
    overallStats: reportData.overallStats,
  });

  const result = await generateWithTogetherAI<ArticleResponse>(systemPrompt, userPrompt);

  // Sanitize all text fields before save
  const title = sanitizeContent(result.content.title);
  const excerpt = sanitizeContent(result.content.excerpt);
  const content = sanitizeContent(result.content.content);
  const metaTitle = sanitizeContent(result.content.metaTitle);
  const metaDescription = sanitizeContent(result.content.metaDescription);

  // Validate no HTML remains
  validateNoHtml(title);
  validateNoHtml(excerpt);
  validateNoHtml(content);
  validateNoHtml(metaTitle);
  validateNoHtml(metaDescription);

  // Save to database
  const db = getDb();
  const postId = uuidv4();
  const slug = slugify(`ai-betting-models-report-${reportData.period}`);

  const newPost: NewBlogPost = {
    id: postId,
    slug,
    title,
    excerpt,
    content,
    contentType: 'model_report',
    metaTitle,
    metaDescription,
    keywords: result.content.keywords.join(', '),
    status: 'published',
    publishedAt: new Date().toISOString(),
    generatedBy: CONTENT_CONFIG.model,
    generationCost: result.cost.toFixed(4),
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
  };

  await db.insert(blogPosts).values(newPost).onConflictDoUpdate({
    target: blogPosts.slug,
    set: {
      ...newPost,
      updatedAt: new Date().toISOString(),
    },
  });

   loggers.content.info({
     postId,
     period: reportData.period,
     cost: result.cost,
     tokens: result.usage.totalTokens,
   }, 'Model report generated');

   return postId;
}

/**
 * Generate a post-match roundup for a completed match
 */
export async function generatePostMatchRoundup(matchId: string): Promise<string> {
  loggers.content.info({ matchId }, 'Generating post-match roundup');

  // 1. Fetch match data with competition
  const matchResult = await getMatchById(matchId);
  if (!matchResult) {
    throw new Error(`Match not found: ${matchId}`);
  }

  const { match, competition } = matchResult;

  // Verify match is finished
  if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) {
    throw new Error(`Match not finished: ${matchId} (status: ${match.status})`);
  }

  // 2. Fetch predictions with accuracy data
  const predictions = await getMatchPredictionsWithAccuracy(matchId);

  // 3. Fetch match analysis for events and stats
  const analysis = await getMatchAnalysisByMatchId(matchId);

  // 4. Parse events from analysis
  const events: PostMatchRoundupData['events'] = [];
  
  if (analysis) {
    // Parse events from raw data if available
    const rawEvents = analysis as any;
    
    // Extract goals from score events if available
    if (rawEvents.scoreEvents) {
      try {
        const scoreEvents = typeof rawEvents.scoreEvents === 'string' 
          ? JSON.parse(rawEvents.scoreEvents) 
          : rawEvents.scoreEvents;
        
        scoreEvents.forEach((event: any) => {
          events.push({
            minute: event.time || event.minute || 0,
            type: 'goal',
            description: `${event.scorer || event.homeScorer || event.awayScorer || 'Unknown'} (${event.homeScore}-${event.awayScore})`,
          });
        });
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Extract cards if available
    if (rawEvents.cards) {
      try {
        const cards = typeof rawEvents.cards === 'string'
          ? JSON.parse(rawEvents.cards)
          : rawEvents.cards;

        cards.forEach((card: any) => {
          events.push({
            minute: card.time || card.minute || 0,
            type: card.type === 'yellow' ? 'card' : 'card',
            description: `${card.player || card.name} ${card.type === 'yellow' ? '🟨' : '🟥'}`,
          });
        });
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  // 5. Build extended stats
  const stats: PostMatchRoundupData['stats'] = {};
  
  if (analysis) {
    const rawStats = analysis as any;
    
    // Possession
    if (rawStats.possessionHome || rawStats.possessionAway) {
      stats.possession = {
        home: rawStats.possessionHome || 50,
        away: rawStats.possessionAway || 50,
      };
    }
    
    // Shots
    if (rawStats.shotsHome || rawStats.shotsAway) {
      stats.shotsTotal = {
        home: rawStats.shotsHome || 0,
        away: rawStats.shotsAway || 0,
      };
    }
    
    // Shots on target
    if (rawStats.shotsOnTargetHome || rawStats.shotsOnTargetAway) {
      stats.shotsOnTarget = {
        home: rawStats.shotsOnTargetHome || 0,
        away: rawStats.shotsOnTargetAway || 0,
      };
    }
    
    // Corners
    if (rawStats.cornersHome || rawStats.cornersAway) {
      stats.corners = {
        home: rawStats.cornersHome || 0,
        away: rawStats.cornersAway || 0,
      };
    }
    
    // xG
    if (rawStats.xgHome || rawStats.xgAway) {
      stats.xG = {
        home: parseFloat(rawStats.xgHome) || 0,
        away: parseFloat(rawStats.xgAway) || 0,
      };
    }
    
    // Fouls
    if (rawStats.foulsHome || rawStats.foulsAway) {
      stats.fouls = {
        home: rawStats.foulsHome || 0,
        away: rawStats.foulsAway || 0,
      };
    }
    
    // Offsides
    if (rawStats.offsidesHome || rawStats.offsidesAway) {
      stats.offsides = {
        home: rawStats.offsidesHome || 0,
        away: rawStats.offsidesAway || 0,
      };
    }
    
    // Yellow cards
    if (rawStats.yellowCardsHome || rawStats.yellowCardsAway) {
      stats.yellowCards = {
        home: rawStats.yellowCardsHome || 0,
        away: rawStats.yellowCardsAway || 0,
      };
    }
    
    // Red cards
    if (rawStats.redCardsHome || rawStats.redCardsAway) {
      stats.redCards = {
        home: rawStats.redCardsHome || 0,
        away: rawStats.redCardsAway || 0,
      };
    }
  }

  // 6. Build model predictions table data
  const modelPredictions: PostMatchRoundupData['modelPredictions'] = predictions.map((p) => ({
    modelName: p.modelName,
    predictedScore: `${p.predictedHome}-${p.predictedAway}`,
    predictedResult: p.predictedResult,
    actualResult: p.actualResult,
    correctTendency: p.correctTendency,
    exactScore: p.exactScore,
    points: p.totalPoints,
  }));

  // 7. Identify top 3 performers
  const topPerformers: PostMatchRoundupData['topPerformers'] = predictions
    .filter((p) => p.totalPoints > 0)
    .slice(0, 3)
    .map((p) => ({
      modelName: p.modelName,
      prediction: `${p.predictedHome}-${p.predictedAway}`,
      points: p.totalPoints,
    }));

  // 8. Detect narrative angles
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const homeScore = match.homeScore!;
  const awayScore = match.awayScore!;

  // Derby detection (simple heuristic - teams from same city)
  const derbyCities: Record<string, string[]> = {
    milan: ['AC Milan', 'Inter Milan'],
    london: ['Arsenal', 'Chelsea', 'Tottenham', 'West Ham', 'Crystal Palace', 'Fulham', 'Brentford'],
    manchester: ['Manchester City', 'Manchester United'],
    liverpool: ['Liverpool', 'Everton'],
    madrid: ['Real Madrid', 'Atlético Madrid'],
    barcelona: ['Barcelona', 'Espanyol'],
    glasgow: ['Rangers', 'Celtic'],
    berlin: ['Hertha Berlin', 'Union Berlin'],
    paris: ['Paris Saint-Germain', 'Paris FC'],
  };

  const isDerby = Object.values(derbyCities).some((teams) => {
    const matchTeams = [homeTeam, awayTeam];
    return teams.some((t) => matchTeams.includes(t)) && teams.filter((t) => matchTeams.includes(t)).length >= 2;
  });

  // Comeback detection (trailed then won)
  const isComeback = (() => {
    // If we had halftime data, we could check properly
    // For now, use high-scoring comebacks as proxy
    return homeScore >= 2 && awayScore >= 1 && Math.abs(homeScore - awayScore) <= 2;
  })();

  // Upset detection (lower seed/worse team won)
  // Simplified: away win against popular teams, or any draw with underdog
  const popularTeams = ['Manchester City', 'Real Madrid', 'Barcelona', 'Bayern Munich', 'Liverpool', 'PSG'];
  const isUpset = awayScore > homeScore && popularTeams.includes(homeTeam);

  // Milestone detection (high scoring games, records)
  const isMilestone = homeScore + awayScore >= 6;

  // 9. Build the prompt
  const roundupData: PostMatchRoundupData = {
    homeTeam,
    awayTeam,
    competition: competition.name,
    venue: match.venue || undefined,
    kickoffTime: match.kickoffTime,
    finalScore: {
      home: homeScore,
      away: awayScore,
    },
    events,
    stats,
    modelPredictions,
    topPerformers,
    narrativeAngles: {
      isDerby,
      isComeback,
      isUpset,
      isMilestone,
    },
  };

  const userPrompt = buildPostMatchRoundupPrompt(roundupData);

  const systemPrompt = 'You are a professional football analyst writing post-match roundups for AI model prediction competitions. Generate factual, stats-heavy content with narrative analysis.';

  // 10. Generate with LLM (temperature 0.3-0.5 for factual content)
  const result = await generateWithTogetherAI<PostMatchRoundupResponse>(
    systemPrompt,
    userPrompt,
    0.4, // Temperature 0.3-0.5 for factual content
    4000 // Max tokens for 1000+ word output
  );

  // 11. Validate output
  if (!result.content.narrative || result.content.narrative.length < 500) {
    throw new Error('Generated roundup narrative is too short');
  }

  // 12. Deduplication check
  const deduplicationCheck = await checkForDuplicates(result.content.narrative, matchId);

  if (deduplicationCheck.action === 'skip') {
    // Exact duplicate found - return existing matchId
    loggers.content.info(
      { matchId, reason: deduplicationCheck.reason },
      'Skipping duplicate roundup generation'
    );
    return matchId;
  }

  // Track if we need to regenerate due to similarity
  let needsRegeneration = deduplicationCheck.action === 'regenerate';
  let regenerationAttempts = 0;
  const maxRegenerationAttempts = 2;
  let finalNarrative = result.content.narrative;
  let finalCost = result.cost;
  let finalUsage = result.usage;

  // Regeneration loop for similar content
  while (needsRegeneration && regenerationAttempts < maxRegenerationAttempts) {
    regenerationAttempts++;

    loggers.content.info(
      {
        matchId,
        attempt: regenerationAttempts,
        maxSimilarity: deduplicationCheck.details.maxSimilarity,
      },
      'Regenerating roundup due to high similarity'
    );

    // Build regeneration prompt with different narrative angle
    const angleInstructions = [
      'Take a tactical analysis approach, focusing on formation changes and key moments.',
      'Focus on individual player performances and standout contributions.',
      'Emphasize historical context and season implications.',
      'Provide a statistical deep-dive with comparative analysis.',
    ];

    const angleIndex = (regenerationAttempts - 1) % angleInstructions.length;
    const angleInstruction = angleInstructions[angleIndex];

    // Create modified prompt with different angle
    const regenerationUserPrompt = `${userPrompt}

${angleInstruction}

IMPORTANT: Write this roundup from a completely different angle than typical match reports. Avoid phrases and structures used in standard football journalism.`;

    // Regenerate with LLM
    const regenResult = await generateWithTogetherAI<PostMatchRoundupResponse>(
      systemPrompt,
      regenerationUserPrompt,
      0.5, // Slightly higher temperature for variation
      4000
    );

    // Validate regenerated content
    if (!regenResult.content.narrative || regenResult.content.narrative.length < 500) {
      loggers.content.warn(
        { matchId, attempt: regenerationAttempts },
        'Regenerated content too short, using original'
      );
      break;
    }

    // Check regenerated content for duplicates
    const regenCheck = await checkForDuplicates(regenResult.content.narrative, matchId);

    if (regenCheck.action === 'allow') {
      // Regeneration successful
      finalNarrative = regenResult.content.narrative;
      finalCost = finalCost + regenResult.cost;
      finalUsage = {
        promptTokens: finalUsage.promptTokens + regenResult.usage.promptTokens,
        completionTokens: finalUsage.completionTokens + regenResult.usage.completionTokens,
        totalTokens: finalUsage.totalTokens + regenResult.usage.totalTokens,
      };

      loggers.content.info(
        {
          matchId,
          attempt: regenerationAttempts,
          newSimilarity: regenCheck.details.maxSimilarity,
        },
        'Regeneration successful - content now unique'
      );

      needsRegeneration = false;
    } else if (regenCheck.action === 'skip') {
      // Found exact duplicate in regenerated content
      loggers.content.warn(
        { matchId, attempt: regenerationAttempts },
        'Regenerated content is duplicate - using original'
      );
      needsRegeneration = false;
    } else {
      // Still too similar
      loggers.content.warn(
        {
          matchId,
          attempt: regenerationAttempts,
          maxSimilarity: regenCheck.details.maxSimilarity,
        },
        'Regenerated content still too similar'
      );

      // Update check for next iteration
      deduplicationCheck.details.maxSimilarity = regenCheck.details.maxSimilarity;

      // If max attempts reached, log warning and use original
      if (regenerationAttempts >= maxRegenerationAttempts) {
        loggers.content.warn(
          { matchId, maxSimilarity: regenCheck.details.maxSimilarity },
          'Max regeneration attempts reached - storing with warning flag'
        );
        needsRegeneration = false;
      }
    }
  }

  // 13. Sanitize LLM-generated content before storing
  const sanitizedTitle = sanitizeContent(result.content.title);
  const sanitizedNarrative = sanitizeContent(finalNarrative);
  const sanitizedModelPredictions = sanitizeContent(result.content.modelPredictions);
  const sanitizedTopPerformers = result.content.topPerformers.map((p: { modelName: string; prediction: string; points: number }) => ({
    modelName: sanitizeContent(p.modelName),
    prediction: sanitizeContent(p.prediction),
    points: p.points,
  }));

  // Validate no HTML remains in text fields
  validateNoHtml(sanitizedTitle);
  validateNoHtml(sanitizedNarrative);
  validateNoHtml(sanitizedModelPredictions);
  sanitizedTopPerformers.forEach((p: { modelName: string; prediction: string; points: number }) => {
    validateNoHtml(p.modelName);
    validateNoHtml(p.prediction);
  });

  // Store in matchRoundups table with deduplication data
  const db = getDb();
  const similarityHash = computeContentHash(sanitizedNarrative);

  const newRoundup: NewMatchRoundup = {
    id: uuidv4(),
    matchId,
    title: sanitizedTitle,
    scoreboard: JSON.stringify(result.content.scoreboard),
    events: JSON.stringify(events),
    stats: JSON.stringify(stats),
    modelPredictions: sanitizedModelPredictions,
    topPerformers: JSON.stringify(sanitizedTopPerformers),
    narrative: sanitizedNarrative,
    keywords: result.content.keywords.join(', '),
    similarityHash,
    generationCost: finalCost,
    promptTokens: finalUsage.promptTokens,
    completionTokens: finalUsage.completionTokens,
    generatedBy: CONTENT_CONFIG.model,
    status: 'published',
    publishedAt: new Date(),
  };

  await db.insert(matchRoundups).values(newRoundup).onConflictDoUpdate({
    target: matchRoundups.matchId,
    set: {
      title: newRoundup.title,
      scoreboard: newRoundup.scoreboard,
      events: newRoundup.events,
      stats: newRoundup.stats,
      modelPredictions: newRoundup.modelPredictions,
      topPerformers: newRoundup.topPerformers,
      narrative: newRoundup.narrative,
      keywords: newRoundup.keywords,
      similarityHash: newRoundup.similarityHash,
      generationCost: newRoundup.generationCost,
      promptTokens: newRoundup.promptTokens,
      completionTokens: newRoundup.completionTokens,
      generatedBy: newRoundup.generatedBy,
      status: newRoundup.status,
      publishedAt: newRoundup.publishedAt,
      updatedAt: new Date(),
    },
  });

  // Also update the existing matchContent table for backward compatibility
  // Note: HTML structure is intentional for rendering, but text content inside uses sanitized values
  const roundupHtml = `
<h1>${sanitizedTitle}</h1>

<div class="scoreboard">
  <div class="scoreboard-header">
    <span class="competition">${result.content.scoreboard.competition}</span>
    <span class="venue">${match.venue || ''}</span>
  </div>
  <div class="teams-score">
    <span class="home-team">${result.content.scoreboard.homeTeam}</span>
    <span class="score">${result.content.scoreboard.homeScore} - ${result.content.scoreboard.awayScore}</span>
    <span class="away-team">${result.content.scoreboard.awayTeam}</span>
  </div>
</div>

<div class="match-stats">
  <h2>Match Statistics</h2>
  <ul>
    <li><strong>Possession:</strong> ${result.content.stats.possession || 'N/A'}</li>
    <li><strong>Shots:</strong> ${result.content.stats.shots || 'N/A'}</li>
    <li><strong>Shots on Target:</strong> ${result.content.stats.shotsOnTarget || 'N/A'}</li>
    <li><strong>xG:</strong> ${result.content.stats.xG || 'N/A'}</li>
    <li><strong>Corners:</strong> ${result.content.stats.corners || 'N/A'}</li>
  </ul>
</div>

<div class="model-predictions">
  <h2>AI Model Predictions</h2>
  ${sanitizedModelPredictions}
</div>

<div class="top-performers">
  <h2>Top Performing Models</h2>
  <ul>
    ${sanitizedTopPerformers.map((m: { modelName: string; prediction: string; points: number }, i: number) => `<li>${i + 1}. ${m.modelName}: ${m.prediction} (${m.points} pts)</li>`).join('\n')}
  </ul>
</div>

<div class="narrative">
  <h2>Match Analysis</h2>
  ${sanitizedNarrative}
</div>

<div class="keywords">
  <p><em>Keywords: ${result.content.keywords.join(', ')}</em></p>
</div>
`;

  await db
    .insert(matchContent)
    .values({
      id: uuidv4(),
      matchId,
      postMatchContent: roundupHtml,
      postMatchGeneratedAt: new Date().toISOString(),
      generatedBy: CONTENT_CONFIG.model,
      totalTokens: finalUsage.totalTokens,
      totalCost: finalCost.toFixed(4),
    })
    .onConflictDoUpdate({
      target: matchContent.matchId,
      set: {
        postMatchContent: roundupHtml,
        postMatchGeneratedAt: new Date().toISOString(),
        generatedBy: CONTENT_CONFIG.model,
        totalTokens: finalUsage.totalTokens,
        totalCost: finalCost.toFixed(4),
        updatedAt: new Date().toISOString(),
      },
    });

  loggers.content.info({
    matchId,
    homeTeam,
    awayTeam,
    score: `${homeScore}-${awayScore}`,
    cost: finalCost,
    tokens: finalUsage.totalTokens,
    deduplication: {
      action: deduplicationCheck.action,
      reason: deduplicationCheck.reason,
      similarCount: deduplicationCheck.details.similarCount,
      maxSimilarity: deduplicationCheck.details.maxSimilarity,
      regenerationAttempts,
    },
  }, 'Post-match roundup generated');

  return matchId;
}
