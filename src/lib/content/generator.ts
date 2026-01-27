/**
 * Content Generation Service
 * 
 * Orchestrates AI content generation for match previews, league roundups,
 * and model reports using OpenRouter and Gemini 3 Flash Preview.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, matchPreviews, blogPosts, models } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import type { NewMatchPreview, NewBlogPost } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateWithTogetherAI } from './together-client';
import {
  buildMatchPreviewPrompt,
  buildLeagueRoundupPrompt,
  buildModelReportPrompt,
  type MatchPreviewResponse,
  type ArticleResponse,
} from './prompts';
import { CONTENT_CONFIG } from './config';
import { slugify } from '@/lib/utils/slugify';

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
  
  // Save to database
  const db = getDb();
  const previewId = uuidv4();
  
  const newPreview: NewMatchPreview = {
    id: previewId,
    matchId: matchData.matchId,
    introduction: result.content.introduction,
    teamFormAnalysis: result.content.teamFormAnalysis,
    headToHead: result.content.headToHead,
    keyPlayers: result.content.keyPlayers,
    tacticalAnalysis: result.content.tacticalAnalysis,
    prediction: result.content.prediction,
    bettingInsights: result.content.bettingInsights,
    metaDescription: result.content.metaDescription,
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
      updatedAt: new Date(),
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
  
  // Save to database
  const db = getDb();
  const postId = uuidv4();
  const slug = slugify(
    `${roundupData.competitionSlug}-${roundupData.week}-roundup`
  );

  const newPost: NewBlogPost = {
    id: postId,
    slug,
    title: result.content.title,
    excerpt: result.content.excerpt,
    content: result.content.content,
    contentType: 'league_roundup',
    metaTitle: result.content.metaTitle,
    metaDescription: result.content.metaDescription,
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
      updatedAt: new Date(),
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
  
  // Save to database
  const db = getDb();
  const postId = uuidv4();
  const slug = slugify(`ai-betting-models-report-${reportData.period}`);

  const newPost: NewBlogPost = {
    id: postId,
    slug,
    title: result.content.title,
    excerpt: result.content.excerpt,
    content: result.content.content,
    contentType: 'model_report',
    metaTitle: result.content.metaTitle,
    metaDescription: result.content.metaDescription,
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
      updatedAt: new Date(),
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
