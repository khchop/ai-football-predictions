/**
 * Catch-Up Job Scheduler
 * 
 * On app startup, schedule jobs for existing matches that don't have jobs yet.
 * This ensures smooth deployments - new matches get jobs automatically.
 */

import { getUpcomingMatches } from '@/lib/db/queries';
import { scheduleMatchJobs } from './scheduler';
import { loggers } from '@/lib/logger/modules';

const log = loggers.queue;

export async function catchUpScheduling(): Promise<{ scheduled: number; matches: number }> {
  log.info('Starting catch-up scheduling for existing matches');
  
  try {
    // Get all upcoming matches in next 48 hours
    const upcomingMatches = await getUpcomingMatches(48);
    
    if (upcomingMatches.length === 0) {
      log.info('No upcoming matches found');
      return { scheduled: 0, matches: 0 };
    }
    
    log.info({ matchCount: upcomingMatches.length }, 'Found upcoming matches');
    
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
    
    return { scheduled: totalScheduled, matches: upcomingMatches.length };
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to catch up scheduling');
    throw error;
  }
}
