/**
 * Predictions Worker
 * 
 * Generates score predictions for all active models for a match.
 * Uses Kicktipp Quota Scoring system.
 * Runs at T-30m (after lineups are available).
 */

import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/nextjs';
import { getQueueConnection, QUEUE_NAMES } from '../index';
import type { PredictMatchPayload } from '../types';
import {
  getMatchById,
  getMatchAnalysisByMatchId,
  getPredictionsForMatch,
  createPredictionsBatch,
  recordModelSuccess,
  recordModelFailure,
  updateMatchQuotas,
} from '@/lib/db/queries';
import type { NewPrediction } from '@/lib/db/schema';
import { getActiveProviders } from '@/lib/llm';
import { buildBatchPrompt } from '@/lib/football/prompt-builder';
import { parseBatchPredictionResponse, BATCH_SYSTEM_PROMPT } from '@/lib/llm/prompt';
import { getStandingsForLeagues, getStandingFromMap } from '@/lib/football/standings';
import { getResult, calculateQuotas } from '@/lib/utils/scoring';
import { generateBettingContent } from '@/lib/content/match-content';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from '@/lib/logger/modules';
import { getMatchWithRetry } from '@/lib/utils/retry-helpers';

/**
 * Error classification for retry strategy
 */
type ErrorType = 'retryable' | 'unrecoverable' | 'unknown';

function classifyError(error: unknown): ErrorType {
  const errorMsg = error instanceof Error ? error.message : String(error);

  // Retryable: network errors, timeouts, connection issues
  if (errorMsg.includes('timeout') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('ETIMEDOUT') ||
      errorMsg.includes('ENOTFOUND') ||
      errorMsg.includes('ECONNRESET') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('429')) {
    return 'retryable';
  }

  // Unrecoverable: business logic issues that won't fix on retry
  if (errorMsg.includes('match started') ||
      errorMsg.includes('cancelled') ||
      errorMsg.includes('postponed') ||
      errorMsg.includes('kickoff passed')) {
    return 'unrecoverable';
  }

  // Unknown: retry but with backoff
  return 'unknown';
}

function isRetryable(error: unknown): boolean {
  const type = classifyError(error);
  return type === 'retryable' || type === 'unknown';
}

