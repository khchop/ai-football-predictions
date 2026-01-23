/**
 * Database queries for content generation
 */

import { getDb, matches, competitions, matchAnalysis, matchPreviews, bets, models, matchContent, predictions } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import { eq, and, gte, lte, isNull, isNotNull, desc, or } from 'drizzle-orm';
import { CONTENT_CONFIG } from './config';

/**
 * Get matches that need previews generated
 * Returns matches 6 hours before kickoff that don't have previews yet
 */
export async function getMatchesNeedingPreviews() {
  const db = getDb();
  const now = new Date();
  
  // Calculate time window: between 1 and 6 hours from now
  const minTime = new Date(
    now.getTime() + CONTENT_CONFIG.contentTypes.matchPreview.minHoursBeforeKickoff * 60 * 60 * 1000
  );
  const maxTime = new Date(
    now.getTime() + CONTENT_CONFIG.contentTypes.matchPreview.hoursBeforeKickoff * 60 * 60 * 1000
  );

  // Get matches without previews in the time window
  const result = await db
    .select({
      match: matches,
      competition: competitions,
      analysis: matchAnalysis,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(matchPreviews, eq(matches.id, matchPreviews.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, minTime.toISOString()),
        lte(matches.kickoffTime, maxTime.toISOString()),
        isNull(matchPreviews.id) // No preview exists yet
      )
    )
    .orderBy(matches.kickoffTime);

  return result;
}

/**
 * Get AI model predictions for a match
 */
export async function getMatchBetsForPreview(matchId: string) {
  const db = getDb();
  
  const result = await db
    .select({
      modelName: models.displayName,
      betType: bets.betType,
      selection: bets.selection,
      odds: bets.odds,
      stake: bets.stake,
    })
    .from(bets)
    .innerJoin(models, eq(bets.modelId, models.id))
    .where(eq(bets.matchId, matchId))
    .orderBy(models.displayName, bets.betType);

  // Format predictions for the prompt
  return result.map(bet => ({
    model: bet.modelName,
    prediction: `${bet.betType}: ${bet.selection} @${bet.odds}`,
  }));
}

/**
 * Get completed matches for league roundup
 * Returns matches from the past week for a specific competition
 */
export async function getMatchesForLeagueRoundup(competitionId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await db
    .select({
      match: matches,
    })
    .from(matches)
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(matches.status, 'finished'),
        gte(matches.kickoffTime, weekAgo.toISOString())
      )
    )
    .orderBy(desc(matches.kickoffTime));

  return result.map(r => r.match);
}

/**
 * Get top models for performance report
 */
export async function getTopModelsForReport(season: string, limit: number = 5) {
   const db = getDb();
   
   // This would ideally use model_balances table
   // For now, return a placeholder that can be implemented later
   loggers.content.debug({ season, limit }, 'getTopModelsForReport not yet implemented');
   return [];
 }

/**
 * Check if a match already has a preview
 */
export async function hasMatchPreview(matchId: string): Promise<boolean> {
  const db = getDb();
  
  const result = await db
    .select({ id: matchPreviews.id })
    .from(matchPreviews)
    .where(eq(matchPreviews.matchId, matchId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get match preview by match ID
 */
export async function getMatchPreview(matchId: string) {
  const db = getDb();
  
  const result = await db
    .select()
    .from(matchPreviews)
    .where(eq(matchPreviews.matchId, matchId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get match content (3-section narrative for match pages)
 */
export async function getMatchContent(matchId: string) {
  const db = getDb();
  const { matchContent: mc } = await import('@/lib/db/schema');
  
  const result = await db
    .select()
    .from(mc)
    .where(eq(mc.matchId, matchId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get scheduled matches with odds but missing pre-match content
 * For backfill: finds matches within hoursAhead that have odds but no preMatchContent
 */
export async function getMatchesMissingPreMatchContent(hoursAhead: number = 24) {
  const db = getDb();
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const result = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      kickoffTime: matches.kickoffTime,
    })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .leftJoin(matchContent, eq(matches.id, matchContent.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, targetTime.toISOString()),
        isNotNull(matchAnalysis.oddsHome), // Has odds data
        or(
          isNull(matchContent.id), // No content record exists
          isNull(matchContent.preMatchContent) // Or pre-match content is null
        )
      )
    )
    .orderBy(matches.kickoffTime);

  return result;
}

/**
 * Get scheduled matches with predictions but missing betting content
 * For backfill: finds matches within hoursAhead that have predictions but no bettingContent
 */
export async function getMatchesMissingBettingContent(hoursAhead: number = 24) {
  const db = getDb();
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const result = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      kickoffTime: matches.kickoffTime,
    })
    .from(matches)
    .innerJoin(predictions, eq(matches.id, predictions.matchId))
    .leftJoin(matchContent, eq(matches.id, matchContent.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, targetTime.toISOString()),
        or(
          isNull(matchContent.id), // No content record exists
          isNull(matchContent.bettingContent) // Or betting content is null
        )
      )
    )
    .groupBy(matches.id)
    .orderBy(matches.kickoffTime);

  return result;
}

/**
 * Get finished matches with scored predictions but missing post-match content
 * For backfill: finds matches finished within daysBack that have scored predictions but no postMatchContent
 */
export async function getMatchesMissingPostMatchContent(daysBack: number = 7) {
  const db = getDb();
  const now = new Date();
  const daysAgo = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const result = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
    })
    .from(matches)
    .innerJoin(predictions, eq(matches.id, predictions.matchId))
    .leftJoin(matchContent, eq(matches.id, matchContent.matchId))
    .where(
      and(
        eq(matches.status, 'finished'),
        gte(matches.kickoffTime, daysAgo.toISOString()),
        lte(matches.kickoffTime, now.toISOString()),
        eq(predictions.status, 'scored'), // Predictions have been scored
        or(
          isNull(matchContent.id), // No content record exists
          isNull(matchContent.postMatchContent) // Or post-match content is null
        )
      )
    )
    .groupBy(matches.id)
    .orderBy(desc(matches.kickoffTime));

  return result;
}
