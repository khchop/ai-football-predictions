import { getDb, competitions, matches, models, predictions, matchAnalysis } from './index';
import { eq, and, gte, lte, desc, sql, isNotNull, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { NewCompetition, NewMatch, NewModel, NewPrediction, Match, MatchAnalysis, NewMatchAnalysis } from './schema';
import type { ScoringBreakdown, EnhancedLeaderboardEntry } from '@/types';

// ============= COMPETITIONS =============

export async function upsertCompetition(data: NewCompetition) {
  const db = getDb();
  return db
    .insert(competitions)
    .values(data)
    .onConflictDoUpdate({
      target: competitions.id,
      set: {
        name: data.name,
        apiFootballId: data.apiFootballId,
        season: data.season,
        active: data.active,
      },
    });
}

export async function getActiveCompetitions() {
  const db = getDb();
  return db.select().from(competitions).where(eq(competitions.active, true));
}

// ============= MATCHES =============

export async function upsertMatch(data: Omit<NewMatch, 'id'> & { id?: string }) {
  const db = getDb();
  const id = data.id || uuidv4();
  return db
    .insert(matches)
    .values({ ...data, id })
    .onConflictDoUpdate({
      target: matches.externalId,
      set: {
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        status: data.status,
        updatedAt: new Date().toISOString(),
      },
    });
}

export async function getUpcomingMatches(hoursAhead: number = 48) {
  const db = getDb();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, future.toISOString())
      )
    )
    .orderBy(matches.kickoffTime);
}

export async function getMatchesWithoutPredictions(): Promise<{ match: Match; predictedModelIds: Set<string> }[]> {
  const db = getDb();
  // Get matches that are scheduled and within the prediction window (12h before kickoff)
  const now = new Date();
  const predictionWindow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  
  // Single query with LEFT JOIN to get matches and their predictions in one go
  const matchesWithPredictions = await db
    .select({
      match: matches,
      modelId: predictions.modelId,
    })
    .from(matches)
    .leftJoin(predictions, eq(matches.id, predictions.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        lte(matches.kickoffTime, predictionWindow.toISOString()),
        gte(matches.kickoffTime, now.toISOString())
      )
    );

  // Group predictions by match
  const matchMap = new Map<string, { match: Match; predictedModelIds: Set<string> }>();
  
  for (const row of matchesWithPredictions) {
    if (!matchMap.has(row.match.id)) {
      matchMap.set(row.match.id, {
        match: row.match,
        predictedModelIds: new Set(),
      });
    }
    
    if (row.modelId) {
      matchMap.get(row.match.id)!.predictedModelIds.add(row.modelId);
    }
  }
  
  return Array.from(matchMap.values());
}

export async function getMatchesPendingResults() {
  const db = getDb();
  // Get matches that are scheduled/live and kickoff was more than 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  return db
    .select()
    .from(matches)
    .where(
      and(
        sql`${matches.status} IN ('scheduled', 'live')`,
        lte(matches.kickoffTime, twoHoursAgo.toISOString())
      )
    );
}

export async function getMatchById(id: string) {
  const db = getDb();
  const result = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, id))
    .limit(1);
  
  return result[0];
}

export async function getMatchWithPredictions(matchId: string) {
  const db = getDb();
  const matchResult = await getMatchById(matchId);
  if (!matchResult) return null;

  const matchPredictions = await db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);

  return {
    ...matchResult,
    predictions: matchPredictions,
  };
}

export async function getRecentMatches(limit: number = 20) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

export async function getFinishedMatches(limit: number = 100) {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.status, 'finished'))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: string,
  matchMinute?: string | null
) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      homeScore,
      awayScore,
      status,
      matchMinute: matchMinute ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(matches.id, matchId));
}

// Get all currently live matches
export async function getLiveMatches() {
  const db = getDb();
  return db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.status, 'live'))
    .orderBy(matches.kickoffTime);
}

// Get count of live matches (for tab badge)
export async function getLiveMatchCount(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(eq(matches.status, 'live'));
  return result[0]?.count || 0;
}

// ============= MODELS =============

export async function upsertModel(data: NewModel) {
  const db = getDb();
  return db
    .insert(models)
    .values(data)
    .onConflictDoUpdate({
      target: models.id,
      set: {
        modelName: data.modelName,
        displayName: data.displayName,
        isPremium: data.isPremium,
        active: data.active,
      },
    });
}

export async function getActiveModels() {
  const db = getDb();
  return db.select().from(models).where(eq(models.active, true));
}

export async function getModelById(id: string) {
  const db = getDb();
  const result = await db.select().from(models).where(eq(models.id, id)).limit(1);
  return result[0];
}

// ============= PREDICTIONS =============

