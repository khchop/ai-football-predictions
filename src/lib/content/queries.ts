/**
 * Database queries for content generation
 */

import { getDb, matches, competitions, matchAnalysis, matchPreviews, bets, models, matchContent, predictions } from '@/lib/db';
import { loggers } from '@/lib/logger/modules';
import { eq, and, gte, lte, inArray, isNull, isNotNull, desc, or, sql } from 'drizzle-orm';
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
 * Get current prediction streak for a model
 * Only returns streak if >= 3 consecutive results
 * Streak = consecutive correct (W) or incorrect (L) predictions
 */
async function getModelCurrentStreak(modelId: string): Promise<{ streak: number; type: 'W' | 'L' }> {
  const db = getDb();

  try {
    // Get last 20 scored predictions ordered by match kickoff time (most recent first)
    const recentPredictions = await db
      .select({
        correct: predictions.tendencyPoints, // NOT NULL = correct, NULL = incorrect
        kickoffTime: matches.kickoffTime,
      })
      .from(predictions)
      .innerJoin(matches, eq(predictions.matchId, matches.id))
      .where(
        and(
          eq(predictions.modelId, modelId),
          eq(predictions.status, 'scored')
        )
      )
      .orderBy(desc(matches.kickoffTime))
      .limit(20);

    if (recentPredictions.length === 0) {
      return { streak: 0, type: 'W' };
    }

    // Count consecutive same results from most recent
    const firstResult = recentPredictions[0].correct !== null;
    let streak = 1;

    for (let i = 1; i < recentPredictions.length; i++) {
      const isCorrect = recentPredictions[i].correct !== null;
      if (isCorrect === firstResult) {
        streak++;
      } else {
        break;
      }
    }

    // Only return if streak >= 3
    if (streak < 3) {
      return { streak: 0, type: 'W' };
    }

    return {
      streak,
      type: firstResult ? 'W' : 'L',
    };
  } catch (error) {
    loggers.content.warn({ modelId, err: error }, 'Failed to calculate model streak');
    return { streak: 0, type: 'W' };
  }
}

/**
 * Get top models for performance report
 */
