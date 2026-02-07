import { getDb, matches } from '@/lib/db/index';
import { and, gte, lte, eq } from 'drizzle-orm';
import { getAnalysisQueue, getPredictionsQueue } from '@/lib/queue/index';
import { MatchCoverageResult, MatchGap } from './types';
import { loggers } from '@/lib/logger/modules';

/**
 * Calculate pipeline coverage for upcoming scheduled matches.
 *
 * @param hoursAhead - Time window to check (default: 6 hours)
 * @returns Coverage percentage, total/covered match counts, and gap details
 */
export async function getMatchCoverage(hoursAhead: number = 6): Promise<MatchCoverageResult> {
  const log = loggers.api.child({ module: 'pipeline-coverage' });

  try {
    // Calculate time window
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    log.debug({ hoursAhead, now: now.toISOString(), future: future.toISOString() }, 'Calculating pipeline coverage');

    // Query upcoming scheduled matches
    const db = getDb();
    const upcomingMatches = await db
      .select({
        id: matches.id,
        homeTeam: matches.homeTeam,
        awayTeam: matches.awayTeam,
        kickoffTime: matches.kickoffTime,
      })
      .from(matches)
      .where(
        and(
          eq(matches.status, 'scheduled'),
          gte(matches.kickoffTime, now.toISOString()),
          lte(matches.kickoffTime, future.toISOString())
        )
      );

    // Early return if no upcoming matches
    if (upcomingMatches.length === 0) {
      log.debug('No upcoming matches in time window');
      return {
        percentage: 100,
        totalMatches: 0,
        coveredMatches: 0,
        gaps: [],
      };
    }

    // Get delayed/waiting/active jobs from both queues
    const [analysisJobs, predictionJobs] = await Promise.all([
      getAnalysisQueue().getJobs(['delayed', 'waiting', 'active'], 0, 1000),
      getPredictionsQueue().getJobs(['delayed', 'waiting', 'active'], 0, 1000),
    ]);

    // Build Set of matchIds with scheduled jobs (O(1) lookup)
    const analysisMatchIds = new Set(
      analysisJobs.map(j => j.data?.matchId).filter(Boolean)
    );
    const predictionMatchIds = new Set(
      predictionJobs.map(j => j.data?.matchId).filter(Boolean)
    );

    // Identify gaps - matches WITHOUT both analysis AND prediction jobs
    const gaps: MatchGap[] = upcomingMatches
      .filter(m => !analysisMatchIds.has(m.id) || !predictionMatchIds.has(m.id))
      .map(m => {
        const kickoff = new Date(m.kickoffTime);
        const hoursUntilKickoff = (kickoff.getTime() - now.getTime()) / 3600000;
        const missingJobs: ('analysis' | 'predictions')[] = [];
        if (!analysisMatchIds.has(m.id)) missingJobs.push('analysis');
        if (!predictionMatchIds.has(m.id)) missingJobs.push('predictions');
        return {
          matchId: m.id,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          kickoffTime: m.kickoffTime,
          hoursUntilKickoff: Math.round(hoursUntilKickoff * 10) / 10,
          missingJobs,
        };
      })
      .sort((a, b) => a.hoursUntilKickoff - b.hoursUntilKickoff);

    // Calculate coverage
    const coveredMatches = upcomingMatches.length - gaps.length;
    const percentage = upcomingMatches.length > 0
      ? (coveredMatches / upcomingMatches.length) * 100
      : 100;

    log.debug(
      {
        totalMatches: upcomingMatches.length,
        coveredMatches,
        gaps: gaps.length,
        percentage: Math.round(percentage * 10) / 10,
      },
      'Pipeline coverage calculated'
    );

    return {
      percentage,
      totalMatches: upcomingMatches.length,
      coveredMatches,
      gaps,
    };
  } catch (error) {
    log.error({ error, hoursAhead }, 'Failed to calculate pipeline coverage');
    throw error;
  }
}

/**
 * Classify gaps by severity based on time until kickoff.
 *
 * @param gaps - Array of match gaps
 * @returns Gaps classified into critical/warning/info buckets
 */
export function classifyGapsBySeverity(gaps: MatchGap[]) {
  return {
    critical: gaps.filter(g => g.hoursUntilKickoff < 2),
    warning: gaps.filter(g => g.hoursUntilKickoff >= 2 && g.hoursUntilKickoff < 4),
    info: gaps.filter(g => g.hoursUntilKickoff >= 4),
  };
}