export async function createPrediction(data: Omit<NewPrediction, 'id'>) {
  const db = getDb();
  const id = uuidv4();
  // Use onConflictDoNothing to prevent duplicate predictions for same match+model
  // The unique index idx_predictions_match_model enforces this constraint
  return db
    .insert(predictions)
    .values({ ...data, id })
    .onConflictDoNothing();
}

export async function getPredictionsForMatch(matchId: string) {
  const db = getDb();
  return db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);
}

export async function getPredictionsByModel(modelId: string, limit: number = 100) {
  const db = getDb();
  return db
    .select({
      prediction: predictions,
      match: matches,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(eq(predictions.modelId, modelId))
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
}

// ============= LEADERBOARD =============

export async function getLeaderboard() {
  const db = getDb();
  // Get all predictions for finished matches
  const finishedPredictions = await db
    .select({
      modelId: predictions.modelId,
      displayName: models.displayName,
      provider: models.provider,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      actualHomeScore: matches.homeScore,
      actualAwayScore: matches.awayScore,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  // Calculate stats per model
  const modelStats = new Map<string, {
    modelId: string;
    displayName: string;
    provider: string;
    totalPredictions: number;
    exactScores: number;
    correctResults: number;
    totalPoints: number;
  }>();

  for (const pred of finishedPredictions) {
    if (pred.actualHomeScore === null || pred.actualAwayScore === null) continue;

    const stats = modelStats.get(pred.modelId) || {
      modelId: pred.modelId,
      displayName: pred.displayName,
      provider: pred.provider,
      totalPredictions: 0,
      exactScores: 0,
      correctResults: 0,
      totalPoints: 0,
    };

    stats.totalPredictions++;

    const isExact = 
      pred.predictedHomeScore === pred.actualHomeScore && 
      pred.predictedAwayScore === pred.actualAwayScore;
    
    const predictedResult = pred.predictedHomeScore > pred.predictedAwayScore ? 'H' : 
                           pred.predictedHomeScore < pred.predictedAwayScore ? 'A' : 'D';
    const actualResult = pred.actualHomeScore > pred.actualAwayScore ? 'H' :
                        pred.actualHomeScore < pred.actualAwayScore ? 'A' : 'D';
    
    const isCorrectResult = predictedResult === actualResult;

    if (isExact) {
      stats.exactScores++;
      stats.totalPoints += 3;
    } else if (isCorrectResult) {
      stats.correctResults++;
      stats.totalPoints += 1;
    }

    modelStats.set(pred.modelId, stats);
  }

  // Convert to array and calculate percentages
  const leaderboard = Array.from(modelStats.values())
    .map(stats => ({
      ...stats,
      exactScorePercent: stats.totalPredictions > 0 
        ? Math.round((stats.exactScores / stats.totalPredictions) * 1000) / 10 
        : 0,
      correctResultPercent: stats.totalPredictions > 0 
        ? Math.round(((stats.exactScores + stats.correctResults) / stats.totalPredictions) * 1000) / 10 
        : 0,
      averagePoints: stats.totalPredictions > 0 
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100 
        : 0,
    }))
    .sort((a, b) => {
      // Sort by average points, then by total points, then by total predictions
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalPredictions - a.totalPredictions;
    });

  return leaderboard;
}

// ============= STATS =============

export async function getOverallStats() {
  const db = getDb();
  const totalMatchesResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches);
  
  const finishedMatchesResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(eq(matches.status, 'finished'));
  
  const totalPredictionsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictions);
  
  const activeModelsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(models)
    .where(eq(models.active, true));

  return {
    totalMatches: totalMatchesResult[0]?.count || 0,
    finishedMatches: finishedMatchesResult[0]?.count || 0,
    totalPredictions: totalPredictionsResult[0]?.count || 0,
    activeModels: activeModelsResult[0]?.count || 0,
  };
}

// ============= MATCH ANALYSIS =============

export async function upsertMatchAnalysis(data: NewMatchAnalysis) {
  const db = getDb();
  return db
    .insert(matchAnalysis)
    .values(data)
    .onConflictDoUpdate({
      target: matchAnalysis.matchId, // Fixed: was matchAnalysis.id
      set: {
        favoriteTeamId: data.favoriteTeamId,
        favoriteTeamName: data.favoriteTeamName,
        homeWinPct: data.homeWinPct,
        drawPct: data.drawPct,
        awayWinPct: data.awayWinPct,
        advice: data.advice,
        formHomePct: data.formHomePct,
        formAwayPct: data.formAwayPct,
        attackHomePct: data.attackHomePct,
        attackAwayPct: data.attackAwayPct,
        defenseHomePct: data.defenseHomePct,
        defenseAwayPct: data.defenseAwayPct,
        homeTeamForm: data.homeTeamForm,
        awayTeamForm: data.awayTeamForm,
        homeGoalsScored: data.homeGoalsScored,
        homeGoalsConceded: data.homeGoalsConceded,
        awayGoalsScored: data.awayGoalsScored,
        awayGoalsConceded: data.awayGoalsConceded,
        oddsHome: data.oddsHome,
        oddsDraw: data.oddsDraw,
        oddsAway: data.oddsAway,
        likelyScores: data.likelyScores,
        homeInjuriesCount: data.homeInjuriesCount,
        awayInjuriesCount: data.awayInjuriesCount,
        keyInjuries: data.keyInjuries,
        homeFormation: data.homeFormation,
        awayFormation: data.awayFormation,
        homeStartingXI: data.homeStartingXI,
        awayStartingXI: data.awayStartingXI,
        homeCoach: data.homeCoach,
        awayCoach: data.awayCoach,
        lineupsAvailable: data.lineupsAvailable,
        lineupsUpdatedAt: data.lineupsUpdatedAt,
        rawPredictionsData: data.rawPredictionsData,
        rawInjuriesData: data.rawInjuriesData,
        rawOddsData: data.rawOddsData,
        rawLineupsData: data.rawLineupsData,
        analysisUpdatedAt: data.analysisUpdatedAt,
      },
    });
}

export async function getMatchAnalysisByMatchId(matchId: string): Promise<MatchAnalysis | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(matchAnalysis)
    .where(eq(matchAnalysis.matchId, matchId))
    .limit(1);
  return result[0] || null;
}

export async function updateMatchAnalysisLineups(
  matchId: string,
  lineups: {
    homeFormation: string | null;
    awayFormation: string | null;
    homeStartingXI: string | null;
    awayStartingXI: string | null;
    homeCoach: string | null;
    awayCoach: string | null;
    lineupsAvailable: boolean;
    lineupsUpdatedAt: string;
    rawLineupsData: string | null;
  }
) {
  const db = getDb();
  return db
    .update(matchAnalysis)
    .set(lineups)
    .where(eq(matchAnalysis.matchId, matchId));
}

// Get matches that need analysis fetched (kickoff within 6 hours, no analysis yet)
export async function getMatchesNeedingAnalysis(): Promise<Match[]> {
  const db = getDb();
  const now = new Date();
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  
  // Get matches with analysis status
  const matchesWithAnalysis = await db
    .select({
      match: matches,
      hasAnalysis: sql<boolean>`CASE WHEN ${matchAnalysis.id} IS NOT NULL THEN 1 ELSE 0 END`,
    })
    .from(matches)
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, sixHoursFromNow.toISOString())
      )
    );

  // Filter to only matches without analysis
  return matchesWithAnalysis
    .filter(m => !m.hasAnalysis)
    .map(m => m.match);
}

