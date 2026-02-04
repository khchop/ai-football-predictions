/**
 * Content Generation Worker
 * 
 * Generates AI-powered content for match previews, league roundups, and model reports.
 * Uses Google Gemini 3 Flash Preview via OpenRouter.
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES, getQueue } from '../index';
import type { GenerateContentPayload } from '../types';
import { generateMatchPreview, generateLeagueRoundup, generateModelReport, generatePostMatchRoundup } from '@/lib/content/generator';
import {
   getMatchesNeedingPreviews,
   getMatchBetsForPreview,
   hasMatchPreview,
   getMatchesMissingPreMatchContent,
   getMatchesMissingBettingContent,
   getMatchesMissingPostMatchContent,
   getLeagueRoundupData,
   getTopModelsForReport,
   getOverallModelStats,
 } from '@/lib/content/queries';
import { getActiveCompetitions } from '@/lib/db/queries';
import {
  generatePreMatchContent,
  generateBettingContent,
  generatePostMatchContent,
} from '@/lib/content/match-content';
import { loggers } from '@/lib/logger/modules';
import {
  recordQueueRateLimitError,
  recordQueueSuccess,
} from '../circuit-breaker/queue-circuit-breaker';

// Shared job options for consistent retry behavior
const CONTENT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 30000, // 30s base, exponential: 30s, 1m, 2m, 4m, 8m
  },
  removeOnComplete: {
    age: 86400,
    count: 100,
  },
  removeOnFail: {
    age: 604800,
  },
};

export function createContentWorker() {
  return new Worker<GenerateContentPayload>(
    QUEUE_NAMES.CONTENT,
    async (job: Job<GenerateContentPayload>) => {
      const { type, data } = job.data;
      const log = loggers.contentWorker.child({ jobId: job.id, jobName: job.name });

      // Setup heartbeat to extend lock for long-running jobs
      const heartbeatInterval = setInterval(async () => {
        try {
          if (job.token) {
            await job.extendLock(job.token, 120000);
            log.debug({ jobId: job.id }, 'Extended job lock');
          }
        } catch (err) {
          log.warn({ jobId: job.id, err }, 'Lock extension failed');
        }
      }, 30000); // Every 30s (well before 120s lock expiry)

      try {
        log.info(`Generating ${type} content`);

        // Execute job and track success
        const result = await (async () => {
        if (type === 'match_preview') {
          return await generateMatchPreviewContent(data as {
            matchId: string;
            homeTeam: string;
            awayTeam: string;
            competition: string;
            kickoffTime: string;
            venue?: string;
          });
         } else if (type === 'league_roundup') {
            return await generateLeagueRoundupContent(data as {
              competitionId: string;
              week: string;
            });
          } else if (type === 'model_report') {
            return await generateModelReportContent(data as {
              period: string;
            });
          } else if (type === 'scan_matches') {
            // Scan for matches that need previews and queue them
            return await scanMatchesNeedingPreviews();
          } else if (type === 'scan_match_content') {
            // Scan for matches missing content sections and generate backfill
            return await scanMatchesMissingContent();
          } else if (type === 'scan_league_roundups') {
            // Scan all competitions and generate roundups for those with finished matches
            return await scanAndGenerateLeagueRoundups();
          } else if (type === 'generate-roundup') {
            // Generate post-match roundup for a specific match (triggered after settlement)
            return await generatePostMatchRoundupContent(data as {
              matchId: string;
              triggeredAt: string;
            });
          } else {
            throw new Error(`Unknown content type: ${type}`);
          }
        })();

        // Record successful job completion to reset rate limit counter
        recordQueueSuccess(QUEUE_NAMES.CONTENT);

        return result;
      } catch (error) {
        log.error({ err: error }, `Error generating ${type}`);

        // Check if this is a rate limit error and notify circuit breaker
        if (
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.toLowerCase().includes('rate limit'))
        ) {
          await recordQueueRateLimitError(QUEUE_NAMES.CONTENT);
        }

        Sentry.captureException(error, {
          level: 'error',
          tags: {
            worker: 'content',
            content_type: type,
          },
          extra: {
            jobId: job.id,
            data,
          },
        });
        throw error;
      } finally {
        clearInterval(heartbeatInterval);
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // 3 parallel jobs (per CONTEXT.md decision)
      limiter: {
        max: 30, // Max 30 requests per minute (Together AI limit)
        duration: 60000, // Per minute
      },
      // Lock configuration (PIPE-02)
      lockDuration: 120000, // 2 minutes before job considered stalled
      stalledInterval: 30000, // Check for stalled jobs every 30s
      maxStalledCount: 1, // Fail after 1 stall detection
    }
  );
}

/**
 * Generate match preview for a specific match
 */
