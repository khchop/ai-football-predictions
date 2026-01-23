/**
 * Match Job Scheduler
 * 
 * Schedules all jobs for a match at precise times relative to kickoff.
 * Simplified schedule: 5 jobs per match (was 10)
 * - T-6h: Analysis (stats, form, H2H)
 * - T-2h: Odds (for content only, not sent to models)
 * - T-60m: Lineups
 * - T-30m: Predictions (score prediction with Kicktipp Quota Scoring)
 * - T-0: Live monitoring
 */

import { 
  analysisQueue, 
  predictionsQueue, 
  lineupsQueue, 
  oddsQueue, 
  liveQueue,
  JOB_TYPES 
} from './index';
import { loggers } from '@/lib/logger/modules';
import { addToDeadLetterQueue } from './dead-letter';
import type { Match, Competition } from '@/lib/db/schema';

const log = loggers.scheduler;

// ============================================================================
// JOB PRIORITY SYSTEM
// ============================================================================
// Lower number = higher priority in queue
// This ensures time-sensitive jobs execute before non-critical work

export const JOB_PRIORITIES = {
  CRITICAL: 1,      // Live score updates, match start monitoring
  HIGH: 5,          // Pre-match odds refresh, lineups, predictions
  NORMAL: 10,       // Regular analysis, standings updates
  LOW: 20,          // Content generation, backfill
  BACKGROUND: 50,   // Cleanup, maintenance, warming
} as const;

// ============================================================================
// JOB TIMEOUT CONFIGURATION
// ============================================================================
// Per-job-type timeout settings (in milliseconds)
// Different job types have different resource requirements and expected durations

export const JOB_TIMEOUTS: Record<string, number> = {
  [JOB_TYPES.FETCH_FIXTURES]: 5 * 60 * 1000,     // 5 min - bulk API calls, multiple requests
  [JOB_TYPES.ANALYZE_MATCH]: 3 * 60 * 1000,      // 3 min - multiple API calls (H2H, stats, injuries)
  [JOB_TYPES.PREDICT_MATCH]: 10 * 60 * 1000,     // 10 min - LLM calls can be slow, multiple models
  [JOB_TYPES.FETCH_LINEUPS]: 2 * 60 * 1000,      // 2 min - single API call with parsing
  [JOB_TYPES.REFRESH_ODDS]: 2 * 60 * 1000,       // 2 min - single API call with processing
  [JOB_TYPES.SETTLE_MATCH]: 1 * 60 * 1000,       // 1 min - DB operations only
  [JOB_TYPES.MONITOR_LIVE]: 30 * 60 * 1000,      // 30 min - long-running live score polling
  [JOB_TYPES.BACKFILL_MISSING]: 10 * 60 * 1000,  // 10 min - potentially many DB operations
  [JOB_TYPES.CHECK_MODEL_HEALTH]: 2 * 60 * 1000, // 2 min - database query
  [JOB_TYPES.CATCH_UP]: 5 * 60 * 1000,           // 5 min - catch-up operations
  'default': 2 * 60 * 1000,                       // 2 min default timeout
};

/**
 * Get appropriate timeout for a job type
 */
export function getJobTimeout(jobType: string): number {
  return JOB_TIMEOUTS[jobType] || JOB_TIMEOUTS['default'];
}

/**
 * Calculate dynamic priority based on urgency and time to kickoff
 * Jobs get boosted priority as match approaches
 */