export function createPredictionsWorker() {
  return new Worker<PredictMatchPayload>(
    QUEUE_NAMES.PREDICTIONS,
    async (job: Job<PredictMatchPayload>) => {
      const { matchId, skipIfDone = false } = job.data;
      const log = loggers.predictionsWorker.child({ jobId: job.id, jobName: job.name });
      
      log.info(`Generating predictions for match ${matchId}`);
      
      try {
         // Check if predictions already exist
         if (skipIfDone) {
           const existingPredictions = await getPredictionsForMatch(matchId);
           if (existingPredictions.length > 0) {
             log.info(`Predictions already exist for match ${matchId}, skipping`);
             return { skipped: true, reason: 'predictions_already_exist', predictionCount: existingPredictions.length };
           }
         }
        
         // Get match data with retry (handles race condition where job runs before DB write completes)
         const matchData = await getMatchWithRetry(matchId, 3, 2000, log);
         if (!matchData) {
           log.warn({ matchId, retriesAttempted: 3 }, 'Match not found after retries');
           return { skipped: true, reason: 'match_not_found' };
         }
        
        const { match, competition } = matchData;
        
         if (match.status !== 'scheduled') {
           log.info(`Match ${matchId} is ${match.status}, skipping`);
           return { skipped: true, reason: 'match_not_scheduled', status: match.status };
         }
        
         // Get analysis (odds excluded from prompt, but analysis contains other stats)
         const analysis = await getMatchAnalysisByMatchId(matchId);
         if (!analysis) {
           log.info(`No analysis for match ${matchId}`);
           return { skipped: true, reason: 'no_analysis' };
         }
        
        // Get standings
        let homeStanding = null;
        let awayStanding = null;
        
         if (competition.apiFootballId) {
           try {
             const standingsMap = await getStandingsForLeagues([competition.apiFootballId], competition.season);
             homeStanding = getStandingFromMap(match.homeTeam, competition.apiFootballId, standingsMap);
             awayStanding = getStandingFromMap(match.awayTeam, competition.apiFootballId, standingsMap);
             } catch (error: unknown) {
               log.error({ 
                 matchId,
                 competitionId: competition.apiFootballId,
                 attemptsMade: job.attemptsMade,
                 err: error instanceof Error ? error.message : String(error)
               }, `Failed to get standings`);
             }
         }
        
          // Get active providers (filtered to exclude auto-disabled models)
          const providers = await getActiveProviders();
          log.info(`Generating predictions from ${providers.length} models`);
        
         let successCount = 0;
         let failCount = 0;
         
         // Collect all predictions to insert in batch
         const predictionsToInsert: NewPrediction[] = [];
         // Track which models succeeded so we can record health AFTER batch insert
         const successfulModelIds: string[] = [];
         
         // Generate predictions for each model
         for (const provider of providers) {
           try {
             // Build prompt (WITHOUT ODDS - only stats, form, H2H, standings)
             const prompt = buildBatchPrompt([{
               matchId: match.id,
               homeTeam: match.homeTeam,
               awayTeam: match.awayTeam,
               competition: competition.name,
               kickoffTime: match.kickoffTime,
               analysis,
               homeStanding,
               awayStanding,
             }]);
             
              // Call LLM with score prediction system prompt
               const rawResponse = await (provider as unknown as { callAPI: (system: string, user: string) => Promise<string> }).callAPI(BATCH_SYSTEM_PROMPT, prompt);
              
              // Parse simple JSON: [{match_id: "xxx", home_score: X, away_score: Y}]
              const parsed = parseBatchPredictionResponse(rawResponse, [matchId]);
              
               if (!parsed.success || parsed.predictions.length === 0) {
                 // Log error with raw response preview for debugging
                 const responsePreview = rawResponse.slice(0, 300).replace(/\s+/g, ' ');
                 log.error({ 
                   matchId, 
                   modelId: provider.id, 
                   error: parsed.error,
                   rawResponsePreview: responsePreview 
                 }, `Failed to parse prediction`);
                 failCount++;
                 continue;
               }
             
             const prediction = parsed.predictions[0];
             
             // Determine result tendency (H/D/A)
             const result = getResult(prediction.homeScore, prediction.awayScore);
             
             // Collect prediction for batch insert
             predictionsToInsert.push({
               id: uuidv4(),
               matchId,
               modelId: provider.id,
               predictedHome: prediction.homeScore,
               predictedAway: prediction.awayScore,
               predictedResult: result,
               status: 'pending',
             });
             
             // Track successful model but DON'T record health yet
             successfulModelIds.push(provider.id);
              log.info({ matchId, modelId: provider.id, prediction: `${prediction.homeScore}-${prediction.awayScore}` }, `✓ Prediction generated`);
              successCount++;
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log.error({ matchId, modelId: provider.id, err: error }, `Error generating prediction`);
                const { autoDisabled } = await recordModelFailure(provider.id, errorMessage);
                if (autoDisabled) {
                  log.warn({ matchId, modelId: provider.id }, `⚠️ Auto-disabled after 3 consecutive failures`);
                }
               failCount++;
            }
         }
         
           // Batch insert all predictions at once (1 query instead of N)
           if (predictionsToInsert.length > 0) {
             await createPredictionsBatch(predictionsToInsert);
             log.info({ matchId, predictionCount: predictionsToInsert.length }, `Inserted predictions in batch`);
             
             // Calculate and store quotas immediately after predictions are saved
             const quotas = calculateQuotas(predictionsToInsert.map(p => ({
               predictedHome: p.predictedHome,
               predictedAway: p.predictedAway,
             })));
             await updateMatchQuotas(matchId, quotas.home, quotas.draw, quotas.away);
             log.info({ matchId, quotas }, 'Quotas calculated and stored');
             
             // NOW record model health for all successful models (only after batch insert succeeds)
             for (const modelId of successfulModelIds) {
               await recordModelSuccess(modelId);
             }
             
             // Generate betting content (non-blocking)
             try {
               await generateBettingContent(matchId);
               log.info({ matchId }, 'Betting content generation triggered');
             } catch (err) {
               log.warn({ matchId, err }, 'Betting content generation failed (non-blocking)');
             }
           }
          
          log.info(`Complete: ${successCount} success, ${failCount} failed`);
        
        return { 
          success: true, 
          successCount, 
          failCount,
          totalModels: providers.length,
        };
       } catch (error: any) {
           log.error({ 
             matchId,
             attemptsMade: job.attemptsMade,
             err: error 
           }, `Error processing predictions`);
           
           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'predictions',
               matchId,
             },
             extra: {
               jobId: job.id,
               attempt: job.attemptsMade,
               matchId,
             },
           });
           
           // Throw error to enable BullMQ retry logic
           // Only transient errors should retry (network, timeout, rate limit)
          if (error.message?.includes('timeout') ||
             error.message?.includes('ECONNREFUSED') ||
             error.message?.includes('rate limit') ||
             error.message?.includes('429')) {
           throw new Error(`Retryable error for match ${matchId}: ${error.message}`);
         }
         // Non-retryable errors (business logic) should not retry
         throw error;
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one match at a time (models run in parallel within)
    }
  );
}