async function generateMatchPreviewContent(data: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffTime: string;
  venue?: string;
}) {
  const { matchId, homeTeam, awayTeam } = data;
  const log = loggers.contentWorker.child({ matchId });
  
  // Check if preview already exists
  const exists = await hasMatchPreview(matchId);
  if (exists) {
    log.info(`Preview already exists for ${homeTeam} vs ${awayTeam}`);
    return { skipped: true, reason: 'preview_exists' };
  }
  
  log.info(`Generating preview for ${homeTeam} vs ${awayTeam}`);
  
  // Get AI model bets for this match (if available)
  const aiPredictions = await getMatchBetsForPreview(matchId);
  
  // Generate the preview
  const previewId = await generateMatchPreview({
    ...data,
    aiPredictions,
  });
  
  log.info(`✓ Preview generated: ${previewId}`);
  
  return {
    success: true,
    previewId,
    matchId,
  };
}

/**
 * Scan for matches needing previews and queue them
 * This runs hourly to check if any matches are 6h away from kickoff
 */
async function scanMatchesNeedingPreviews() {
   const log = loggers.contentWorker;
   
   log.info('Scanning for matches needing previews...');
   
   const matchesNeedingPreviews = await getMatchesNeedingPreviews();
   
   if (matchesNeedingPreviews.length === 0) {
     log.info('No matches need previews at this time');
     return { scanned: 0, queued: 0, failed: 0 };
   }
   
    log.info({ matchCount: matchesNeedingPreviews.length }, `Found matches needing previews`);
    
    // Queue each match for preview generation
    const contentQueue = getQueue(QUEUE_NAMES.CONTENT);
   
   let queuedCount = 0;
   let failedCount = 0;
   const failedMatches: Array<{ matchId: string; error: string }> = [];
   
   for (const item of matchesNeedingPreviews) {
     const { match, competition, analysis } = item;
     
     try {
       await contentQueue.add(
         'generate-match-preview',
         {
           type: 'match_preview',
           data: {
             matchId: match.id,
             homeTeam: match.homeTeam,
             awayTeam: match.awayTeam,
             competition: competition.name,
             kickoffTime: match.kickoffTime,
             venue: match.venue || undefined,
             analysis: analysis || undefined,
           },
         },
         {
           jobId: `preview-${match.id}`, // Prevent duplicates
           ...CONTENT_JOB_OPTIONS,
         }
       );
       
        queuedCount++;
        log.info({ matchId: match.id, teams: `${match.homeTeam} vs ${match.awayTeam}` }, `Queued preview`);
      } catch (error: any) {
        failedCount++;
        failedMatches.push({
          matchId: match.id,
          error: error.message || String(error),
        });
        log.error({ matchId: match.id, err: error }, `Failed to queue match`);
      }
    }
    
    log.info({ scanned: matchesNeedingPreviews.length, queued: queuedCount, failed: failedCount }, `Scan complete`);
   
   // If ALL matches failed, throw to trigger retry (don't silently fail)
   if (failedCount > 0 && queuedCount === 0) {
     throw new Error(`All ${failedCount} matches failed to queue for preview generation`);
   }
   
   return {
     scanned: matchesNeedingPreviews.length,
     queued: queuedCount,
     failed: failedCount,
     partialSuccess: failedCount > 0 && queuedCount > 0,
     failedMatches: failedMatches.slice(0, 10), // Cap to prevent huge payloads
   };
}

/**
 * Scan for matches missing content sections and generate backfill
 * Prioritizes: pre-match (upcoming) → betting (medium) → post-match (historical)
 * Rate limited to 10 generations per scan to respect Together AI limits
 */