export async function getTopModelsForReport(limit: number = 10) {
  const db = getDb();
  
  // Get top models by total points with detailed stats
  const leaderboard = await db
    .select({
      id: models.id,
      name: models.displayName,
      provider: models.provider,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(models)
    .leftJoin(
      predictions,
      and(
        eq(predictions.modelId, models.id),
        eq(predictions.status, 'scored')
      )
    )
    .where(eq(models.active, true))
    .groupBy(models.id)
    .orderBy(desc(sql`COALESCE(SUM(${predictions.totalPoints}), 0)`))
    .limit(limit);

  // Transform to report format with streak calculation
  return await Promise.all(
    leaderboard.map(async (m) => {
      const streakData = await getModelCurrentStreak(m.id);
      return {
        id: m.id,
        name: m.name,
        provider: m.provider,
        balance: m.totalPoints,
        profit: m.totalPoints,
        roi:
          m.totalPredictions > 0
            ? ((m.correctTendencies / m.totalPredictions) * 100).toFixed(2)
            : '0.00',
        winRate:
          m.totalPredictions > 0
            ? ((m.correctTendencies / m.totalPredictions) * 100).toFixed(1)
            : '0.0',
        totalBets: m.totalPredictions,
        streak: streakData.streak,
        streakType: streakData.type,
      };
    })
  );
}

/**
 * Get overall model statistics for performance report
 */
export async function getOverallModelStats() {
  const db = getDb();

  const stats = await db
    .select({
      totalMatches: sql<number>`COUNT(DISTINCT ${predictions.matchId})`,
      totalBets: sql<number>`COUNT(${predictions.id})`,
      avgPoints: sql<number>`ROUND(AVG(${predictions.totalPoints})::numeric, 2)`,
    })
    .from(predictions)
    .where(eq(predictions.status, 'scored'));

  return {
    totalMatches: stats[0]?.totalMatches || 0,
    totalBets: stats[0]?.totalBets || 0,
    averageROI: stats[0]?.avgPoints || 0,
  };
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

/**
 * Determine if match result was an upset based on bookmaker odds
 * Upset = winner had highest odds (least expected) AND odds > 2.5
 */
function isUpset(
  homeScore: number | null,
  awayScore: number | null,
  oddsHome: string | null,
  oddsDraw: string | null,
  oddsAway: string | null
): boolean {
  // Can't determine without scores
  if (homeScore === null || awayScore === null) return false;

  // Determine result
  const result = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D';

  // Parse odds
  const home = parseFloat(oddsHome || '');
  const draw = parseFloat(oddsDraw || '');
  const away = parseFloat(oddsAway || '');

  // If any odds missing, can't determine upset
  if (isNaN(home) || isNaN(draw) || isNaN(away)) return false;

  // Get winner's odds
  const winnerOdds = result === 'H' ? home : result === 'A' ? away : draw;
  const maxOdds = Math.max(home, draw, away);

  // Upset = winner had highest odds AND odds > 2.5 threshold
  return winnerOdds === maxOdds && winnerOdds > 2.5;
}

/**
 * Get data for league roundup generation
 * Returns completed matches from past 7 days with predictions and upset analysis
 */
export async function getLeagueRoundupData(competitionId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get finished matches from the past week
  const finishedMatches = await db
    .select({
      match: matches,
      competition: competitions,
      analysis: matchAnalysis,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(matches.status, 'finished'),
        gte(matches.kickoffTime, weekAgo.toISOString()),
        lte(matches.kickoffTime, now.toISOString())
      )
    )
    .orderBy(desc(matches.kickoffTime));

  if (finishedMatches.length === 0) {
    return null;
  }

  // Prefer using the latest round as the "week". If present, only include matches from that round
  // to avoid mixing multiple rounds in a single roundup.
  const latestRound = finishedMatches[0]?.match.round || null;
  const roundupMatches = latestRound
    ? finishedMatches.filter((m) => m.match.round === latestRound)
    : finishedMatches;

  const toOutcome = (home: number, away: number) => (home > away ? 'H' : home < away ? 'A' : 'D');
  const OUTCOMES = ['H', 'D', 'A'] as const;

  // Build detailed per-match stats from scored predictions
  const matchesWithStats = await Promise.all(
    roundupMatches.map(async (item) => {
      const { match, analysis } = item;

      const matchPredictions = await db
        .select({
          modelId: models.id,
          modelName: models.displayName,
          predictedHome: predictions.predictedHome,
          predictedAway: predictions.predictedAway,
          predictedResult: predictions.predictedResult,
          tendencyPoints: predictions.tendencyPoints,
          exactScoreBonus: predictions.exactScoreBonus,
          totalPoints: predictions.totalPoints,
        })
        .from(predictions)
        .innerJoin(models, eq(predictions.modelId, models.id))
        .where(and(eq(predictions.matchId, match.id), eq(predictions.status, 'scored')));

      const totalModels = matchPredictions.length;
      const correctTendencyCount = matchPredictions.filter(
        (p) => p.tendencyPoints !== null && p.tendencyPoints > 0
      ).length;
      const exactScoreCount = matchPredictions.filter(
        (p) => p.exactScoreBonus !== null && p.exactScoreBonus > 0
      ).length;

       const predictedResultCounts = matchPredictions.reduce((acc, p) => {
         const outcome = p.predictedResult as (typeof OUTCOMES)[number];
         acc[outcome] = (acc[outcome] || 0) + 1;
         return acc;
       }, {} as Record<(typeof OUTCOMES)[number], number>);

      const scorelineCounts = matchPredictions.reduce((acc, p) => {
        const key = `${p.predictedHome}-${p.predictedAway}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topScorelines = Object.entries(scorelineCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([scoreline, count]) => ({ scoreline, count }));

      const topModels = [...matchPredictions]
        .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
        .slice(0, 10)
        .map((p) => ({
          modelName: p.modelName,
          predictedScore: `${p.predictedHome}-${p.predictedAway}`,
          predictedResult: p.predictedResult,
          points: p.totalPoints ?? 0,
        }));

      const actualOutcome =
        match.homeScore === null || match.awayScore === null
          ? null
          : toOutcome(match.homeScore, match.awayScore);

       const consensusOutcome = OUTCOMES
         .map((k) => ({ outcome: k, count: predictedResultCounts[k] || 0 }))
         .sort((a, b) => b.count - a.count)[0];

      const consensusOutcomeSharePct =
        totalModels > 0 ? (consensusOutcome.count / totalModels) * 100 : 0;

      return {
        matchId: match.id,
        kickoffTime: match.kickoffTime,
        round: match.round,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        finalScore:
          match.homeScore !== null && match.awayScore !== null
            ? `${match.homeScore}-${match.awayScore}`
            : null,
        totalModels,
        correctTendencyCount,
        correctTendencyPct: totalModels > 0 ? (correctTendencyCount / totalModels) * 100 : 0,
        exactScoreCount,
        exactScorePct: totalModels > 0 ? (exactScoreCount / totalModels) * 100 : 0,
        predictedResultCounts: {
          H: predictedResultCounts.H || 0,
          D: predictedResultCounts.D || 0,
          A: predictedResultCounts.A || 0,
        },
        topScorelines,
        topModels,
        wasUpset: isUpset(
          match.homeScore,
          match.awayScore,
          analysis?.oddsHome || null,
          analysis?.oddsDraw || null,
          analysis?.oddsAway || null
        ),
        actualOutcome,
        consensusOutcome: consensusOutcome.outcome,
        consensusOutcomeSharePct,
        consensusCorrect: actualOutcome ? consensusOutcome.outcome === actualOutcome : null,
      };
    })
  );

  // League-week Top 10 models by average points per match (min 3 matches)
  const predictionsInWindow = await db
    .select({
      modelId: models.id,
      modelName: models.displayName,
      matchId: predictions.matchId,
      totalPoints: predictions.totalPoints,
      tendencyPoints: predictions.tendencyPoints,
      exactScoreBonus: predictions.exactScoreBonus,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(
      and(
        eq(predictions.status, 'scored'),
        inArray(
          predictions.matchId,
          matchesWithStats.map((m) => m.matchId)
        )
      )
    );

  const byModel = predictionsInWindow.reduce((acc, p) => {
    const current = acc.get(p.modelId) || {
      modelId: p.modelId,
      modelName: p.modelName,
      matchIds: new Set<string>(),
      totalPoints: 0,
      correctTendencyCount: 0,
      exactScoreCount: 0,
    };

    current.matchIds.add(p.matchId);
    current.totalPoints += p.totalPoints ?? 0;
    if (p.tendencyPoints !== null && p.tendencyPoints > 0) current.correctTendencyCount += 1;
    if (p.exactScoreBonus !== null && p.exactScoreBonus > 0) current.exactScoreCount += 1;

    acc.set(p.modelId, current);
    return acc;
  }, new Map<
    string,
    {
      modelId: string;
      modelName: string;
      matchIds: Set<string>;
      totalPoints: number;
      correctTendencyCount: number;
      exactScoreCount: number;
    }
  >());

  const topModelsByAvgPoints = [...byModel.values()]
    .map((m) => {
      const matchesCovered = m.matchIds.size;
      const avgPointsPerMatch = matchesCovered > 0 ? m.totalPoints / matchesCovered : 0;
      const totalPredictions = predictionsInWindow.filter((p) => p.modelId === m.modelId).length;
      const tendencyAccuracyPct = totalPredictions > 0 ? (m.correctTendencyCount / totalPredictions) * 100 : 0;
      const exactHitPct = totalPredictions > 0 ? (m.exactScoreCount / totalPredictions) * 100 : 0;
      return {
        modelName: m.modelName,
        matchesCovered,
        totalPoints: m.totalPoints,
        avgPointsPerMatch,
        tendencyAccuracyPct,
        exactHitPct,
      };
    })
    .filter((m) => m.matchesCovered >= 3)
    .sort((a, b) => b.avgPointsPerMatch - a.avgPointsPerMatch)
    .slice(0, 10);

  const biggestConsensusMisses = [...matchesWithStats]
    .filter((m) => m.actualOutcome !== null && m.consensusCorrect === false)
    .sort((a, b) => b.consensusOutcomeSharePct - a.consensusOutcomeSharePct)
    .slice(0, 5)
    .map((m) => ({
      matchId: m.matchId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      finalScore: m.finalScore,
      consensusOutcome: m.consensusOutcome,
      consensusSharePct: m.consensusOutcomeSharePct,
      predictedResultCounts: m.predictedResultCounts,
    }));

  const allowedTeams = Array.from(
    new Set(matchesWithStats.flatMap((m) => [m.homeTeam, m.awayTeam]))
  ).sort();

  const totalMatches = matchesWithStats.length;
  const totalPredictions = matchesWithStats.reduce((sum, m) => sum + m.totalModels, 0);
  const avgTendencyAccuracyPct =
    totalMatches > 0
      ? matchesWithStats.reduce((sum, m) => sum + m.correctTendencyPct, 0) / totalMatches
      : 0;
  const avgExactHitPct =
    totalMatches > 0
      ? matchesWithStats.reduce((sum, m) => sum + m.exactScorePct, 0) / totalMatches
      : 0;

  const week = latestRound || 'Week of ' + new Date(roundupMatches[0].match.kickoffTime).toLocaleDateString();

  return {
    competition: roundupMatches[0].competition.name,
    competitionSlug: roundupMatches[0].competition.slug || roundupMatches[0].competition.id,
    competitionId,
    week,
    allowedTeams,
    summary: {
      totalMatches,
      totalPredictions,
      avgTendencyAccuracyPct,
      avgExactHitPct,
    },
    topModelsByAvgPoints,
    biggestConsensusMisses,
    matches: matchesWithStats,
    standings: undefined,
  };
}
