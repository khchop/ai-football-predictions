/**
 * Database queries for content generation
 */

import { getDb, matches, competitions, matchAnalysis, matchPreviews, bets, models } from '@/lib/db';
import { eq, and, gte, lte, isNull, desc } from 'drizzle-orm';
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
  console.log('[ContentGen] getTopModelsForReport not yet implemented');
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
