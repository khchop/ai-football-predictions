import { desc, eq, and, or, sql, asc } from 'drizzle-orm';
import { getDb, matches, competitions, predictions } from '@/lib/db';
import { getLeaderboardWithTrends } from './stats';
import type { LeaderboardEntryWithTrend } from './stats';

export interface TeamStats {
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  homeWins: number;
  homeLosses: number;
  homeDraws: number;
  awayWins: number;
  awayLosses: number;
  awayDraws: number;
  cleanSheets: number;
}

export interface TeamMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  status: string | null;
  kickoffTime: string;
  competitionId: string;
  slug: string | null;
  isHome: boolean;  // Whether the queried team is the home team
}

/**
 * Get team statistics using a single batch aggregation query
 * Avoids N+1 pattern by computing all stats in one DB round-trip
 */
export async function getTeamStats(
  teamName: string,
  options?: {
    competitionId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<TeamStats> {
  const db = getDb();

  // Build WHERE conditions
  const whereConditions: any[] = [
    or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
    eq(matches.status, 'finished'),
  ];

  if (options?.competitionId) {
    whereConditions.push(eq(matches.competitionId, options.competitionId));
  }

  if (options?.dateFrom) {
    whereConditions.push(sql`${matches.kickoffTime} >= ${options.dateFrom}`);
  }

  if (options?.dateTo) {
    whereConditions.push(sql`${matches.kickoffTime} <= ${options.dateTo}`);
  }

  // Single query with CASE WHEN aggregation for all stats
  const stats = await db
    .select({
      totalMatches: sql<number>`COUNT(*)`,
      // W/D/L from team's perspective
      wins: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} > ${matches.awayScore} THEN 1
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} > ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      draws: sql<number>`SUM(CASE
        WHEN ${matches.homeScore} = ${matches.awayScore} THEN 1
        ELSE 0
      END)`,
      losses: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} < ${matches.awayScore} THEN 1
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} < ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      // Goals from team's perspective
      goalsScored: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} THEN ${matches.homeScore}
        WHEN ${matches.awayTeam} = ${teamName} THEN ${matches.awayScore}
        ELSE 0
      END)`,
      goalsConceded: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} THEN ${matches.awayScore}
        WHEN ${matches.awayTeam} = ${teamName} THEN ${matches.homeScore}
        ELSE 0
      END)`,
      // Home/Away splits
      homeWins: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} > ${matches.awayScore} THEN 1
        ELSE 0
      END)`,
      homeDraws: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} = ${matches.awayScore} THEN 1
        ELSE 0
      END)`,
      homeLosses: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.homeScore} < ${matches.awayScore} THEN 1
        ELSE 0
      END)`,
      awayWins: sql<number>`SUM(CASE
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} > ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      awayDraws: sql<number>`SUM(CASE
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.homeScore} = ${matches.awayScore} THEN 1
        ELSE 0
      END)`,
      awayLosses: sql<number>`SUM(CASE
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.awayScore} < ${matches.homeScore} THEN 1
        ELSE 0
      END)`,
      // Clean sheets (goalsConceded = 0)
      cleanSheets: sql<number>`SUM(CASE
        WHEN ${matches.homeTeam} = ${teamName} AND ${matches.awayScore} = 0 THEN 1
        WHEN ${matches.awayTeam} = ${teamName} AND ${matches.homeScore} = 0 THEN 1
        ELSE 0
      END)`,
    })
    .from(matches)
    .where(and(...whereConditions));

  const stat = stats[0];

  // If no matches found, return default stats with zeros
  if (!stat || stat.totalMatches === 0) {
    return {
      totalMatches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      goalsConceded: 0,
      goalDifference: 0,
      avgGoalsScored: 0,
      avgGoalsConceded: 0,
      homeWins: 0,
      homeLosses: 0,
      homeDraws: 0,
      awayWins: 0,
      awayLosses: 0,
      awayDraws: 0,
      cleanSheets: 0,
    };
  }

  const totalMatches = Number(stat.totalMatches);
  const goalsScored = Number(stat.goalsScored);
  const goalsConceded = Number(stat.goalsConceded);

  return {
    totalMatches,
    wins: Number(stat.wins),
    draws: Number(stat.draws),
    losses: Number(stat.losses),
    goalsScored,
    goalsConceded,
    goalDifference: goalsScored - goalsConceded,
    avgGoalsScored: totalMatches > 0 ? Number((goalsScored / totalMatches).toFixed(2)) : 0,
    avgGoalsConceded: totalMatches > 0 ? Number((goalsConceded / totalMatches).toFixed(2)) : 0,
    homeWins: Number(stat.homeWins),
    homeLosses: Number(stat.homeLosses),
    homeDraws: Number(stat.homeDraws),
    awayWins: Number(stat.awayWins),
    awayLosses: Number(stat.awayLosses),
    awayDraws: Number(stat.awayDraws),
    cleanSheets: Number(stat.cleanSheets),
  };
}