// Get matches that need lineups fetched (kickoff within 1 hour, lineups not available)
export async function getMatchesNeedingLineups(): Promise<Array<Match & { analysisId: string }>> {
  const db = getDb();
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  
  const result = await db
    .select({
      match: matches,
      analysisId: matchAnalysis.id,
      lineupsAvailable: matchAnalysis.lineupsAvailable,
    })
    .from(matches)
    .innerJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, oneHourFromNow.toISOString()),
        eq(matchAnalysis.lineupsAvailable, false)
      )
    );

  return result.map(r => ({ ...r.match, analysisId: r.analysisId }));
}

// Get matches ready for prediction (kickoff within 30 min OR within 5 min if no predictions yet)
export async function getMatchesReadyForPrediction(): Promise<Array<{
  match: Match;
  competition: { id: string; name: string };
  analysis: MatchAnalysis | null;
  hasPredictions: boolean;
}>> {
  const db = getDb();
  const now = new Date();
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const fiveMinsFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  // Single query: Get matches with their analysis and prediction counts
  const matchesInWindow = await db
    .select({
      match: matches,
      competition: competitions,
      analysis: matchAnalysis,
      predictionCount: sql<number>`(
        SELECT COUNT(*) FROM predictions p WHERE p.match_id = ${matches.id}
      )`,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(matchAnalysis, eq(matches.id, matchAnalysis.matchId))
    .where(
      and(
        eq(matches.status, 'scheduled'),
        gte(matches.kickoffTime, now.toISOString()),
        lte(matches.kickoffTime, thirtyMinsFromNow.toISOString())
      )
    );

  const result: Array<{
    match: Match;
    competition: { id: string; name: string };
    analysis: MatchAnalysis | null;
    hasPredictions: boolean;
  }> = [];

  for (const row of matchesInWindow) {
    const hasPredictions = (row.predictionCount || 0) > 0;
    
    // If match has predictions, skip (predictions already generated)
    if (hasPredictions) {
      continue;
    }
    
    // Check if we should generate predictions now
    const kickoff = new Date(row.match.kickoffTime);
    const isWithin5Mins = kickoff <= fiveMinsFromNow;
    const hasLineups = row.analysis?.lineupsAvailable === true;
    
    // Generate if:
    // 1. We have lineups (preferred), OR
    // 2. We're within 5 mins of kickoff (fallback)
    if (hasLineups || isWithin5Mins) {
      result.push({
        match: row.match,
        competition: { id: row.competition.id, name: row.competition.name },
        analysis: row.analysis,
        hasPredictions: false,
      });
    }
  }

  return result;
}

// ============= PREDICTION SCORING =============

export async function updatePredictionScores(
  predictionId: string,
  scores: ScoringBreakdown
) {
  const db = getDb();
  return db
    .update(predictions)
    .set({
      pointsExactScore: scores.exactScore,
      pointsResult: scores.result,
      pointsGoalDiff: scores.goalDiff,
      pointsOverUnder: scores.overUnder,
      pointsBtts: scores.btts,
      pointsUpsetBonus: scores.upsetBonus,
      pointsTotal: scores.total,
    })
    .where(eq(predictions.id, predictionId));
}

export async function setMatchUpset(matchId: string, isUpset: boolean) {
  const db = getDb();
  return db
    .update(matches)
    .set({
      isUpset,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(matches.id, matchId));
}

// ============= ENHANCED LEADERBOARD =============

export async function getEnhancedLeaderboard(): Promise<EnhancedLeaderboardEntry[]> {
  const db = getDb();
  
  // Get all predictions for finished matches with their scores
  const finishedPredictions = await db
    .select({
      modelId: predictions.modelId,
      displayName: models.displayName,
      provider: models.provider,
      pointsExactScore: predictions.pointsExactScore,
      pointsResult: predictions.pointsResult,
      pointsGoalDiff: predictions.pointsGoalDiff,
      pointsOverUnder: predictions.pointsOverUnder,
      pointsBtts: predictions.pointsBtts,
      pointsUpsetBonus: predictions.pointsUpsetBonus,
      pointsTotal: predictions.pointsTotal,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, 'finished'),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore)
      )
    );

  // Aggregate stats per model
  const modelStats = new Map<string, EnhancedLeaderboardEntry>();

  for (const pred of finishedPredictions) {
    const stats = modelStats.get(pred.modelId) || {
      modelId: pred.modelId,
      displayName: pred.displayName,
      provider: pred.provider,
      totalPredictions: 0,
      totalPoints: 0,
      averagePoints: 0,
      pointsExactScore: 0,
      pointsResult: 0,
      pointsGoalDiff: 0,
      pointsOverUnder: 0,
      pointsBtts: 0,
      pointsUpsetBonus: 0,
      exactScores: 0,
      correctResults: 0,
      correctGoalDiffs: 0,
      correctOverUnders: 0,
      correctBtts: 0,
      upsetsCalled: 0,
    };

    stats.totalPredictions++;
    stats.totalPoints += pred.pointsTotal || 0;
    stats.pointsExactScore += pred.pointsExactScore || 0;
    stats.pointsResult += pred.pointsResult || 0;
    stats.pointsGoalDiff += pred.pointsGoalDiff || 0;
    stats.pointsOverUnder += pred.pointsOverUnder || 0;
    stats.pointsBtts += pred.pointsBtts || 0;
    stats.pointsUpsetBonus += pred.pointsUpsetBonus || 0;

    // Count categories achieved
    if ((pred.pointsExactScore || 0) > 0) stats.exactScores++;
    if ((pred.pointsResult || 0) > 0) stats.correctResults++;
    if ((pred.pointsGoalDiff || 0) > 0) stats.correctGoalDiffs++;
    if ((pred.pointsOverUnder || 0) > 0) stats.correctOverUnders++;
    if ((pred.pointsBtts || 0) > 0) stats.correctBtts++;
    if ((pred.pointsUpsetBonus || 0) > 0) stats.upsetsCalled++;

    modelStats.set(pred.modelId, stats);
  }

  // Calculate averages and sort
  const leaderboard = Array.from(modelStats.values())
    .map(stats => ({
      ...stats,
      averagePoints: stats.totalPredictions > 0
        ? Math.round((stats.totalPoints / stats.totalPredictions) * 100) / 100
        : 0,
    }))
    .sort((a, b) => {
      // Sort by average points, then total points, then total predictions
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.totalPredictions - a.totalPredictions;
    });

  return leaderboard;
}

// Get match with analysis data
export async function getMatchWithAnalysis(matchId: string) {
  const db = getDb();
  
  const matchResult = await db
    .select({
      match: matches,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchResult[0]) return null;

  const analysis = await getMatchAnalysisByMatchId(matchId);
  
  const matchPredictions = await db
    .select({
      prediction: predictions,
      model: models,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(models.displayName);

  return {
    ...matchResult[0],
    analysis,
    predictions: matchPredictions,
  };
}
