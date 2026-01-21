import { NextRequest, NextResponse } from 'next/server';
import { getMatchesReadyForPrediction, createPrediction, upsertModel, deactivateOldModels, updateModelRetryStats, recordModelSuccess, recordModelFailure, getModelById } from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildBatchPrompt, BatchMatchContext } from '@/lib/football/prompt-builder';
import { BaseLLMProvider, BatchPredictionResult } from '@/lib/llm/providers/base';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import pLimit from 'p-limit';

// Concurrency limit for parallel provider processing
const PROVIDER_CONCURRENCY = 5;

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
    console.log('Generating predictions (batch mode)...');
    
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

    // Get matches ready for prediction (within 30 min OR within 5 min without predictions)
    // Only returns matches that have lineups available OR are within 5 mins of kickoff
    const matchesReadyForPrediction = await getMatchesReadyForPrediction();
    
    if (matchesReadyForPrediction.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches ready for predictions at this time',
        predictions: 0,
        budget: budgetStart,
      });
    }

    console.log(`Found ${matchesReadyForPrediction.length} matches ready for predictions`);

    // Build batch contexts for all matches
    const batchContexts: (BatchMatchContext & { matchDbId: string })[] = matchesReadyForPrediction.map(
      ({ match, competition, analysis }) => ({
        matchId: match.id, // Use DB ID as match_id for response matching
        matchDbId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: competition.name,
        kickoffTime: match.kickoffTime,
        analysis,
      })
    );

    // Group matches into batches of BATCH_SIZE
    const batches: (BatchMatchContext & { matchDbId: string })[][] = [];
    for (let i = 0; i < batchContexts.length; i += BATCH_SIZE) {
      batches.push(batchContexts.slice(i, i + BATCH_SIZE));
    }

    console.log(`Created ${batches.length} batch(es) of up to ${BATCH_SIZE} matches each`);

    let totalPredictions = 0;
    let successfulPredictions = 0;
    let skippedDueToBudget = 0;
    const errors: string[] = [];
    
    // Retry statistics tracking
    const retryStatsByProvider = new Map<string, ProviderRetryStats>();
    let totalRetries = 0;
    let successfulRetries = 0;

    // Process each batch with providers in parallel (controlled concurrency)
    const limit = pLimit(PROVIDER_CONCURRENCY);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const matchIds = batch.map(m => m.matchId);
      
      console.log(`\nProcessing batch ${batchIndex + 1}/${batches.length} (${batch.length} matches)`);
      console.log(`  Matches: ${batch.map(m => `${m.homeTeam} vs ${m.awayTeam}`).join(', ')}`);

      // Build batch prompt once per batch
      const batchPrompt = buildBatchPrompt(batch);

      // Check budget and health for all providers first (sequential to avoid race conditions)
      const providersToProcess: typeof activeProviders = [];
      let skippedDueToHealth = 0;
      for (const provider of activeProviders) {
        // Check if model is auto-disabled due to health issues
        const modelHealth = await getModelById(provider.id);
        if (modelHealth?.autoDisabled) {
          console.log(`  Skipping ${provider.id} - auto-disabled due to consecutive failures`);
          skippedDueToHealth += batch.length;
          continue;
        }
        
        const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
        if (budgetCheck.skip) {
          console.log(`  Skipping ${provider.id} - ${budgetCheck.reason}`);
          skippedDueToBudget += batch.length;
        } else {
          providersToProcess.push(provider);
          totalPredictions += batch.length;
        }
      }

      // Process providers in parallel with controlled concurrency
      const hasAnalysis = batch.some(m => m.analysis);
      
      const providerResults = await Promise.all(
        providersToProcess.map(provider =>
          limit(async () => {
            const result = {
              providerId: provider.id,
              successCount: 0,
              retryCount: 0,
              error: null as string | null,
            };

            try {
              console.log(`  ${provider.id}: Generating batch prediction...`);
              
              // Use batch prediction method WITH RETRY LOGIC
              const baseProvider = provider as BaseLLMProvider;
              const { result: predResult, retryCount } = await predictBatchWithRetry(
                baseProvider,
                batchPrompt,
                matchIds,
                MAX_RETRIES
              );

              result.retryCount = retryCount;

              // Record cost for ALL attempts (initial + retries)
              const totalAttempts = 1 + retryCount;
              if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
                const inputTokens = hasAnalysis ? 400 * batch.length : 200 * batch.length;
                const outputTokens = 50 * batch.length;
                const costPerAttempt = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
                const totalCost = costPerAttempt * totalAttempts;
                await recordPredictionCost(provider.id, totalCost);
              }

              if (predResult.success && predResult.predictions.size > 0) {
                // Save individual predictions from batch result
                for (const batchItem of batch) {
                  const prediction = predResult.predictions.get(batchItem.matchId);
                  
                  if (prediction) {
                    await createPrediction({
                      matchId: batchItem.matchDbId,
                      modelId: provider.id,
                      predictedHomeScore: prediction.homeScore,
                      predictedAwayScore: prediction.awayScore,
                      rawResponse: `[batch] ${prediction.homeScore}-${prediction.awayScore}`,
                      processingTimeMs: Math.round(predResult.processingTimeMs / batch.length),
                    });
                    result.successCount++;
                  } else {
                    const errorMsg = `${provider.id}: No prediction for ${batchItem.homeTeam} vs ${batchItem.awayTeam}`;
                    console.error(`    ${errorMsg}`);
                    errors.push(errorMsg);
                  }
                }
                
                // Record success - resets consecutive failure count
                await recordModelSuccess(provider.id);
                
                const retryInfo = retryCount > 0 ? `, retries: ${retryCount}` : '';
                console.log(`    ${provider.id}: Saved ${predResult.predictions.size}/${batch.length} predictions (attempts: ${totalAttempts}${retryInfo})`);
                
                if (predResult.failedMatchIds && predResult.failedMatchIds.length > 0) {
                  console.log(`    ${provider.id}: Missing: ${predResult.failedMatchIds.length} matches`);
                }
              } else {
                const retryInfo = retryCount > 0 ? ` (after ${retryCount} retries)` : '';
                result.error = `${provider.id} batch failed${retryInfo}: ${predResult.error}`;
                console.error(`    ${result.error}`);
                
                // Record failure - may auto-disable after 3 consecutive failures
                const healthResult = await recordModelFailure(provider.id, predResult.error || 'Unknown error');
                if (healthResult.autoDisabled) {
                  console.log(`    ${provider.id}: AUTO-DISABLED after 3 consecutive failures`);
                }
              }
            } catch (error) {
              // Record cost even on error (API was still called and billed)
              if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
                const inputTokens = hasAnalysis ? 400 * batch.length : 200 * batch.length;
                const outputTokens = 50 * batch.length;
                const apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
                await recordPredictionCost(provider.id, apiCost);
              }
              const errorMsg = error instanceof Error ? error.message : String(error);
              result.error = `Error with ${provider.id} for batch ${batchIndex + 1}: ${errorMsg}`;
              console.error(`    ${result.error}`);
              
              // Record failure - may auto-disable after 3 consecutive failures
              const healthResult = await recordModelFailure(provider.id, errorMsg);
              if (healthResult.autoDisabled) {
                console.log(`    ${provider.id}: AUTO-DISABLED after 3 consecutive failures`);
              }
            }

            return result;
          })
        )
      );

      // Aggregate results from parallel processing
      for (const provResult of providerResults) {
        successfulPredictions += provResult.successCount;
        if (provResult.error) {
          errors.push(provResult.error);
        }
        if (provResult.retryCount > 0) {
          totalRetries += provResult.retryCount;
          const wasSuccessful = provResult.successCount > 0 ? 1 : 0;
          successfulRetries += wasSuccessful;
          
          const existing = retryStatsByProvider.get(provResult.providerId) || { attempts: 0, successes: 0 };
          retryStatsByProvider.set(provResult.providerId, {
            attempts: existing.attempts + provResult.retryCount,
            successes: existing.successes + wasSuccessful,
          });
        }
      }
    }
    
    // Update retry stats in database for each provider that had retries
    for (const [modelId, stats] of retryStatsByProvider) {
      await updateModelRetryStats(modelId, stats.attempts, stats.successes);
    }

    // Get final budget status
    const budgetEnd = await getBudgetStatus();

    console.log(`\nGenerated ${successfulPredictions}/${totalPredictions} predictions`);
    console.log(`Budget used: $${(budgetEnd.spent - budgetStart.spent).toFixed(4)}`);
    if (skippedDueToBudget > 0) {
      console.log(`Skipped ${skippedDueToBudget} predictions due to budget`);
    }
    if (totalRetries > 0) {
      console.log(`Retry stats: ${totalRetries} attempts, ${successfulRetries} successful`);
      for (const [modelId, stats] of retryStatsByProvider) {
        console.log(`  ${modelId}: ${stats.attempts} retries, ${stats.successes} success`);
      }
    }

    // Convert retry stats map to plain object for JSON response
    const retryStatsByProviderObj: Record<string, ProviderRetryStats> = {};
    for (const [modelId, stats] of retryStatsByProvider) {
      retryStatsByProviderObj[modelId] = stats;
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${successfulPredictions} of ${totalPredictions} predictions (batch mode)`,
      matches: matchesReadyForPrediction.length,
      batches: batches.length,
      batchSize: BATCH_SIZE,
      providers: activeProviders.length,
      predictions: totalPredictions,
      successful: successfulPredictions,
      skippedDueToBudget,
      budget: {
        dailyLimit: budgetEnd.dailyBudget,
        spent: budgetEnd.spent,
        remaining: budgetEnd.remaining,
        percentUsed: budgetEnd.percentUsed,
      },
      retryStats: totalRetries > 0 ? {
        totalRetries,
        successfulRetries,
        byProvider: retryStatsByProviderObj,
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