/**
 * Get team match history with pagination and filtering
 * Returns matches in chronological order (most recent first for finished, soonest first for upcoming)
 */
export async function getTeamMatches(
  teamName: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
    competitionId?: string;
  }
): Promise<TeamMatch[]> {
  const db = getDb();

  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;

  // Build WHERE conditions
  const whereConditions: any[] = [
    or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
  ];

  if (options?.status) {
    whereConditions.push(eq(matches.status, options.status));
  }

  if (options?.competitionId) {
    whereConditions.push(eq(matches.competitionId, options.competitionId));
  }

  // For upcoming matches, order by kickoffTime ascending (soonest first)
  // For finished matches, order by kickoffTime descending (most recent first)
  const orderDirection = options?.status === 'scheduled' ? asc(matches.kickoffTime) : desc(matches.kickoffTime);

  const results = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeamLogo: matches.homeTeamLogo,
      awayTeamLogo: matches.awayTeamLogo,
      status: matches.status,
      kickoffTime: matches.kickoffTime,
      competitionId: matches.competitionId,
      slug: matches.slug,
      isHome: sql<boolean>`CASE WHEN ${matches.homeTeam} = ${teamName} THEN true ELSE false END`,
    })
    .from(matches)
    .where(and(...whereConditions))
    .orderBy(orderDirection)
    .limit(limit)
    .offset(offset);

  return results.map(r => ({
    matchId: r.matchId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homeTeamLogo: r.homeTeamLogo,
    awayTeamLogo: r.awayTeamLogo,
    status: r.status,
    kickoffTime: r.kickoffTime,
    competitionId: r.competitionId,
    slug: r.slug,
    isHome: r.isHome,
  }));
}

/**
 * Get team form guide (last N results as W/D/L array)
 * Returns in chronological order (oldest first, so form reads left-to-right)
 */
export async function getTeamFormGuide(
  teamName: string,
  n: number = 5
): Promise<('W' | 'D' | 'L')[]> {
  // Fetch last n finished matches for the team
  const recentMatches = await getTeamMatches(teamName, {
    limit: n,
    status: 'finished',
  });

  // Map to W/D/L from team's perspective
  const formResults = recentMatches.map(match => {
    const isHome = match.isHome;
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    if (homeScore === awayScore) {
      return 'D' as const;
    }

    if (isHome) {
      return homeScore > awayScore ? ('W' as const) : ('L' as const);
    } else {
      return awayScore > homeScore ? ('W' as const) : ('L' as const);
    }
  });

  // Reverse to get chronological order (oldest → most recent)
  // So form reads left-to-right as earliest → latest
  return formResults.reverse();
}

export type TeamLeaderboardPeriod = 'all' | 'season' | 'monthly' | 'weekly';

/**
 * Get team-scoped model leaderboard with time period filtering
 * Wraps getLeaderboardWithTrends with clubId filter
 */
export async function getTeamModelLeaderboard(
  teamName: string,
  options?: {
    timePeriod?: TeamLeaderboardPeriod;
    limit?: number;
    includeArchived?: boolean;
  }
): Promise<LeaderboardEntryWithTrend[]> {
  const timePeriod = options?.timePeriod ?? 'all';

  // Map 'season' to dateFrom (current season start ~August)
  // For 'weekly' and 'monthly', use the existing timePeriod support in getLeaderboardWithTrends
  let mappedTimePeriod: 'all' | 'weekly' | 'monthly' = 'all';
  let dateFrom: string | undefined;

  if (timePeriod === 'weekly') {
    mappedTimePeriod = 'weekly';
  } else if (timePeriod === 'monthly') {
    mappedTimePeriod = 'monthly';
  } else if (timePeriod === 'season') {
    // Current season start: August 1 of current or previous year
    const now = new Date();
    const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    dateFrom = `${seasonYear}-08-01`;
  }

  return getLeaderboardWithTrends(options?.limit ?? 42, 'avgPoints', {
    clubId: teamName,
    timePeriod: mappedTimePeriod,
    dateFrom,
    includeArchived: options?.includeArchived,
  });
}

