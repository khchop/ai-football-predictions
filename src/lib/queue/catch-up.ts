/**
 * Catch-Up Job Scheduler
 * 
 * On app startup, schedule jobs for existing matches that don't have jobs yet.
 * This ensures smooth deployments - new matches get jobs automatically.
 */

import { getUpcomingMatches, getStuckScheduledMatches, getLiveMatches } from '@/lib/db/queries';
import { scheduleMatchJobs } from './scheduler';
import { liveQueue, JOB_TYPES } from './index';
import { loggers } from '@/lib/logger/modules';

const log = loggers.queue;

export async function catchUpScheduling(): Promise<{ scheduled: number; matches: number; stuckFixed: number }> {
  log.info('Starting catch-up scheduling for existing matches');
  
  try {
    // Get all upcoming matches in next 48 hours
    const upcomingMatches = await getUpcomingMatches(48);
    
    if (upcomingMatches.length === 0) {
      log.info('No upcoming matches found');
    } else {
      log.info({ matchCount: upcomingMatches.length }, 'Found upcoming matches');
    }
    
    let totalScheduled = 0;
    
    for (const { match, competition } of upcomingMatches) {
      try {
        const scheduled = await scheduleMatchJobs({ match, competition });
        totalScheduled += scheduled;
      } catch (error: any) {
        // Log but don't fail entire catch-up if one match fails
        log.error({ matchId: match.id, error: error.message }, 'Failed to schedule jobs for match');
      }
    }
    
    log.info({ scheduledJobs: totalScheduled, matchCount: upcomingMatches.length }, 'Completed catch-up scheduling');
    
    // Check for stuck scheduled matches that should be live
    const stuckScheduledFixed = await checkAndFixStuckMatches();
    
    // Check for stuck live matches that have no active polling
    const stuckLiveFixed = await checkAndFixStuckLiveMatches();
    
    return { scheduled: totalScheduled, matches: upcomingMatches.length, stuckFixed: stuckScheduledFixed + stuckLiveFixed };
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to catch up scheduling');
    throw error;
  }
}

/**
 * Check for matches stuck in 'scheduled' status where kickoff has passed
 * and trigger live monitoring for them
 */
