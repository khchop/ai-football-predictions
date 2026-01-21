import { NextRequest, NextResponse } from 'next/server';
import { 
  getMatchesReadyForPrediction, 
  createPrediction, 
  upsertModel, 
  deactivateOldModels, 
  updateModelRetryStats, 
  recordModelSuccess, 
  recordModelFailure, 
  getModelById,
  getMissingModelPredictions,
  recordPredictionAttemptFailure,
  clearPredictionAttempt,
  cleanupOldPredictionAttempts,
} from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildBatchPrompt } from '@/lib/football/prompt-builder';
import { BaseLLMProvider, BatchPredictionResult } from '@/lib/llm/providers/base';
import { validateCronRequest } from '@/lib/auth/cron-auth';

// Batch size for grouping matches (10 matches per API call)
const BATCH_SIZE = 10;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000]; // Exponential backoff: 1s, 2s

// Errors that indicate JSON parsing failed (retryable)
const RETRYABLE_ERROR_PATTERNS = [
  'No JSON array found',
  'Failed to parse batch JSON',
  'No predictions parsed',
  'Parsed result is not an array',
  'API response contained no usable content',
  'No JSON object found',
];

// Check if an error is retryable (JSON parse failure vs network/timeout)
function isRetryableError(error: string | undefined): boolean {
  if (!error) return false;
  return RETRYABLE_ERROR_PATTERNS.some(pattern => error.includes(pattern));
}

// Retry stats tracking per provider
interface ProviderRetryStats {
  attempts: number;
  successes: number;
}

