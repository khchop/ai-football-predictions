/**
 * Content Generation Worker
 * 
 * Generates AI-powered content for match previews, league roundups, and model reports.
 * Uses Google Gemini 3 Flash Preview via OpenRouter.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES, getQueue } from '../index';
import type { GenerateContentPayload } from '../types';
import { generateMatchPreview } from '@/lib/content/generator';
import { 
  getMatchesNeedingPreviews, 
  getMatchBetsForPreview, 
  hasMatchPreview,
  getMatchesMissingPreMatchContent,
  getMatchesMissingBettingContent,
  getMatchesMissingPostMatchContent,
} from '@/lib/content/queries';
import { 
  generatePreMatchContent,
  generateBettingContent,
  generatePostMatchContent,
} from '@/lib/content/match-content';
import { loggers } from '@/lib/logger/modules';

export function createContentWorker() {
  return new Worker<GenerateContentPayload>(
    QUEUE_NAMES.CONTENT,
    async (job: Job<GenerateContentPayload>) => {
      const { type, data } = job.data;
      const log = loggers.contentWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Generating ${type} content`);
      
      try {
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
           log.info('League roundup generation not yet implemented');
           return { skipped: true, reason: 'not_implemented' };
         } else if (type === 'model_report') {
           log.info('Model report generation not yet implemented');
           return { skipped: true, reason: 'not_implemented' };
         } else if (type === 'scan_matches') {
           // Scan for matches that need previews and queue them
           return await scanMatchesNeedingPreviews();
         } else if (type === 'scan_match_content') {
           // Scan for matches missing content sections and generate backfill
           return await scanMatchesMissingContent();
         } else {
           throw new Error(`Unknown content type: ${type}`);
         }
       } catch (error) {
         log.error({ err: error }, `Error generating ${type}`);
         throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one at a time to avoid rate limits
      limiter: {
        max: 30, // Max 30 requests per minute (Together AI limit)
        duration: 60000, // Per minute
      },
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
           removeOnComplete: {
             age: 86400, // Keep for 24 hours
             count: 100,
           },
           removeOnFail: {
             age: 604800, // Keep failed jobs for 7 days
           },
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
         const success = await generatePreMatchContent(match.matchId);
         if (success) {
           results.preMatch.generated++;
           generated++;
           log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled pre-match content');
         } else {
           results.preMatch.failed++;
           log.warn({ matchId: match.matchId }, 'Pre-match backfill returned false (non-blocking)');
         }
       } catch (err) {
         results.preMatch.failed++;
         log.warn({ matchId: match.matchId, err }, 'Pre-match backfill failed (non-blocking)');
       }
     }

    // 2. Betting content (medium priority)
    const missingBetting = await getMatchesMissingBettingContent(24);
    results.betting.found = missingBetting.length;
    
     for (const match of missingBetting) {
       if (generated >= MAX_GENERATIONS_PER_SCAN) break;
       try {
         const success = await generateBettingContent(match.matchId);
         if (success) {
           results.betting.generated++;
           generated++;
           log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled betting content');
         } else {
           results.betting.failed++;
           log.warn({ matchId: match.matchId }, 'Betting backfill returned false (non-blocking)');
         }
       } catch (err) {
         results.betting.failed++;
         log.warn({ matchId: match.matchId, err }, 'Betting backfill failed (non-blocking)');
       }
     }

    // 3. Post-match content (lowest priority - historical)
    const missingPostMatch = await getMatchesMissingPostMatchContent(7);
    results.postMatch.found = missingPostMatch.length;
    
     for (const match of missingPostMatch) {
       if (generated >= MAX_GENERATIONS_PER_SCAN) break;
       try {
         const success = await generatePostMatchContent(match.matchId);
         if (success) {
           results.postMatch.generated++;
           generated++;
           log.info({ matchId: match.matchId, teams: `${match.homeTeam} vs ${match.awayTeam}` }, 'Backfilled post-match content');
         } else {
           results.postMatch.failed++;
           log.warn({ matchId: match.matchId }, 'Post-match backfill returned false (non-blocking)');
         }
       } catch (err) {
         results.postMatch.failed++;
         log.warn({ matchId: match.matchId, err }, 'Post-match backfill failed (non-blocking)');
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

// Worker event handlers
export function setupContentWorkerEvents(worker: Worker) {
  const log = loggers.contentWorker;
  
  worker.on('completed', (job) => {
    log.info({ jobId: job.id }, `Job completed`);
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, `Job failed`);
  });

  worker.on('error', (err) => {
    log.error({ err }, `Worker error`);
  });
}
