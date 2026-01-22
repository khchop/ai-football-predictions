/**
 * Catch-Up Job Scheduler
 * 
 * On app startup, schedule jobs for existing matches that don't have jobs yet.
 * This ensures smooth deployments - new matches get jobs automatically.
 */

import { getUpcomingMatches } from '@/lib/db/queries';
import { scheduleMatchJobs } from './scheduler';

export async function catchUpScheduling(): Promise<{ scheduled: number; matches: number }> {
  console.log('[Catch-up] Starting catch-up scheduling for existing matches...');
  
  try {
    // Get all upcoming matches in next 48 hours
    const upcomingMatches = await getUpcomingMatches(48);
    
    if (upcomingMatches.length === 0) {
      console.log('[Catch-up] No upcoming matches found');
      return { scheduled: 0, matches: 0 };
    }
    
    console.log(`[Catch-up] Found ${upcomingMatches.length} upcoming matches`);
    
    let totalScheduled = 0;
    
    for (const { match, competition } of upcomingMatches) {
      try {
        const scheduled = await scheduleMatchJobs({ match, competition });
        totalScheduled += scheduled;
      } catch (error: any) {
        // Log but don't fail entire catch-up if one match fails
        console.error(`[Catch-up] Failed to schedule jobs for match ${match.id}:`, error.message);
      }
    }
    
    console.log(`[Catch-up] ✓ Scheduled ${totalScheduled} jobs for ${upcomingMatches.length} matches`);
    
    return { scheduled: totalScheduled, matches: upcomingMatches.length };
  } catch (error) {
    console.error('[Catch-up] Failed to catch up scheduling:', error);
    throw error;
  }
}
