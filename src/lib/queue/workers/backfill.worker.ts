/**
 * Backfill Worker
 * 
 * Periodically checks for matches with missing data and triggers
 * the appropriate jobs to fill in the gaps.
 * 
 * Runs every hour via repeatable job.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, matchQueue, JOB_TYPES } from '../index';
import type { BackfillMissingPayload } from '../types';
import { 
  getMatchesMissingAnalysis,
  getMatchesMissingOdds,
  getMatchesMissingLineups,
  getMatchesMissingBets,
} from '@/lib/db/queries';

export function createBackfillWorker() {
  return new Worker<BackfillMissingPayload>(
    'match-jobs',
    async (job: Job<BackfillMissingPayload>) => {
      if (job.name !== JOB_TYPES.BACKFILL_MISSING) return;

      const { hoursAhead = 12 } = job.data;
      
      console.log(`[Backfill Worker] Checking for matches with missing data (next ${hoursAhead}h)...`);
      
      const results = {
        analysisTriggered: 0,
        oddsTriggered: 0,
        lineupsTriggered: 0,
        betsTriggered: 0,
        errors: [] as string[],
      };
      
      try {
        // 1. Find matches missing analysis (check full range)
        const missingAnalysis = await getMatchesMissingAnalysis(hoursAhead);
        
        for (const match of missingAnalysis) {
          if (!match.externalId) continue;
          
          try {
            await matchQueue.add(
              JOB_TYPES.ANALYZE_MATCH,
              {
                matchId: match.id,
                externalId: match.externalId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
              },
              {
                delay: 1000,
                jobId: `backfill-analyze-${match.id}`,
              }
            );
            results.analysisTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Analysis ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 2. Find matches missing odds (has analysis but no odds, next 6h)
        const missingOdds = await getMatchesMissingOdds(6);
        
        for (const match of missingOdds) {
          if (!match.externalId) continue;
          
          try {
            await matchQueue.add(
              JOB_TYPES.REFRESH_ODDS,
              {
                matchId: match.id,
                externalId: match.externalId,
              },
              {
                delay: 1000,
                jobId: `backfill-odds-${match.id}`,
              }
            );
            results.oddsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Odds ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 3. Find matches missing lineups (next 2h, has analysis)
        const missingLineups = await getMatchesMissingLineups(2);
        
        for (const match of missingLineups) {
          if (!match.externalId) continue;
          
          try {
            await matchQueue.add(
              JOB_TYPES.FETCH_LINEUPS,
              {
                matchId: match.id,
                externalId: match.externalId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
              },
              {
                delay: 1000,
                jobId: `backfill-lineups-${match.id}`,
              }
            );
            results.lineupsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Lineups ${match.id}: ${error.message}`);
            }
          }
        }
        
        // 4. Find matches missing bets (next 2h, has lineups, no bets)
        const missingBets = await getMatchesMissingBets(2);
        
        for (const match of missingBets) {
          try {
            await matchQueue.add(
              JOB_TYPES.PREDICT_MATCH,
              {
                matchId: match.id,
                attempt: 1,
                skipIfDone: true,
                force: false,
              },
              {
                delay: 1000,
                jobId: `backfill-predict-${match.id}`,
              }
            );
            results.betsTriggered++;
          } catch (error: any) {
            if (!error.message?.includes('already exists')) {
              results.errors.push(`Predict ${match.id}: ${error.message}`);
            }
          }
        }
        
        // Log summary
        const total = results.analysisTriggered + results.oddsTriggered + 
                      results.lineupsTriggered + results.betsTriggered;
        
        if (total > 0 || results.errors.length > 0) {
          console.log(`[Backfill Worker] Triggered ${total} jobs:`, {
            analysis: results.analysisTriggered,
            odds: results.oddsTriggered,
            lineups: results.lineupsTriggered,
            bets: results.betsTriggered,
          });
          
          if (results.errors.length > 0) {
            console.error(`[Backfill Worker] ${results.errors.length} errors:`, results.errors);
          }
        } else {
          console.log('[Backfill Worker] No missing data found');
        }
        
        return results;
        
      } catch (error: any) {
        console.error('[Backfill Worker] Fatal error:', error);
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one backfill job at a time
    }
  );
}
