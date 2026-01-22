/**
 * Match Job Scheduler
 * 
 * Schedules all jobs for a match at precise times relative to kickoff.
 * Routes jobs to appropriate queues for guaranteed processing.
 */

import { 
  analysisQueue, 
  predictionsQueue, 
  lineupsQueue, 
  oddsQueue, 
  liveQueue,
  JOB_TYPES 
} from './index';
import type { Match, Competition } from '@/lib/db/schema';

interface MatchWithCompetition {
  match: Match;
  competition: Competition;
}

export async function scheduleMatchJobs(data: MatchWithCompetition): Promise<number> {
  const { match, competition } = data;
  const kickoff = new Date(match.kickoffTime).getTime();
  const now = Date.now();
  
  // Don't schedule if match already started
  if (kickoff <= now) {
    console.log(`[Scheduler] Match ${match.id} already started, skipping job scheduling`);
    return 0;
  }
  
  if (!match.externalId) {
    console.log(`[Scheduler] Match ${match.id} has no externalId, skipping`);
    return 0;
  }
  
  const jobsToSchedule = [
    // T-6h: Analyze match (fetch H2H, odds, injuries, team stats)
    {
      queue: analysisQueue,
      name: JOB_TYPES.ANALYZE_MATCH,
      data: {
        matchId: match.id,
        externalId: match.externalId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      delay: kickoff - 6 * 60 * 60 * 1000 - now,
      jobId: `analyze-${match.id}`,
    },
    // T-2h: Refresh odds
    {
      queue: oddsQueue,
      name: JOB_TYPES.REFRESH_ODDS,
      data: {
        matchId: match.id,
        externalId: match.externalId,
      },
      delay: kickoff - 2 * 60 * 60 * 1000 - now,
      jobId: `refresh-odds-2h-${match.id}`,
    },
    // T-95m: Refresh odds (before first prediction)
    {
      queue: oddsQueue,
      name: JOB_TYPES.REFRESH_ODDS,
      data: {
        matchId: match.id,
        externalId: match.externalId,
      },
      delay: kickoff - 95 * 60 * 1000 - now,
      jobId: `refresh-odds-95m-${match.id}`,
    },
    // T-90m: First prediction attempt
    {
      queue: predictionsQueue,
      name: JOB_TYPES.PREDICT_MATCH,
      data: {
        matchId: match.id,
        attempt: 1,
        skipIfDone: false,
        force: false,
      },
      delay: kickoff - 90 * 60 * 1000 - now,
      jobId: `predict-1-${match.id}`,
    },
    // T-60m: Fetch lineups
    {
      queue: lineupsQueue,
      name: JOB_TYPES.FETCH_LINEUPS,
      data: {
        matchId: match.id,
        externalId: match.externalId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      },
      delay: kickoff - 60 * 60 * 1000 - now,
      jobId: `lineups-${match.id}`,
    },
    // T-35m: Refresh odds (before second prediction)
    {
      queue: oddsQueue,
      name: JOB_TYPES.REFRESH_ODDS,
      data: {
        matchId: match.id,
        externalId: match.externalId,
      },
      delay: kickoff - 35 * 60 * 1000 - now,
      jobId: `refresh-odds-35m-${match.id}`,
    },
    // T-30m: Second prediction attempt
    {
      queue: predictionsQueue,
      name: JOB_TYPES.PREDICT_MATCH,
      data: {
        matchId: match.id,
        attempt: 2,
        skipIfDone: true,
        force: false,
      },
      delay: kickoff - 30 * 60 * 1000 - now,
      jobId: `predict-2-${match.id}`,
    },
    // T-10m: Refresh odds (before final prediction)
    {
      queue: oddsQueue,
      name: JOB_TYPES.REFRESH_ODDS,
      data: {
        matchId: match.id,
        externalId: match.externalId,
      },
      delay: kickoff - 10 * 60 * 1000 - now,
      jobId: `refresh-odds-10m-${match.id}`,
    },
    // T-5m: Final prediction attempt (force)
    {
      queue: predictionsQueue,
      name: JOB_TYPES.PREDICT_MATCH,
      data: {
        matchId: match.id,
        attempt: 3,
        skipIfDone: true,
        force: true, // Generate with or without lineups
      },
      delay: kickoff - 5 * 60 * 1000 - now,
      jobId: `predict-3-${match.id}`,
    },
    // Kickoff: Start live monitoring
    {
      queue: liveQueue,
      name: JOB_TYPES.MONITOR_LIVE,
      data: {
        matchId: match.id,
        externalId: match.externalId,
        kickoffTime: match.kickoffTime,
        pollCount: 0,
      },
      delay: kickoff - now,
      jobId: `live-${match.id}`,
    },
  ];
  
  let scheduled = 0;
  
  // Jobs that should run immediately if their scheduled time has passed
  const lateRunnableJobs = new Set([
    JOB_TYPES.ANALYZE_MATCH,
    JOB_TYPES.REFRESH_ODDS,
    JOB_TYPES.FETCH_LINEUPS,
    JOB_TYPES.PREDICT_MATCH,
  ]);
  
  for (const job of jobsToSchedule) {
    if (job.delay > 0) {
      // Schedule for future
      try {
        await job.queue.add(job.name, job.data, {
          delay: job.delay,
          jobId: job.jobId,
        });
        scheduled++;
      } catch (error: any) {
        // Job with same ID already exists - that's fine, skip it
        if (error.message?.includes('already exists')) {
          continue;
        }
        console.error(`[Scheduler] Failed to schedule ${job.name} for ${match.id}:`, error);
      }
    } else if (kickoff > now && lateRunnableJobs.has(job.name as any)) {
      // Job time passed but match hasn't started - run immediately
      try {
        await job.queue.add(job.name, job.data, {
          delay: 1000, // 1 second delay to avoid duplicate processing
          jobId: job.jobId,
        });
        scheduled++;
        console.log(`[Scheduler] Running past-due ${job.name} immediately for ${match.homeTeam} vs ${match.awayTeam}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          continue;
        }
        console.error(`[Scheduler] Failed to schedule late ${job.name} for ${match.id}:`, error);
      }
    }
  }
  
  if (scheduled > 0) {
    console.log(`[Scheduler] Scheduled ${scheduled} jobs for ${match.homeTeam} vs ${match.awayTeam} (kickoff: ${match.kickoffTime})`);
  }
  
  return scheduled;
}

// Cancel all jobs for a match (if postponed/cancelled)
export async function cancelMatchJobs(matchId: string): Promise<number> {
  const jobsToCancel = [
    { queue: analysisQueue, jobId: `analyze-${matchId}` },
    { queue: oddsQueue, jobId: `refresh-odds-2h-${matchId}` },
    { queue: oddsQueue, jobId: `refresh-odds-95m-${matchId}` },
    { queue: predictionsQueue, jobId: `predict-1-${matchId}` },
    { queue: lineupsQueue, jobId: `lineups-${matchId}` },
    { queue: oddsQueue, jobId: `refresh-odds-35m-${matchId}` },
    { queue: predictionsQueue, jobId: `predict-2-${matchId}` },
    { queue: oddsQueue, jobId: `refresh-odds-10m-${matchId}` },
    { queue: predictionsQueue, jobId: `predict-3-${matchId}` },
    { queue: liveQueue, jobId: `live-${matchId}` },
  ];
  
  let cancelled = 0;
  
  for (const { queue, jobId } of jobsToCancel) {
    try {
      const job = await queue.getJob(jobId);
      if (job && (await job.isDelayed() || await job.isWaiting())) {
        await job.remove();
        cancelled++;
      }
    } catch (error) {
      // Job doesn't exist or already processed - that's fine
    }
  }
  
  if (cancelled > 0) {
    console.log(`[Scheduler] Cancelled ${cancelled} jobs for match ${matchId}`);
  }
  
  return cancelled;
}