async function scanMatchesMissingContent() {
  const log = loggers.contentWorker;
  const MAX_GENERATIONS_PER_SCAN = 10;
  
  log.info('Scanning for matches missing content sections...');
  
  let generated = 0;
  const results = {
    preMatch: { found: 0, generated: 0, failed: 0 },
    betting: { found: 0, generated: 0, failed: 0 },
    postMatch: { found: 0, generated: 0, failed: 0 },
  };

  try {
    // 1. Pre-match content (highest priority - upcoming matches need content first)
    const missingPreMatch = await getMatchesMissingPreMatchContent(24);
    results.preMatch.found = missingPreMatch.length;
    
     for (const match of missingPreMatch) {
       if (generated >= MAX_GENERATIONS_PER_SCAN) break;
       try {
         await generatePreMatchContent(match.matchId);
         results.preMatch.generated++;
         generated++;
         log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled pre-match content');
       } catch (err) {
         results.preMatch.failed++;
         // Errors are already logged in the content function, just track the failure count here
         log.debug({ matchId: match.matchId, err }, 'Pre-match backfill failed (continuing scan)');
       }
     }

    // 2. Betting content (medium priority)
    const missingBetting = await getMatchesMissingBettingContent(24);
    results.betting.found = missingBetting.length;
    
     for (const match of missingBetting) {
       if (generated >= MAX_GENERATIONS_PER_SCAN) break;
       try {
         await generateBettingContent(match.matchId);
         results.betting.generated++;
         generated++;
         log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled betting content');
       } catch (err) {
         results.betting.failed++;
         // Errors are already logged in the content function, just track the failure count here
         log.debug({ matchId: match.matchId, err }, 'Betting backfill failed (continuing scan)');
       }
     }

    // 3. Post-match content (lowest priority - historical)
    const missingPostMatch = await getMatchesMissingPostMatchContent(7);
    results.postMatch.found = missingPostMatch.length;
    
     for (const match of missingPostMatch) {
       if (generated >= MAX_GENERATIONS_PER_SCAN) break;
       try {
         await generatePostMatchContent(match.matchId);
         results.postMatch.generated++;
         generated++;
         log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled post-match content');
       } catch (err) {
         results.postMatch.failed++;
         // Errors are already logged in the content function, just track the failure count here
         log.debug({ matchId: match.matchId, err }, 'Post-match backfill failed (continuing scan)');
       }
     }

    const totalFound = results.preMatch.found + results.betting.found + results.postMatch.found;
    const totalRemaining = totalFound - generated;
    
    log.info({
      generated,
      remaining: totalRemaining,
      ...results,
    }, `Content scan complete: ${generated} generated, ${totalRemaining} remaining`);

    return {
      success: true,
      generated,
      remaining: totalRemaining,
      results,
    };
  } catch (error) {
    log.error({ err: error }, 'Error during content scan');
    throw error;
  }
}

/**
 * Generate league roundup for a specific competition
 */
async function generateLeagueRoundupContent(data: {
  competitionId: string;
  week: string;
}) {
  const { competitionId, week } = data;
  const log = loggers.contentWorker.child({ competitionId, week });

  try {
    log.info('Generating league roundup');

    const roundupData = await getLeagueRoundupData(competitionId);

    if (!roundupData) {
      log.info('No finished matches for roundup');
      return { skipped: true, reason: 'no_data' };
    }

    const postId = await generateLeagueRoundup(roundupData);

    log.info({ postId }, '✓ League roundup generated');

    return { success: true, postId };
  } catch (error) {
    log.error({ err: error }, 'League roundup generation failed');
    throw error;
  }
}

/**
 * Generate model performance report
 */
async function generateModelReportContent(data: { period: string }) {
  const { period } = data;
  const log = loggers.contentWorker.child({ period });

  try {
    log.info('Generating model performance report');

    const topModels = await getTopModelsForReport(10);
    const overallStats = await getOverallModelStats();

    if (topModels.length === 0) {
      log.warn('No model data available for report');
      return { skipped: true, reason: 'no_data' };
    }

    const postId = await generateModelReport({
      period,
      topModels: topModels as any, // Type will be correct from getTopModelsForReport
      overallStats,
    });

    log.info({ postId, period }, '✓ Model report generated');

    return { success: true, postId };
  } catch (error) {
    log.error({ err: error }, 'Model report generation failed');
    throw error;
  }
}

