/**
 * Analysis Worker
 * 
 * Fetches match analysis (predictions, H2H, odds, injuries) from API-Football.
 * Runs at T-6h before each match.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { AnalyzeMatchPayload } from '../types';
import { fetchAndStoreAnalysis } from '@/lib/football/match-analysis';
import { loggers } from '@/lib/logger/modules';
import { getMatchWithRetry } from '@/lib/utils/retry-helpers';

export function createAnalysisWorker() {
  return new Worker<AnalyzeMatchPayload>(
    QUEUE_NAMES.ANALYSIS,
    async (job: Job<AnalyzeMatchPayload>) => {
      const { matchId, externalId, homeTeam, awayTeam, allowRetroactive } = job.data;
      const log = loggers.analysisWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Analyzing ${homeTeam} vs ${awayTeam} (match: ${matchId})`);
      
      try {
         // Verify match still exists and is scheduled
         // Use retry logic to handle race conditions where job runs before DB write completes
         const matchData = await getMatchWithRetry(matchId, 3, 2000, log);
         if (!matchData) {
           log.info(`Match ${matchId} not found after retries, skipping`);
           return { skipped: true, reason: 'match_not_found' };
         }
        
        const { match } = matchData;
        
         if (match.status !== 'scheduled' && !allowRetroactive) {
           log.info(`Match ${matchId} is ${match.status}, skipping`);
           return { skipped: true, reason: 'match_not_scheduled', status: match.status };
         }

         if (allowRetroactive) {
           log.info(`Match ${matchId} is ${match.status}, processing retroactively`);
         }
        
        // Fetch and store analysis
        const fixtureId = parseInt(externalId, 10);
        const analysis = await fetchAndStoreAnalysis(matchId, fixtureId);
        
         if (!analysis) {
           log.warn(
             { matchId, externalId, attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
             `No analysis data available for ${homeTeam} vs ${awayTeam} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 5})`
           );
           throw new Error(`No analysis data available for match ${matchId} (${homeTeam} vs ${awayTeam})`);
         }
        
         log.info(`✓ Analysis complete for ${homeTeam} vs ${awayTeam}`);
        
        return { 
          success: true, 
          matchId,
          hasOdds: !!analysis.oddsHome,
          hasH2H: !!analysis.h2hTotal,
          hasInjuries: (analysis.homeInjuriesCount || 0) > 0 || (analysis.awayInjuriesCount || 0) > 0,
        };
       } catch (error: any) {
           log.error({ 
             matchId, 
             externalId, 
             homeTeam, 
             awayTeam,
             attemptsMade: job.attemptsMade,
             err: error 
           }, `Error analyzing match`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'analysis',
               matchId,
             },
             extra: {
               jobId: job.id,
               externalId,
               homeTeam,
               awayTeam,
               attempt: job.attemptsMade,
             },
           });
           
           throw error; // Let BullMQ handle retry
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one at a time to avoid API rate limits (each analysis = ~6 API calls)
    }
  );
}