export function calculateDynamicPriority(
  basePriority: number,
  kickoffTime: Date,
  jobType: string
): number {
  const now = Date.now();
  const kickoff = kickoffTime.getTime();
  const timeUntilKickoff = kickoff - now;

  // Time windows for escalation
  const HOUR = 60 * 60 * 1000;
  const MIN_PRIORITY = JOB_PRIORITIES.CRITICAL; // Minimum priority (highest urgency)

  if (timeUntilKickoff < 0) {
    // Match started - highest priority for live updates
    return JOB_PRIORITIES.CRITICAL;
  } else if (timeUntilKickoff < 30 * 60 * 1000) {
    // Within 30 minutes - critical (boost by 5)
    return Math.min(MIN_PRIORITY, basePriority - 5);
  } else if (timeUntilKickoff < 1 * HOUR) {
    // Within 1 hour - escalate significantly (boost by 3)
    return Math.min(JOB_PRIORITIES.HIGH, basePriority - 3);
  } else if (timeUntilKickoff < 3 * HOUR) {
    // Within 3 hours - moderate escalation (boost by 2)
    return Math.min(JOB_PRIORITIES.NORMAL, basePriority - 2);
  }

  return basePriority;
}

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
    log.info({ matchId: match.id }, 'Match already started, skipping job scheduling');
    return 0;
  }
  
  if (!match.externalId) {
    log.info({ matchId: match.id }, 'Match has no externalId, skipping');
    return 0;
  }
  
  const kickoffDate = new Date(match.kickoffTime);
  
  const jobsToSchedule = [
     // T-6h: Analyze match (fetch H2H, stats, injuries, team stats - NO ODDS sent to models)
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
       priority: calculateDynamicPriority(JOB_PRIORITIES.NORMAL, kickoffDate, JOB_TYPES.ANALYZE_MATCH),
     },
     // T-2h: Refresh odds (for content generation only, not sent to models)
     {
       queue: oddsQueue,
       name: JOB_TYPES.REFRESH_ODDS,
       data: {
         matchId: match.id,
         externalId: match.externalId,
       },
       delay: kickoff - 2 * 60 * 60 * 1000 - now,
       jobId: `odds-${match.id}`,
       priority: calculateDynamicPriority(JOB_PRIORITIES.NORMAL, kickoffDate, JOB_TYPES.REFRESH_ODDS),
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
       priority: calculateDynamicPriority(JOB_PRIORITIES.HIGH, kickoffDate, JOB_TYPES.FETCH_LINEUPS),
     },
     // T-30m: Generate predictions (single attempt after lineups available)
     {
       queue: predictionsQueue,
       name: JOB_TYPES.PREDICT_MATCH,
       data: {
         matchId: match.id,
         skipIfDone: true,
       },
       delay: kickoff - 30 * 60 * 1000 - now,
       jobId: `predict-${match.id}`,
       priority: calculateDynamicPriority(JOB_PRIORITIES.HIGH, kickoffDate, JOB_TYPES.PREDICT_MATCH),
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
       priority: JOB_PRIORITIES.CRITICAL, // Always highest priority for live updates
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
           priority: job.priority,
           // Note: Timeout is configured via getJobTimeout() which can be used by:
           // 1. Worker configuration when creating the worker
           // 2. Queue defaultJobOptions
           // 3. Job-specific timeout configuration in worker handlers
         });
         scheduled++;
       } catch (error: any) {
         // Job with same ID already exists - that's fine, skip it
         if (error.message?.includes('already exists')) {
           continue;
         }
          log.error({ matchId: match.id, jobName: job.name, error: error.message }, 'Failed to schedule job');
       }
     } else if (kickoff > now && lateRunnableJobs.has(job.name as any)) {
       // Job time passed but match hasn't started - run immediately
        try {
          await job.queue.add(job.name, job.data, {
            delay: 1000, // 1 second delay to avoid duplicate processing
            jobId: job.jobId,
            priority: job.priority,
            // Uses timeout from getJobTimeout(job.name) when processed by workers
          });
          scheduled++;
         log.info({ jobName: job.name, homeTeam: match.homeTeam, awayTeam: match.awayTeam }, 'Running past-due job immediately');
       } catch (error: any) {
         if (error.message?.includes('already exists')) {
           continue;
         }
         log.error({ matchId: match.id, jobName: job.name, error: error.message }, 'Failed to schedule late job');
       }
     }
  }
  
  if (scheduled > 0) {
    log.info({ jobCount: scheduled, homeTeam: match.homeTeam, awayTeam: match.awayTeam, kickoffTime: match.kickoffTime }, 'Scheduled jobs for match');
  }
  
  return scheduled;
}

// Cancel all jobs for a match (if postponed/cancelled)
export async function cancelMatchJobs(matchId: string): Promise<number> {
  // Job IDs must match those created in scheduleMatchJobs
  const jobsToCancel = [
    { queue: analysisQueue, jobId: `analyze-${matchId}` },
    { queue: oddsQueue, jobId: `odds-${matchId}` },
    { queue: lineupsQueue, jobId: `lineups-${matchId}` },
    { queue: predictionsQueue, jobId: `predict-${matchId}` },
    { queue: liveQueue, jobId: `live-${matchId}` },
  ];
  
  let cancelled = 0;
  let movedToDLQ = 0;
  
  for (const { queue, jobId } of jobsToCancel) {
    try {
      const job = await queue.getJob(jobId);
      if (!job) continue;
      
      // Check job state
      const isActive = await job.isActive();
      const isDelayed = await job.isDelayed();
      const isWaiting = await job.isWaiting();
      
      if (isActive) {
        // Active job: move to DLQ with cancellation reason
        const error = new Error('Match cancelled/postponed - job terminated');
        await addToDeadLetterQueue(job, error);
        await job.remove();
        movedToDLQ++;
        
        log.info(
          { matchId, jobId, jobName: job.name, queue: queue.name },
          'Moved active job to DLQ due to match cancellation'
        );
      } else if (isDelayed || isWaiting) {
        // Waiting/delayed job: just remove
        await job.remove();
        cancelled++;
        
        log.debug(
          { matchId, jobId, jobName: job.name, state: isDelayed ? 'delayed' : 'waiting' },
          'Removed queued job for cancelled match'
        );
      }
    } catch (error) {
      // Job doesn't exist or error processing - log but continue
      log.debug({ matchId, jobId, error: error instanceof Error ? error.message : String(error) }, 'Error handling job cancellation');
    }
  }
  
  const total = cancelled + movedToDLQ;
  if (total > 0) {
    log.info(
      { matchId, cancelled, movedToDLQ, total },
      'Cancelled/cleaned up jobs for match'
    );
  }
  
  return total;
}
