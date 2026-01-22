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

export function createContentWorker() {
  return new Worker<GenerateContentPayload>(
    QUEUE_NAMES.CONTENT,
    async (job: Job<GenerateContentPayload>) => {
      const { type, data } = job.data;
      
      console.log(`[Content Worker] Generating ${type} content`);
      
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
          console.log('[Content Worker] League roundup generation not yet implemented');
          return { skipped: true, reason: 'not_implemented' };
        } else if (type === 'model_report') {
          console.log('[Content Worker] Model report generation not yet implemented');
          return { skipped: true, reason: 'not_implemented' };
        } else if (type === 'scan_matches') {
          // Scan for matches that need previews and queue them
          return await scanMatchesNeedingPreviews();
        } else {
          throw new Error(`Unknown content type: ${type}`);
        }
      } catch (error) {
        console.error(`[Content Worker] Error generating ${type}:`, error);
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one at a time to avoid rate limits
      limiter: {
        max: 10, // Max 10 requests
        duration: 60000, // Per minute (OpenRouter free tier limit)
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
  
  // Check if preview already exists
  const exists = await hasMatchPreview(matchId);
  if (exists) {
    console.log(`[Content Worker] Preview already exists for ${homeTeam} vs ${awayTeam}`);
    return { skipped: true, reason: 'preview_exists' };
  }
  
  console.log(`[Content Worker] Generating preview for ${homeTeam} vs ${awayTeam}`);
  
  // Get AI model bets for this match (if available)
  const aiPredictions = await getMatchBetsForPreview(matchId);
  
  // Generate the preview
  const previewId = await generateMatchPreview({
    ...data,
    aiPredictions,
  });
  
  console.log(`[Content Worker] ✓ Preview generated: ${previewId}`);
  
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
  console.log('[Content Worker] Scanning for matches needing previews...');
  
  const matchesNeedingPreviews = await getMatchesNeedingPreviews();
  
  if (matchesNeedingPreviews.length === 0) {
    console.log('[Content Worker] No matches need previews at this time');
    return { scanned: 0, queued: 0 };
  }
  
  console.log(`[Content Worker] Found ${matchesNeedingPreviews.length} matches needing previews`);
  
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
      console.log(`[Content Worker] Queued preview for ${match.homeTeam} vs ${match.awayTeam}`);
    } catch (error) {
      console.error(`[Content Worker] Failed to queue match ${match.id}:`, error);
    }
  }
  
  console.log(`[Content Worker] ✓ Scanned ${matchesNeedingPreviews.length} matches, queued ${queuedCount}`);
  
  return {
    scanned: matchesNeedingPreviews.length,
    queued: queuedCount,
  };
}

// Worker event handlers
export function setupContentWorkerEvents(worker: Worker) {
  worker.on('completed', (job) => {
    console.log(`[Content Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Content Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Content Worker] Worker error:', err);
  });
}