/**
 * Scan all competitions and generate league roundups for those with finished matches
 * Runs weekly to generate roundups for each competition
 */
async function scanAndGenerateLeagueRoundups() {
  const log = loggers.contentWorker;
  const contentQueue = getQueue(QUEUE_NAMES.CONTENT);

  try {
    log.info('Scanning for competitions needing roundups');

    const competitions = await getActiveCompetitions();

    if (competitions.length === 0) {
      log.info('No active competitions');
      return { scanned: 0, queued: 0 };
    }

    let queuedCount = 0;

    for (const competition of competitions) {
      try {
        const roundupData = await getLeagueRoundupData(competition.id);

        if (!roundupData) {
          log.debug({ competitionId: competition.id }, 'No finished matches for this competition');
          continue;
        }

        // Queue the roundup generation
        await contentQueue.add(
          'generate-league-roundup',
          {
            type: 'league_roundup',
            data: {
              competitionId: competition.id,
              week: roundupData.week,
            },
          },
          {
            jobId: `roundup-${competition.id}-${roundupData.week}`, // Prevent duplicates
            ...CONTENT_JOB_OPTIONS,
          }
        );

        queuedCount++;
        log.info(
          { competitionId: competition.id, competition: competition.name, week: roundupData.week },
          'Queued league roundup'
        );
      } catch (error: any) {
        log.warn(
          { competitionId: competition.id, err: error.message },
          'Failed to queue roundup for competition'
        );
      }
    }

    log.info({ scanned: competitions.length, queued: queuedCount }, 'Roundup scan complete');

    return {
      success: true,
      scanned: competitions.length,
      queued: queuedCount,
    };
  } catch (error) {
    log.error({ err: error }, 'Error during roundup scan');
    throw error;
  }
}

/**
  * Generate post-match roundup content for a specific match
  * Triggered by settlement worker after match scoring completes
  */
 async function generatePostMatchRoundupContent(data: {
   matchId: string;
   triggeredAt: string;
 }) {
   const { matchId, triggeredAt } = data;
   const log = loggers.contentWorker.child({ matchId });

   try {
     log.info('Generating post-match roundup');

     // Generate the roundup using the new generator function
     const roundupId = await generatePostMatchRoundup(matchId);

     log.info({ matchId, roundupId, triggeredAt }, '✓ Post-match roundup generated');

     return {
       success: true,
       roundupId,
       matchId,
       skipped: false,
     };
   } catch (error) {
     log.error({ err: error }, 'Post-match roundup generation failed');
     throw error;
   }
 }

// Worker event handlers
export function setupContentWorkerEvents(worker: Worker) {
  const log = loggers.contentWorker;
  const dlqQueue = getQueue(QUEUE_NAMES.CONTENT_DLQ);

  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, 'Job completed');
    // Also record success here for event-based tracking
    recordQueueSuccess(QUEUE_NAMES.CONTENT);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    log.error({ jobId: job.id, err }, 'Job failed');

    // Check for rate limit errors and notify circuit breaker
    if (
      err.message.includes('429') ||
      err.message.toLowerCase().includes('rate limit')
    ) {
      await recordQueueRateLimitError(QUEUE_NAMES.CONTENT);
    }

    // Move to DLQ if retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      try {
        await dlqQueue.add('dlq-job', {
          originalJob: {
            id: job.id,
            name: job.name,
            data: job.data,
            attemptsMade: job.attemptsMade,
            failedReason: err.message,
            stackTrace: err.stack,
            timestamp: new Date().toISOString(),
          },
        }, {
          removeOnComplete: {
            age: 604800, // Keep DLQ jobs 7 days
          },
        });
        log.warn({ jobId: job.id }, 'Job moved to DLQ after retry exhaustion');
      } catch (dlqErr) {
        log.error({ jobId: job.id, err: dlqErr }, 'Failed to move job to DLQ');
      }
    }
  });

  worker.on('stalled', (jobId) => {
    log.warn({ jobId }, 'Job stalled');
  });

  worker.on('error', (err) => {
    log.error({ err }, 'Worker error');
  });
}
