/**
 * Content Generation Service
 * 
 * Orchestrates AI content generation for match previews, league roundups,
 * and model reports using OpenRouter and Gemini 3 Flash Preview.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, matchPreviews, blogPosts } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import type { NewMatchPreview, NewBlogPost } from '@/lib/db/schema';
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
    homeTeam: string;
    awayTeam: string;
    result?: string;
    prediction?: string;
    wasUpset?: boolean;
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
  
  const systemPrompt = `You are a professional football journalist writing a weekly league roundup for ${roundupData.competition}.`;
  const userPrompt = buildLeagueRoundupPrompt({
    competition: roundupData.competition,
    competitionSlug: roundupData.competitionSlug,
    week: roundupData.week,
    matches: roundupData.matches,
    standingsTop5: roundupData.standings?.slice(0, 5),
  });

  const result = await generateWithTogetherAI<ArticleResponse>(systemPrompt, userPrompt);
  
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