export interface UpcomingMatchWithPredictions {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  kickoffTime: string;
  competitionId: string;
  slug: string | null;
  isHome: boolean;
  predictionCount: number;
  homeWinPct: number;    // percentage of models predicting home win
  drawPct: number;       // percentage predicting draw
  awayWinPct: number;    // percentage predicting away win
  avgPredictedHome: number;  // average predicted home score
  avgPredictedAway: number;  // average predicted away score
}

/**
 * Get upcoming matches with aggregated prediction distribution from all AI models
 * Shows prediction consensus (home win %, draw %, away win %) and average predicted scores
 */
export async function getTeamUpcomingWithPredictions(
  teamName: string,
  limit: number = 5
): Promise<UpcomingMatchWithPredictions[]> {
  const db = getDb();

  // Query scheduled matches for this team with LEFT JOIN on predictions
  const results = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeTeamLogo: matches.homeTeamLogo,
      awayTeamLogo: matches.awayTeamLogo,
      kickoffTime: matches.kickoffTime,
      competitionId: matches.competitionId,
      slug: matches.slug,
      isHome: sql<boolean>`CASE WHEN ${matches.homeTeam} = ${teamName} THEN true ELSE false END`,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
      homeWinCount: sql<number>`SUM(CASE WHEN ${predictions.predictedResult} = 'H' THEN 1 ELSE 0 END)`,
      drawCount: sql<number>`SUM(CASE WHEN ${predictions.predictedResult} = 'D' THEN 1 ELSE 0 END)`,
      awayWinCount: sql<number>`SUM(CASE WHEN ${predictions.predictedResult} = 'A' THEN 1 ELSE 0 END)`,
      avgPredictedHome: sql<number>`COALESCE(AVG(${predictions.predictedHome}), 0)`,
      avgPredictedAway: sql<number>`COALESCE(AVG(${predictions.predictedAway}), 0)`,
    })
    .from(matches)
    .leftJoin(predictions, eq(predictions.matchId, matches.id))
    .where(
      and(
        or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
        eq(matches.status, 'scheduled')
      )
    )
    .groupBy(
      matches.id,
      matches.homeTeam,
      matches.awayTeam,
      matches.homeTeamLogo,
      matches.awayTeamLogo,
      matches.kickoffTime,
      matches.competitionId,
      matches.slug
    )
    .orderBy(asc(matches.kickoffTime))
    .limit(limit);

  // Calculate percentages in TypeScript (safe division)
  return results.map(r => {
    const predictionCount = Number(r.predictionCount);
    const homeWinCount = Number(r.homeWinCount);
    const drawCount = Number(r.drawCount);
    const awayWinCount = Number(r.awayWinCount);

    return {
      matchId: r.matchId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeTeamLogo: r.homeTeamLogo,
      awayTeamLogo: r.awayTeamLogo,
      kickoffTime: r.kickoffTime,
      competitionId: r.competitionId,
      slug: r.slug,
      isHome: r.isHome,
      predictionCount,
      homeWinPct: predictionCount > 0 ? Math.round((homeWinCount / predictionCount) * 100) : 0,
      drawPct: predictionCount > 0 ? Math.round((drawCount / predictionCount) * 100) : 0,
      awayWinPct: predictionCount > 0 ? Math.round((awayWinCount / predictionCount) * 100) : 0,
      avgPredictedHome: Number(Number(r.avgPredictedHome).toFixed(1)),
      avgPredictedAway: Number(Number(r.avgPredictedAway).toFixed(1)),
    };
  });
}

export interface RecentMatchWithAccuracy {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffTime: string;
  competitionId: string;
  slug: string | null;
  isHome: boolean;
  result: 'W' | 'D' | 'L';  // from team's perspective
  predictionCount: number;
  correctPredictions: number;  // models that got tendency right
  accuracyPct: number;        // correctPredictions / predictionCount * 100
  exactScoreCount: number;    // models that got exact score
}

/**
 * Get recent finished matches with per-match prediction accuracy
 * Shows how many models correctly predicted the match tendency and exact score
 */