export async function checkAndFixStuckMatches(): Promise<number> {
  try {
    log.info('Checking for matches stuck in scheduled status...');
    
    const stuckMatches = await getStuckScheduledMatches();
    
    if (stuckMatches.length === 0) {
      log.debug('No stuck matches found - all matches have correct status');
      return 0;
    }
    
    log.warn({ 
      count: stuckMatches.length,
      matches: stuckMatches.map(m => ({
        id: m.match.id,
        teams: `${m.match.homeTeam} vs ${m.match.awayTeam}`,
        kickoff: m.match.kickoffTime,
        status: m.match.status,
      }))
    }, 'Found matches stuck in scheduled status after kickoff - initiating recovery');
    
    let fixed = 0;
    let skipped = 0;
    
    for (const { match } of stuckMatches) {
      if (!match.externalId) {
        log.warn({ 
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
        }, 'Skipping stuck match without externalId');
        continue;
      }
      
      const jobId = `live-${match.id}`;
      
      try {
        // Check if a job already exists with this ID
        const existingJob = await liveQueue.getJob(jobId);
        
        if (existingJob) {
          const state = await existingJob.getState();
          
          log.info({ 
            matchId: match.id, 
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            existingJobState: state 
          }, 'Found existing live monitoring job');
          
          if (state === 'completed' || state === 'failed') {
            // Job completed/failed but match still stuck - remove old job and create new one
            log.info({ 
              matchId: match.id, 
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              oldJobState: state 
            }, 'Removing stale job and creating recovery job for stuck match');
            
            await existingJob.remove();
          } else if (state === 'active' || state === 'waiting' || state === 'delayed') {
            // Job is already active/queued - let it continue
            log.info({ 
              matchId: match.id, 
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              jobState: state 
            }, 'Live monitoring job already active, skipping');
            
            skipped++;
            continue;
          }
        }
        
        // Trigger live monitoring immediately
        await liveQueue.add(
          JOB_TYPES.MONITOR_LIVE,
          {
            matchId: match.id,
            externalId: match.externalId,
            kickoffTime: match.kickoffTime,
            pollCount: 0,
          },
          {
            priority: 1, // High priority
            jobId,
          }
        );
        
        fixed++;
        log.info({ 
          matchId: match.id, 
          homeTeam: match.homeTeam, 
          awayTeam: match.awayTeam,
          kickoffTime: match.kickoffTime,
          externalId: match.externalId,
        }, '✓ Triggered live monitoring for stuck match');
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          log.error({ 
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam, 
            error: error.message,
            stack: error.stack,
          }, 'Failed to fix stuck match');
        } else {
          log.debug({ matchId: match.id }, 'Job already exists (race condition), skipping');
          skipped++;
        }
      }
    }
    
    log.info({ 
      fixed, 
      skipped, 
      total: stuckMatches.length,
      summary: `Recovered ${fixed}/${stuckMatches.length} stuck matches`
    }, 'Stuck match recovery completed');
    
    return fixed;
  } catch (error) {
    log.error({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to check stuck matches');
    return 0;
  }
}

/**
 * Check for matches with 'live' status that have no active polling jobs
 * This recovers matches where polling stopped but status is still live
 */
export async function checkAndFixStuckLiveMatches(): Promise<number> {
  try {
    log.info('Checking for live matches without active polling...');
    
    const liveMatches = await getLiveMatches();
    
    if (liveMatches.length === 0) {
      log.debug('No live matches found');
      return 0;
    }
    
    log.info({ count: liveMatches.length }, 'Found live matches, checking for active polling');
    
    let fixed = 0;
    let skipped = 0;
    
    for (const { match } of liveMatches) {
      if (!match.externalId) {
        log.warn({ 
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
        }, 'Skipping live match without externalId');
        continue;
      }
      
      // Check if there's any active polling job for this match
      const hasActiveJob = await hasActivePollJob(match.id);
      
      if (hasActiveJob) {
        log.debug({ 
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
        }, 'Live match has active polling, skipping');
        skipped++;
        continue;
      }
      
      // No active polling - trigger recovery with unique job ID
      const recoveryJobId = `live-poll-${match.id}-recovery-${Date.now()}`;
      
      try {
        await liveQueue.add(
          JOB_TYPES.MONITOR_LIVE,
          {
            matchId: match.id,
            externalId: match.externalId,
            kickoffTime: match.kickoffTime,
            pollCount: 0,
          },
          {
            priority: 1, // High priority
            jobId: recoveryJobId,
          }
        );
        
        fixed++;
        log.info({ 
          matchId: match.id, 
          homeTeam: match.homeTeam, 
          awayTeam: match.awayTeam,
          recoveryJobId,
        }, '✓ Triggered recovery poll for stuck live match');
      } catch (error: any) {
        log.error({ 
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam, 
          error: error.message,
        }, 'Failed to trigger recovery poll for stuck live match');
      }
    }
    
    log.info({ 
      fixed, 
      skipped, 
      total: liveMatches.length,
      summary: `Recovered ${fixed}/${liveMatches.length} stuck live matches`
    }, 'Stuck live match recovery completed');
    
    return fixed;
  } catch (error) {
    log.error({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to check stuck live matches');
    return 0;
  }
}

/**
 * Check if a match has any active polling jobs (waiting, delayed, or active)
 */
async function hasActivePollJob(matchId: string): Promise<boolean> {
  const jobPattern = `live-poll-${matchId}-`;
  const initialJobId = `live-${matchId}`;
  
  // Helper to check if any job matches our pattern
  const matchesPattern = (jobId: string | undefined): boolean => {
    if (!jobId) return false;
    return jobId.startsWith(jobPattern) || jobId === initialJobId;
  };
  
  try {
    // Check delayed jobs
    const delayed = await liveQueue.getDelayed(0, 1000);
    for (const job of delayed) {
      if (matchesPattern(job.id)) {
        return true;
      }
    }
    
    // Check waiting jobs
    const waiting = await liveQueue.getWaiting(0, 1000);
    for (const job of waiting) {
      if (matchesPattern(job.id)) {
        return true;
      }
    }
    
    // Check active jobs
    const active = await liveQueue.getActive(0, 1000);
    for (const job of active) {
      if (matchesPattern(job.id)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    log.error({ matchId, error }, 'Error checking for active poll jobs');
    return false; // On error, assume no active job to trigger recovery
  }
}
