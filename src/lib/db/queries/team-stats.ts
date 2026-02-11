import { desc, eq, and, or, sql, asc } from 'drizzle-orm';
import { getDb, matches, competitions } from '@/lib/db';

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
  status: string;
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
