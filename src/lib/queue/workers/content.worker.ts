/**
 * Content Generation Worker
 * 
 * Generates AI-powered content for match previews, league roundups, and model reports.
 * Uses Google Gemini 3 Flash Preview via OpenRouter.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { GenerateContentPayload } from '../types';
import { generateMatchPreview } from '@/lib/content/generator';
import { getMatchesNeedingPreviews, getMatchBetsForPreview, hasMatchPreview } from '@/lib/content/queries';
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
    return { scanned: 0, queued: 0 };
  }
  
  log.info(`Found ${matchesNeedingPreviews.length} matches needing previews`);
  
  // Queue each match for preview generation
  const { getQueue } = await import('../index');
  const contentQueue = getQueue(QUEUE_NAMES.CONTENT);
  
  let queuedCount = 0;
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
       log.info(`Queued preview for ${match.homeTeam} vs ${match.awayTeam}`);
     } catch (error) {
       log.error({ err: error, matchId: match.id }, `Failed to queue match`);
     }
   }
   
   log.info(`✓ Scanned ${matchesNeedingPreviews.length} matches, queued ${queuedCount}`);
  
  return {
    scanned: matchesNeedingPreviews.length,
    queued: queuedCount,
  };
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