export async function getTeamRecentWithAccuracy(
  teamName: string,
  limit: number = 10
): Promise<RecentMatchWithAccuracy[]> {
  const db = getDb();

  // Query finished matches with LEFT JOIN on scored predictions
  const results = await db
    .select({
      matchId: matches.id,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeTeamLogo: matches.homeTeamLogo,
      awayTeamLogo: matches.awayTeamLogo,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      kickoffTime: matches.kickoffTime,
      competitionId: matches.competitionId,
      slug: matches.slug,
      isHome: sql<boolean>`CASE WHEN ${matches.homeTeam} = ${teamName} THEN true ELSE false END`,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
      correctPredictions: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
      exactScoreCount: sql<number>`SUM(CASE WHEN ${predictions.exactScoreBonus} = 3 THEN 1 ELSE 0 END)`,
    })
    .from(matches)
    .leftJoin(
      predictions,
      and(
        eq(predictions.matchId, matches.id),
        eq(predictions.status, 'scored')
      )
    )
    .where(
      and(
        or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
        eq(matches.status, 'finished')
      )
    )
    .groupBy(
      matches.id,
      matches.homeTeam,
      matches.awayTeam,
      matches.homeTeamLogo,
      matches.awayTeamLogo,
      matches.homeScore,
      matches.awayScore,
      matches.kickoffTime,
      matches.competitionId,
      matches.slug
    )
    .orderBy(desc(matches.kickoffTime))
    .limit(limit);

  // Calculate result and accuracy percentage in TypeScript
  return results.map(r => {
    const isHome = r.isHome;
    const homeScore = r.homeScore ?? 0;
    const awayScore = r.awayScore ?? 0;
    const predictionCount = Number(r.predictionCount);
    const correctPredictions = Number(r.correctPredictions);
    const exactScoreCount = Number(r.exactScoreCount);

    // Determine result from team's perspective
    let result: 'W' | 'D' | 'L';
    if (homeScore === awayScore) {
      result = 'D';
    } else if (isHome) {
      result = homeScore > awayScore ? 'W' : 'L';
    } else {
      result = awayScore > homeScore ? 'W' : 'L';
    }

    return {
      matchId: r.matchId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeTeamLogo: r.homeTeamLogo,
      awayTeamLogo: r.awayTeamLogo,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      kickoffTime: r.kickoffTime,
      competitionId: r.competitionId,
      slug: r.slug,
      isHome,
      result,
      predictionCount,
      correctPredictions,
      accuracyPct: predictionCount > 0 ? Math.round((correctPredictions / predictionCount) * 100) : 0,
      exactScoreCount,
    };
  });
}

export interface AccuracyTrendPoint {
  weekStart: string;  // ISO date of week start (Monday)
  matchCount: number;
  predictionCount: number;
  correctPredictions: number;
  accuracyPct: number;
}

/**
 * Get weekly aggregated model accuracy for a team over time (for line chart)
 * Returns last 20 weeks of data with accuracy percentage per week
 */
export async function getTeamAccuracyTrend(
  teamName: string
): Promise<AccuracyTrendPoint[]> {
  const db = getDb();

  // Query: group by week, count matches and predictions, sum correct tendencies
  const results = await db
    .select({
      weekStart: sql<string>`DATE_TRUNC('week', ${matches.kickoffTime}::timestamp)::text`,
      matchCount: sql<number>`COUNT(DISTINCT ${matches.id})`,
      predictionCount: sql<number>`COUNT(${predictions.id})`,
      correctPredictions: sql<number>`SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(matches)
    .innerJoin(
      predictions,
      and(
        eq(predictions.matchId, matches.id),
        eq(predictions.status, 'scored')
      )
    )
    .where(
      and(
        or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
        eq(matches.status, 'finished')
      )
    )
    .groupBy(sql`DATE_TRUNC('week', ${matches.kickoffTime}::timestamp)`)
    .orderBy(sql`DATE_TRUNC('week', ${matches.kickoffTime}::timestamp) DESC`)
    .limit(20);

  // Calculate accuracy percentage and reverse to chronological order (oldest → newest)
  return results.reverse().map(r => {
    const predictionCount = Number(r.predictionCount);
    const correctPredictions = Number(r.correctPredictions);

    return {
      weekStart: r.weekStart,
      matchCount: Number(r.matchCount),
      predictionCount,
      correctPredictions,
      accuracyPct: predictionCount > 0 ? Math.round((correctPredictions / predictionCount) * 100) : 0,
    };
  });
}
