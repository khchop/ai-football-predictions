/**
 * Predictions Worker
 *
 * Generates score predictions for all active models for a match.
 * Uses Kicktipp Quota Scoring system.
 * Runs at T-30m before each match.
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
import { FallbackAPIResult } from '@/lib/llm/providers/base';
import { getStandingsForLeagues, getStandingFromMap } from '@/lib/football/standings';
import { getResult, calculateQuotas } from '@/lib/utils/scoring';
import { generateBettingContent } from '@/lib/content/match-content';
import { v4 as uuidv4 } from 'uuid';
import { loggers } from '@/lib/logger/modules';
import { getMatchWithRetry } from '@/lib/utils/retry-helpers';
import { classifyErrorType, isModelSpecificFailure, ErrorType } from '@/lib/utils/retry-config';

/**
 * Error classification for retry strategy (LEGACY - now using retry-config)
 */
type LegacyErrorType = 'retryable' | 'unrecoverable' | 'unknown';

function classifyError(error: unknown): LegacyErrorType {
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
  const worker = new Worker<PredictMatchPayload>(
    QUEUE_NAMES.PREDICTIONS,
    async (job: Job<PredictMatchPayload>) => {
      const { matchId, skipIfDone = false, allowRetroactive } = job.data;
      const log = loggers.predictionsWorker.child({
        jobId: job.id,
        jobName: job.name,
        matchId,
        attempt: job.attemptsMade + 1,
      });

      log.info({ matchId }, 'Starting prediction job');

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
         if (!matchData || typeof matchData !== 'object') {
           log.warn({ matchId, retriesAttempted: 3 }, 'Match not found or invalid data');
           return { skipped: true, reason: 'match_not_found' };
         }
        
        const { match, competition } = matchData;
        
         if (match.status !== 'scheduled' && !allowRetroactive) {
           log.info(`Match ${matchId} is ${match.status}, skipping`);
           return { skipped: true, reason: 'match_not_scheduled', status: match.status };
         }

         if (allowRetroactive) {
           log.info(`Match ${matchId} is ${match.status}, generating predictions retroactively`);
         }
        
         // Get analysis (odds excluded from prompt, but analysis contains other stats)
         const analysis = await getMatchAnalysisByMatchId(matchId);
         if (!analysis) {
           log.warn(
             { matchId, attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
             `No analysis data found for match ${matchId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 5}) - analysis may still be processing`
           );
           throw new Error(`No analysis data found for match ${matchId} - analysis may still be processing`);
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
         
         // Generate predictions for each model with isolation
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

              // Use fallback-aware API call
              const apiResult = await (provider as unknown as {
                callAPIWithFallback: (system: string, user: string) => Promise<FallbackAPIResult>
              }).callAPIWithFallback(BATCH_SYSTEM_PROMPT, prompt);

              const rawResponse = apiResult.response;
              const usedFallback = apiResult.usedFallback;

              // Validate response before parsing (defensive null check)
              if (!rawResponse || typeof rawResponse !== 'string') {
                const errorType = ErrorType.PARSE_ERROR; // Empty response treated as parse error
                log.warn({ modelId: provider.id, errorType }, 'Provider returned null/invalid response');
                await recordModelFailure(provider.id, 'empty_response', errorType);
                failCount++;
                continue;
              }

              // Parse simple JSON: [{match_id: "xxx", home_score: X, away_score: Y}]
              const parsed = parseBatchPredictionResponse(rawResponse, [matchId]);

               if (!parsed.success || parsed.predictions.length === 0) {
                 // Log error with raw response preview for debugging
                 const responsePreview = rawResponse.slice(0, 300).replace(/\s+/g, ' ');
                 const errorType = ErrorType.PARSE_ERROR;
                 log.warn({
                   matchId,
                   modelId: provider.id,
                   error: parsed.error,
                   errorType,
                   rawResponsePreview: responsePreview
                 }, `Failed to parse prediction`);
                 await recordModelFailure(provider.id, parsed.error || 'Parse failed', errorType);
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
               usedFallback,  // Track fallback usage
             });

             // Track successful model but DON'T record health yet
             successfulModelIds.push(provider.id);
              log.info({
                matchId,
                modelId: provider.id,
                prediction: `${prediction.homeScore}-${prediction.awayScore}`,
                usedFallback,
              }, `${usedFallback ? '↩' : '✓'} Prediction generated${usedFallback ? ' (via fallback)' : ''}`);
              successCount++;
              } catch (modelError: unknown) {
                const errorMessage = modelError instanceof Error ? modelError.message : String(modelError);
                const errorType = classifyErrorType(modelError);

                log.warn({
                  matchId,
                  modelId: provider.id,
                  error: errorMessage,
                  errorType,
                  countsTowardDisable: isModelSpecificFailure(errorType),
                }, `Model prediction failed`);

                await recordModelFailure(provider.id, errorMessage, errorType);

                // Log if error is model-specific (counts toward disable threshold)
                if (isModelSpecificFailure(errorType)) {
                  log.warn({
                    modelId: provider.id,
                    errorType,
                    errorMessage,
                  }, 'Model-specific failure - counts toward disable threshold');
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
          
          log.info({
            totalModels: providers.length,
            successful: successCount,
            failed: failCount,
          }, 'Prediction job completed');

        return {
          success: true,
          successCount,
          failCount,
          totalModels: providers.length,
        };
       } catch (error: unknown) {
           const errorMsg = error instanceof Error ? error.message : String(error);
           const errorType = classifyError(error);

           log.error({
             matchId,
             error: errorMsg,
             errorType,
             attemptsMade: job.attemptsMade,
           }, 'Job failed with exception');

           Sentry.captureException(error, {
             level: 'error',
             tags: {
               worker: 'predictions',
               matchId,
               errorType,
             },
             extra: {
               jobId: job.id,
               attempt: job.attemptsMade,
               matchId,
             },
           });

           // Throw for retryable errors (triggers BullMQ retry)
           if (isRetryable(error)) {
             throw new Error(`Retryable: ${errorMsg}`);
           }

         // Return skip result for unrecoverable errors (no retry)
         return {
           success: false,
           skipped: true,
           reason: 'unrecoverable',
           error: errorMsg,
         };
       }
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one match at a time (models run in parallel within)
      settings: {
        backoffStrategy: (attemptsMade: number, type?: string, err?: Error) => {
          const errorMsg = err?.message || '';

          // Rate limit: 60s fixed backoff
          if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
            loggers.predictionsWorker.info({ attemptsMade }, 'Rate limit detected, backoff 60s');
            return 60000;
          }

          // Timeout: Linear backoff (5s, 10s, 15s... max 30s)
          if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
            const backoff = Math.min(attemptsMade * 5000, 30000);
            loggers.predictionsWorker.info({ attemptsMade, backoff }, 'Timeout detected, linear backoff');
            return backoff;
          }

          // Parse errors: Quick retry (5s, 10s, 20s)
          if (errorMsg.includes('parse') || errorMsg.includes('JSON')) {
            const backoff = Math.min(5000 * Math.pow(2, attemptsMade - 1), 20000);
            loggers.predictionsWorker.info({ attemptsMade, backoff }, 'Parse error detected, exponential backoff');
            return backoff;
          }

          // Default: Exponential backoff with jitter
          const baseDelay = 1000;
          const exponentialDelay = baseDelay * Math.pow(2, attemptsMade - 1);
          const jitter = Math.random() * 0.2; // 20% jitter
          const backoff = Math.min(exponentialDelay * (1 + jitter), 60000);
          loggers.predictionsWorker.info({ attemptsMade, backoff }, 'Default exponential backoff with jitter');
          return backoff;
        },
      },
    }
  );

  // Worker event handlers for monitoring
  worker.on('completed', (job) => {
    loggers.predictionsWorker.info({
      jobId: job.id,
      matchId: job.data.matchId,
      attempts: job.attemptsMade,
    }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    loggers.predictionsWorker.error({
      jobId: job?.id,
      matchId: job?.data.matchId,
      error: err.message,
      attempts: job?.attemptsMade,
    }, 'Job failed');
  });

  worker.on('error', (err) => {
    loggers.predictionsWorker.error({ error: err.message }, 'Worker error');
  });

  return worker;
}
