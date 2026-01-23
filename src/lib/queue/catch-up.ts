/**
 * Catch-Up Job Scheduler
 * 
 * On app startup, schedule jobs for existing matches that don't have jobs yet.
 * This ensures smooth deployments - new matches get jobs automatically.
 */

import { getUpcomingMatches, getStuckScheduledMatches } from '@/lib/db/queries';
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
    const stuckFixed = await checkAndFixStuckMatches();
    
    return { scheduled: totalScheduled, matches: upcomingMatches.length, stuckFixed };
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
    const stuckMatches = await getStuckScheduledMatches();
    
    if (stuckMatches.length === 0) {
      return 0;
    }
    
    log.warn({ count: stuckMatches.length }, 'Found matches stuck in scheduled status after kickoff');
    
    let fixed = 0;
    
    for (const { match } of stuckMatches) {
      if (!match.externalId) {
        log.warn({ matchId: match.id }, 'Skipping stuck match without externalId');
        continue;
      }
      
      try {
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
            jobId: `live-${match.id}`,
          }
        );
        
        fixed++;
        log.info({ 
          matchId: match.id, 
          homeTeam: match.homeTeam, 
          awayTeam: match.awayTeam,
          kickoffTime: match.kickoffTime 
        }, 'Triggered live monitoring for stuck match');
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          log.error({ matchId: match.id, error: error.message }, 'Failed to fix stuck match');
        }
      }
    }
    
    if (fixed > 0) {
      log.info({ fixed }, 'Fixed stuck scheduled matches');
    }
    
    return fixed;
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check stuck matches');
    return 0;
  }
}
