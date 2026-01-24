/**
 * Retry Helpers
 * 
 * Shared retry utilities for handling transient failures
 */

import { getMatchById } from '@/lib/db/queries';

/**
 * Retry helper for fetching match data with exponential backoff
 * Handles race condition where jobs run before DB write completes
 */
export async function getMatchWithRetry(
  matchId: string,
  maxRetries: number = 3,
  initialDelayMs: number = 2000,
  log?: any
): Promise<Awaited<ReturnType<typeof getMatchById>> | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const matchData = await getMatchById(matchId);
    if (matchData) {
      if (attempt > 1 && log) {
        log.info({ matchId, attempt, totalRetries: attempt - 1 }, 'Match found after retry');
      }
      return matchData;
    }
    
    if (attempt < maxRetries) {
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      if (log) {
        log.info({ matchId, attempt, nextRetryMs: delayMs }, 'Match not found, retrying...');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return null;
}
