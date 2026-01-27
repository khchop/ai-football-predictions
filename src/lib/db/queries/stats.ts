import { desc, eq, and, gte, sql, asc } from 'drizzle-orm';
import { getDb, predictions, matches, models, competitions } from '@/lib/db';
import type { Match, Prediction, Model } from '@/lib/db/schema';

export interface ModelOverallStats {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  scoredPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  exactScores: number;
  correctTendencies: number;
  correctGoalDiffs: number;
  currentStreak: number;
  currentStreakType: string;
  bestStreak: number;
  bestExactStreak: number;
  bestTendencyStreak: number;
}

export interface ModelCompetitionStats {
  modelId: string;
  competitionId: string;
  competitionName: string;
  season: number;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  exactScores: number;
  correctTendencies: number;
}

export interface ModelClubStats {
  modelId: string;
  clubId: string;
  clubName: string;
  season: number;
  isHome: boolean;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface LeaderboardEntry {
  rank: number;
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  avgPoints: number;
  exactScores: number;
  correctTendencies: number;
  accuracy: number;
}

export interface RecentFormEntry {
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  predictedHome: number;
  predictedAway: number;
  tendencyPoints: number | null;
  goalDiffBonus: number | null;
  exactScoreBonus: number | null;
  totalPoints: number | null;
  competitionId: string;
  competitionName: string;
}

export async function getModelOverallStats(modelId: string): Promise<ModelOverallStats | null> {
  const db = getDb();
  
  const modelResult = await db
    .select()
    .from(models)
    .where(eq(models.id, modelId))
    .limit(1);
  
  const model = modelResult[0];
  if (!model) return null;
  
  const stats = await db
    .select({
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      scoredPredictions: sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END)`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      accuracy: sql<number>`COALESCE(ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      correctGoalDiffs: sql<number>`SUM(CASE WHEN ${predictions.goalDiffBonus} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .where(eq(predictions.modelId, modelId));
  
  const stat = stats[0];
  
  return {
    modelId: model.id,
    displayName: model.displayName,
    provider: model.provider,
    totalPredictions: Number(stat?.totalPredictions) || 0,
    scoredPredictions: Number(stat?.scoredPredictions) || 0,
    totalPoints: Number(stat?.totalPoints) || 0,
    avgPoints: Number(stat?.avgPoints) || 0,
    accuracy: Number(stat?.accuracy) || 0,
    exactScores: Number(stat?.exactScores) || 0,
    correctTendencies: Number(stat?.correctTendencies) || 0,
    correctGoalDiffs: Number(stat?.correctGoalDiffs) || 0,
    currentStreak: model.currentStreak || 0,
    currentStreakType: model.currentStreakType || 'none',
    bestStreak: model.bestStreak || 0,
    bestExactStreak: model.bestExactStreak || 0,
    bestTendencyStreak: model.bestTendencyStreak || 0,
  };
}

export async function getModelCompetitionStats(
  modelId: string,
  competitionId: string,
  season?: number
): Promise<ModelCompetitionStats | null> {
  const db = getDb();
  
  const competitionResult = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  
  const competition = competitionResult[0];
  if (!competition) return null;
  
  const seasonFilter = season ?? competition.season;
  
  const stats = await db
    .select({
      competitionId: matches.competitionId,
      competitionName: competitions.name,
      season: competitions.season,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      accuracy: sql<number>`COALESCE(ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(matches.competitionId, competitionId),
        eq(competitions.season, seasonFilter)
      )
    )
    .groupBy(matches.competitionId, competitions.name, competitions.season);
  
  const stat = stats[0];
  if (!stat) return null;
  
  return {
    modelId,
    competitionId: stat.competitionId,
    competitionName: stat.competitionName,
    season: stat.season,
    totalPredictions: Number(stat.totalPredictions),
    totalPoints: Number(stat.totalPoints),
    avgPoints: Number(stat.avgPoints),
    accuracy: Number(stat.accuracy),
    exactScores: Number(stat.exactScores),
    correctTendencies: Number(stat.correctTendencies),
  };
}

export async function getModelClubStats(
  modelId: string,
  clubId: string,
  season?: number,
  isHome?: boolean
): Promise<ModelClubStats | null> {
  const db = getDb();
  
  const teamFilter = isHome === true 
    ? eq(matches.homeTeam, clubId)
    : isHome === false
    ? eq(matches.awayTeam, clubId)
    : undefined;
  
  const seasonFilter = season ? eq(competitions.season, season) : undefined;
  
  const stats = await db
    .select({
      modelId: sql<string>`${modelId}`,
      clubId: sql<string>`${clubId}`,
      clubName: isHome === true ? matches.homeTeam : matches.awayTeam,
      season: competitions.season,
      isHome: sql<boolean>`${isHome !== undefined ? isHome : sql`TRUE`}`,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      accuracy: sql<number>`COALESCE(ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0)`,
      wins: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 AND ((${isHome} = TRUE AND ${matches.homeScore} > ${matches.awayScore}) OR (${isHome} = FALSE AND ${matches.awayScore} > ${matches.homeScore})) THEN 1 ELSE 0 END)`,
      draws: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 AND ${matches.homeScore} = ${matches.awayScore} THEN 1 ELSE 0 END)`,
      losses: sql<number>`SUM(CASE WHEN ${predictions.status} = 'scored' AND ${predictions.tendencyPoints} = 0 THEN 1 ELSE 0 END)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        teamFilter,
        seasonFilter
      )
    )
    .groupBy(matches.homeTeam, matches.awayTeam, competitions.season);
  
  const stat = stats[0];
  if (!stat) return null;
  
  return {
    modelId: stat.modelId,
    clubId: stat.clubId,
    clubName: isHome === true ? stat.clubName : stat.clubName,
    season: stat.season,
    isHome: Boolean(stat.isHome),
    totalPredictions: Number(stat.totalPredictions),
    totalPoints: Number(stat.totalPoints),
    avgPoints: Number(stat.avgPoints),
    accuracy: Number(stat.accuracy),
    wins: Number(stat.wins),
    draws: Number(stat.draws),
    losses: Number(stat.losses),
  };
}

export type LeaderboardMetric = 'avgPoints' | 'totalPoints' | 'exactScores' | 'accuracy';

export async function getLeaderboard(
  limit: number = 30,
  metric: LeaderboardMetric = 'avgPoints'
): Promise<LeaderboardEntry[]> {
  const db = getDb();
  
  const orderByColumn = metric === 'avgPoints' 
    ? desc(sql`COALESCE(AVG(${predictions.totalPoints})::numeric, 0)`)
    : metric === 'totalPoints'
    ? desc(sql`COALESCE(SUM(${predictions.totalPoints}), 0)`)
    : metric === 'exactScores'
    ? desc(sql`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`)
    : desc(sql`ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1)`);
  
  const results = await db
    .select({
      modelId: models.id,
      displayName: models.displayName,
      provider: models.provider,
      totalPredictions: sql<number>`COUNT(${predictions.id})`,
      totalPoints: sql<number>`COALESCE(SUM(${predictions.totalPoints}), 0)`,
      avgPoints: sql<number>`COALESCE(ROUND(AVG(${predictions.totalPoints})::numeric, 2), 0)`,
      exactScores: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
      correctTendencies: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      accuracy: sql<number>`COALESCE(ROUND(100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0)::numeric, 1), 0)`,
    })
    .from(models)
    .leftJoin(predictions, and(
      eq(predictions.modelId, models.id),
      eq(predictions.status, 'scored')
    ))
    .where(eq(models.active, true))
    .groupBy(models.id)
    .orderBy(orderByColumn)
    .limit(limit);
  
  return results.map((r, index) => ({
    rank: index + 1,
    modelId: r.modelId,
    displayName: r.displayName,
    provider: r.provider,
    totalPredictions: Number(r.totalPredictions),
    totalPoints: Number(r.totalPoints),
    avgPoints: Number(r.avgPoints),
    exactScores: Number(r.exactScores),
    correctTendencies: Number(r.correctTendencies),
    accuracy: Number(r.accuracy),
  }));
}

export async function getModelRecentForm(
  modelId: string,
  limit: number = 10,
  season?: number
): Promise<RecentFormEntry[]> {
  const db = getDb();
  
  const seasonFilter = season 
    ? eq(competitions.season, season)
    : undefined;
  
  const results = await db
    .select({
      matchId: matches.id,
      matchDate: matches.kickoffTime,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      predictedHome: predictions.predictedHome,
      predictedAway: predictions.predictedAway,
      tendencyPoints: predictions.tendencyPoints,
      goalDiffBonus: predictions.goalDiffBonus,
      exactScoreBonus: predictions.exactScoreBonus,
      totalPoints: predictions.totalPoints,
      competitionId: matches.competitionId,
      competitionName: competitions.name,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(
      and(
        eq(predictions.modelId, modelId),
        eq(predictions.status, 'scored'),
        seasonFilter
      )
    )
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);
  
  return results.map(r => ({
    matchId: r.matchId,
    matchDate: r.matchDate,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    predictedHome: r.predictedHome,
    predictedAway: r.predictedAway,
    tendencyPoints: r.tendencyPoints,
    goalDiffBonus: r.goalDiffBonus,
    exactScoreBonus: r.exactScoreBonus,
    totalPoints: r.totalPoints,
    competitionId: r.competitionId,
    competitionName: r.competitionName,
  }));
}

export type ViewRefreshScope = 'all' | 'predictions' | 'matches';

export async function refreshStatsViews(
  _scope: ViewRefreshScope = 'all'
): Promise<void> {
  const db = getDb();
  
  await db.execute(sql`NOTIFY pg_notify('stats_refresh', 'refresh');`);
}