// Predict with retry logic
async function predictBatchWithRetry(
  provider: BaseLLMProvider,
  batchPrompt: string,
  matchIds: string[],
  maxRetries: number = MAX_RETRIES
): Promise<{
  result: BatchPredictionResult;
  retryCount: number;
}> {
  let lastResult: BatchPredictionResult;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Delay before retry (not on first attempt)
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      console.log(`    Retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retryCount++;
    }

    lastResult = await provider.predictBatch(batchPrompt, matchIds);

    // Success - return immediately
    if (lastResult.success) {
      if (attempt > 0) {
        console.log(`    Retry ${attempt} succeeded`);
      }
      return { result: lastResult, retryCount };
    }

    // Check if error is retryable
    if (!isRetryableError(lastResult.error)) {
      console.log(`    Non-retryable error: ${lastResult.error}`);
      break;
    }

    // Log the parse failure
    if (attempt < maxRetries) {
      console.log(`    Parse failed: ${lastResult.error}`);
    }
  }

  return { result: lastResult!, retryCount };
}

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    console.log('Generating predictions (retry mode - missing models only)...');
    
    // Get budget status at start
    const budgetStart = await getBudgetStatus();
    console.log(`Budget status: $${budgetStart.spent.toFixed(4)} spent of $${budgetStart.dailyBudget.toFixed(2)} (${budgetStart.percentUsed.toFixed(1)}%)`);
    
    // Get active providers (those with configured API keys)
    const activeProviders = getActiveProviders();
    
    if (activeProviders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No LLM providers configured. Please add API keys to .env.local',
      }, { status: 400 });
    }

    console.log(`Active providers: ${activeProviders.length} (${activeProviders.map(p => p.id).join(', ')})`);

    // Ensure all providers exist in the database and deactivate old ones
    const currentModelIds = ALL_PROVIDERS.map(p => p.id);
    for (const provider of ALL_PROVIDERS) {
      await upsertModel({
        id: provider.id,
        provider: provider.name,
        modelName: provider.model,
        displayName: provider.displayName,
        isPremium: provider.isPremium,
        active: activeProviders.some(p => p.id === provider.id),
      });
    }
    // Deactivate any models not in the current ALL_PROVIDERS list
    await deactivateOldModels(currentModelIds);

    // Get matches ready for prediction (within 90 min OR within 5 min without predictions)
    // Only returns matches that have lineups available OR are within 5 mins of kickoff
    const matchesReadyForPrediction = await getMatchesReadyForPrediction();
    
    if (matchesReadyForPrediction.length === 0) {
      console.log('No matches ready for predictions');
      // Clean up old attempt records
      const cleanedUp = await cleanupOldPredictionAttempts(7);
      return NextResponse.json({
        success: true,
        message: 'No matches ready for predictions at this time',
        predictions: 0,
        budget: budgetStart,
        cleanup: `Removed ${cleanedUp} old attempt records`,
      });
    }

    console.log(`Found ${matchesReadyForPrediction.length} matches ready for predictions`);

    const matchIds = matchesReadyForPrediction.map(m => m.match.id);
    const activeModelIds = activeProviders.map(p => p.id);

    // Get missing model/match pairs (excluding those with 3+ attempts)
    const missingPairs = await getMissingModelPredictions(matchIds, activeModelIds);
    
    if (missingPairs.length === 0) {
      console.log('All matches have predictions or have reached max retry attempts');
      // Clean up old attempt records
      const cleanedUp = await cleanupOldPredictionAttempts(7);
      return NextResponse.json({
        success: true,
        message: 'All matches have complete predictions',
        predictions: 0,
        budget: budgetStart,
        cleanup: `Removed ${cleanedUp} old attempt records`,
      });
    }

    console.log(`Found ${missingPairs.length} missing model/match pairs to generate`);

    // Group missing pairs by model (for batching)
    const pairsByModel = new Map<string, string[]>();
    for (const { matchId, modelId } of missingPairs) {
      if (!pairsByModel.has(modelId)) {
        pairsByModel.set(modelId, []);
      }
      pairsByModel.get(modelId)!.push(matchId);
    }

    let totalPredictions = 0;
    let successfulPredictions = 0;
    let retriedPredictions = 0;
    let gaveUpPredictions = 0;
    const errors: string[] = [];
    
    // Retry statistics tracking
    const retryStatsByProvider = new Map<string, ProviderRetryStats>();
    let totalRetries = 0;
    let successfulRetries = 0;

    // Process each model with its missing matches
    for (const [modelId, matchesToPredict] of Array.from(pairsByModel.entries())) {
      const provider = activeProviders.find(p => p.id === modelId);
      if (!provider) continue;

      // Check if model is auto-disabled
      const modelHealth = await getModelById(modelId);
      if (modelHealth?.autoDisabled) {
        console.log(`Skipping ${modelId} - auto-disabled due to consecutive failures`);
        gaveUpPredictions += matchesToPredict.length;
        continue;
      }

      // Check budget
      const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
      if (budgetCheck.skip) {
        console.log(`Skipping ${modelId} - ${budgetCheck.reason}`);
        continue;
      }

      totalPredictions += matchesToPredict.length;

      // Group matches into batches for this model
      const batches: string[][] = [];
      for (let i = 0; i < matchesToPredict.length; i += BATCH_SIZE) {
        batches.push(matchesToPredict.slice(i, i + BATCH_SIZE));
      }

      console.log(`\n${modelId}: Processing ${matchesToPredict.length} missing predictions in ${batches.length} batch(es)`);

      // Process batches for this model in sequence
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchMatchIds = batches[batchIdx];
        const batchMatches = matchesReadyForPrediction.filter(m => batchMatchIds.includes(m.match.id));

        if (batchMatches.length === 0) continue;

        console.log(`  Batch ${batchIdx + 1}/${batches.length}: ${batchMatches.map(m => `${m.match.homeTeam} vs ${m.match.awayTeam}`).join(', ')}`);

        // Build batch prompt for only these matches
        const batchPrompt = buildBatchPrompt(
          batchMatches.map(m => ({
            matchId: m.match.id,
            homeTeam: m.match.homeTeam,
            awayTeam: m.match.awayTeam,
            competition: m.competition.name,
            kickoffTime: m.match.kickoffTime,
            analysis: m.analysis,
          }))
        );

        try {
          const hasAnalysis = batchMatches.some(m => m.analysis);
          
          // Predict with retry logic
          const baseProvider = provider as BaseLLMProvider;
          const { result: predResult, retryCount } = await predictBatchWithRetry(
            baseProvider,
            batchPrompt,
            batchMatchIds,
            MAX_RETRIES
          );

          // Record cost for ALL attempts (initial + retries)
          const totalAttempts = 1 + retryCount;
          if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
            const inputTokens = hasAnalysis ? 400 * batchMatches.length : 200 * batchMatches.length;
            const outputTokens = 50 * batchMatches.length;
            const costPerAttempt = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
            const totalCost = costPerAttempt * totalAttempts;
            await recordPredictionCost(provider.id, totalCost);
          }

          if (predResult.success && predResult.predictions.size > 0) {
            // Save individual predictions from batch result
            for (const batchMatch of batchMatches) {
              const prediction = predResult.predictions.get(batchMatch.match.id);
              
              if (prediction) {
                await createPrediction({
                  matchId: batchMatch.match.id,
                  modelId: provider.id,
                  predictedHomeScore: prediction.homeScore,
                  predictedAwayScore: prediction.awayScore,
                  rawResponse: `[batch] ${prediction.homeScore}-${prediction.awayScore}`,
                  processingTimeMs: Math.round(predResult.processingTimeMs / batchMatches.length),
                });
                successfulPredictions++;
                retriedPredictions++;
                
                // Clear attempt record on success
                await clearPredictionAttempt(batchMatch.match.id, provider.id);
              } else {
                const errorMsg = `${modelId}: No prediction for ${batchMatch.match.homeTeam} vs ${batchMatch.match.awayTeam}`;
                console.error(`    ${errorMsg}`);
                errors.push(errorMsg);
                
                // Record failed attempt
                await recordPredictionAttemptFailure(batchMatch.match.id, provider.id, errorMsg);
              }
            }
            
            // Record success - resets consecutive failure count
            await recordModelSuccess(provider.id);
            
            const retryInfo = retryCount > 0 ? `, retries: ${retryCount}` : '';
            console.log(`    Success: Saved ${predResult.predictions.size}/${batchMatches.length} predictions (attempts: ${totalAttempts}${retryInfo})`);
            
            if (predResult.failedMatchIds && predResult.failedMatchIds.length > 0) {
              console.log(`    Missing: ${predResult.failedMatchIds.length} matches`);
            }

            if (retryCount > 0) {
              totalRetries += retryCount;
              successfulRetries++;
              const existing = retryStatsByProvider.get(modelId) || { attempts: 0, successes: 0 };
              retryStatsByProvider.set(modelId, {
                attempts: existing.attempts + retryCount,
                successes: existing.successes + 1,
              });
            }
          } else {
            const retryInfo = retryCount > 0 ? ` (after ${retryCount} retries)` : '';
            const errorMsg = `${modelId} batch failed${retryInfo}: ${predResult.error}`;
            console.error(`    ${errorMsg}`);
            errors.push(errorMsg);
            
            // Record failure for all matches in batch
            for (const batchMatch of batchMatches) {
              await recordPredictionAttemptFailure(batchMatch.match.id, provider.id, predResult.error || 'Unknown error');
            }
            
            gaveUpPredictions += batchMatches.length;
            
            // Record model failure - may auto-disable after 3 consecutive failures
            const healthResult = await recordModelFailure(provider.id, predResult.error || 'Unknown error');
            if (healthResult.autoDisabled) {
              console.log(`    ${modelId}: AUTO-DISABLED after 3 consecutive failures`);
            }
          }
        } catch (error) {
          // Record cost even on error (API was still called and billed)
          if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
            const hasAnalysis = batchMatches.some(m => m.analysis);
            const inputTokens = hasAnalysis ? 400 * batchMatches.length : 200 * batchMatches.length;
            const outputTokens = 50 * batchMatches.length;
            const apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
            await recordPredictionCost(provider.id, apiCost);
          }
          
          const errorMsg = error instanceof Error ? error.message : String(error);
          const msg = `Error with ${modelId} for batch ${batchIdx + 1}: ${errorMsg}`;
          console.error(`    ${msg}`);
          errors.push(msg);
          
          // Record failure for all matches in batch
          for (const batchMatch of batchMatches) {
            await recordPredictionAttemptFailure(batchMatch.match.id, provider.id, errorMsg);
          }
          
          gaveUpPredictions += batchMatches.length;
          
          // Record model failure
          const healthResult = await recordModelFailure(provider.id, errorMsg);
          if (healthResult.autoDisabled) {
            console.log(`    ${modelId}: AUTO-DISABLED after 3 consecutive failures`);
          }
        }
      }
    }

    // Update retry stats in database
    for (const [modelId, stats] of retryStatsByProvider) {
      await updateModelRetryStats(modelId, stats.attempts, stats.successes);
    }

    // Clean up old attempt records
    const cleanedUp = await cleanupOldPredictionAttempts(7);

    // Get final budget status
    const budgetEnd = await getBudgetStatus();

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total missing pairs: ${totalPredictions}`);
    console.log(`Successful new predictions: ${successfulPredictions}`);
    console.log(`Gave up (3+ failures): ${gaveUpPredictions}`);
    if (totalRetries > 0) {
      console.log(`Retry stats: ${totalRetries} attempts, ${successfulRetries} successful`);
    }
    console.log(`Cleaned up ${cleanedUp} old attempt records`);
    console.log(`Budget used: $${(budgetEnd.spent - budgetStart.spent).toFixed(4)}`);

    return NextResponse.json({
      success: true,
      message: `Generated ${successfulPredictions} predictions`,
      summary: {
        matchesProcessed: matchesReadyForPrediction.length,
        missingPairs: totalPredictions,
        newPredictions: successfulPredictions,
        retriedPredictions,
        gaveUp: gaveUpPredictions,
        attemptsCleanedUp: cleanedUp,
      },
      budget: {
        dailyLimit: budgetEnd.dailyBudget,
        spent: budgetEnd.spent,
        remaining: budgetEnd.remaining,
        percentUsed: budgetEnd.percentUsed,
      },
      retryStats: totalRetries > 0 ? {
        totalRetries,
        successfulRetries,
      } : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error generating predictions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
