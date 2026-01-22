import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
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
  createPredictionsBatch,
  clearPredictionAttemptsBatch,
} from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildBatchPrompt, BatchMatchContextWithStandings } from '@/lib/football/prompt-builder';
import { BaseLLMProvider, BatchPredictionResult } from '@/lib/llm/providers/base';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import type { NewPrediction } from '@/lib/db/schema';
import { getStandingByTeamName } from '@/lib/football/standings';
import { refreshOddsForMatch, getAnalysisForMatch } from '@/lib/football/match-analysis';

// Concurrency settings
const MODEL_CONCURRENCY = 5; // Process 5 models in parallel
const MAX_RUNTIME_MS = 4 * 60 * 1000; // 4 minute time budget (leave 1 min buffer for overhead)

// Batch size for grouping matches (10 matches per API call)
const BATCH_SIZE = 10;

// Retry configuration - REDUCED for faster failure detection
const MAX_RETRIES = 1; // Changed from 2
const RETRY_DELAYS = [500, 1000]; // Changed from [1000, 2000]
const RATE_LIMIT_RETRY_DELAYS = [1000, 2000]; // Changed from [3000, 5000]

// Errors that indicate JSON parsing failed (retryable)
const JSON_PARSE_ERROR_PATTERNS = [
  'No JSON array found',
  'Failed to parse batch JSON',
  'No predictions parsed',
  'Parsed result is not an array',
  'API response contained no usable content',
  'No JSON object found',
  'Unexpected token',
];

// Errors that are definitely NOT worth retrying (auth, budget, etc)
const NON_RETRYABLE_ERROR_PATTERNS = [
  'API error 402', // Payment Required (OpenRouter/Provider budget)
  'API error 401', // Unauthorized
  'API error 403', // Forbidden
  'spend limit exceeded',
  'insufficient balance',
  'credit limit reached',
];

// Rate limit errors
const RATE_LIMIT_PATTERNS = [
  'API error 429',
  'rate limit',
  'too many requests',
  'throttled',
];

// Check if an error is a non-retryable error
function isNonRetryableError(error: string | undefined): boolean {
  if (!error) return false;
  return NON_RETRYABLE_ERROR_PATTERNS.some(pattern => error.toLowerCase().includes(pattern.toLowerCase()));
}

// Check if an error is a rate limit error
function isRateLimitError(error: string | undefined): boolean {
  if (!error) return false;
  return RATE_LIMIT_PATTERNS.some(pattern => error.toLowerCase().includes(pattern.toLowerCase()));
}

// Check if an error is retryable (JSON parse failure or rate limit)
function isRetryableError(error: string | undefined): boolean {
  if (!error) return false;
  
  // If it's specifically non-retryable (budget/auth), return false
  if (isNonRetryableError(error)) return false;
  
  // Rate limits are retryable with longer delays
  if (isRateLimitError(error)) return true;
  
  // JSON parse errors are retryable
  return JSON_PARSE_ERROR_PATTERNS.some(pattern => error.includes(pattern));
}

// Retry stats tracking per provider
interface ProviderRetryStats {
  attempts: number;
  successes: number;
}

// Result from processing a single model
interface ModelProcessingResult {
  modelId: string;
  success: boolean;
  successfulPredictions: number;
  gaveUpPredictions: number;
  errors: string[];
  retryStats?: ProviderRetryStats;
  skipped?: boolean;
  reason?: string;
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
      // Use longer delays if we hit a rate limit
      const delayList = isRateLimitError(lastResult!.error) ? RATE_LIMIT_RETRY_DELAYS : RETRY_DELAYS;
      const delay = delayList[attempt - 1] || delayList[delayList.length - 1];
      
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

    // Log the error type
    if (attempt < maxRetries) {
      const type = isRateLimitError(lastResult.error) ? 'Rate limit' : 'Parse failure';
      console.log(`    ${type}: ${lastResult.error}`);
    }
  }

  return { result: lastResult!, retryCount };
}

// Process predictions for a single model (extracted for parallel execution)
async function processModelPredictions(
  modelId: string,
  matchesToPredict: string[],
  matchesReadyForPrediction: Awaited<ReturnType<typeof getMatchesReadyForPrediction>>,
  activeProviders: ReturnType<typeof getActiveProviders>,
  startTime: number
): Promise<ModelProcessingResult> {
  // Check time budget at start
  if (Date.now() - startTime > MAX_RUNTIME_MS) {
    return {
      modelId,
      success: false,
      successfulPredictions: 0,
      gaveUpPredictions: matchesToPredict.length,
      errors: [],
      skipped: true,
      reason: 'time_budget_exceeded',
    };
  }

  const provider = activeProviders.find(p => p.id === modelId);
  if (!provider) {
    return {
      modelId,
      success: false,
      successfulPredictions: 0,
      gaveUpPredictions: matchesToPredict.length,
      errors: [`Provider ${modelId} not found`],
      skipped: true,
      reason: 'provider_not_found',
    };
  }

  // Check if model is auto-disabled
  const modelHealth = await getModelById(modelId);
  if (modelHealth?.autoDisabled) {
    console.log(`Skipping ${modelId} - auto-disabled due to consecutive failures`);
    return {
      modelId,
      success: false,
      successfulPredictions: 0,
      gaveUpPredictions: matchesToPredict.length,
      errors: [],
      skipped: true,
      reason: 'auto_disabled',
    };
  }

  // Check budget
  const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
  if (budgetCheck.skip) {
    console.log(`Skipping ${modelId} - ${budgetCheck.reason}`);
    return {
      modelId,
      success: false,
      successfulPredictions: 0,
      gaveUpPredictions: matchesToPredict.length,
      errors: [],
      skipped: true,
      reason: budgetCheck.reason,
    };
  }

  // Group matches into batches for this model
  const batches: string[][] = [];
  for (let i = 0; i < matchesToPredict.length; i += BATCH_SIZE) {
    batches.push(matchesToPredict.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n${modelId}: Processing ${matchesToPredict.length} missing predictions in ${batches.length} batch(es)`);

  let successfulPredictions = 0;
  let gaveUpPredictions = 0;
  const errors: string[] = [];
  let totalRetries = 0;
  let successfulRetries = 0;

  // Process batches for this model in sequence
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    // Check time budget before each batch
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`  ${modelId}: Time budget exceeded, stopping after batch ${batchIdx}`);
      gaveUpPredictions += batches.slice(batchIdx).flat().length;
      break;
    }

    const batchMatchIds = batches[batchIdx];
    const batchMatches = matchesReadyForPrediction.filter(m => batchMatchIds.includes(m.match.id));

    if (batchMatches.length === 0) continue;

    console.log(`  Batch ${batchIdx + 1}/${batches.length}: ${batchMatches.map(m => `${m.match.homeTeam} vs ${m.match.awayTeam}`).join(', ')}`);

    // Refresh odds for all matches in batch BEFORE betting (in parallel)
    console.log(`  Refreshing odds for ${batchMatches.length} matches...`);
    const oddsRefreshPromises = batchMatches.map(async (m) => {
      if (!m.match.externalId) return { matchId: m.match.id, success: false };
      
      try {
        const fixtureId = parseInt(m.match.externalId, 10);
        const success = await refreshOddsForMatch(m.match.id, fixtureId);
        return { matchId: m.match.id, success };
      } catch (error) {
        console.error(`  Error refreshing odds for ${m.match.homeTeam} vs ${m.match.awayTeam}:`, error);
        return { matchId: m.match.id, success: false };
      }
    });

    const oddsResults = await Promise.all(oddsRefreshPromises);
    const successfulOddsRefresh = oddsResults.filter(r => r.success).length;
    console.log(`  Refreshed odds: ${successfulOddsRefresh}/${batchMatches.length} successful`);

    // Reload analysis data to get fresh odds
    const freshAnalysisPromises = batchMatches.map(async (m) => {
      const freshAnalysis = await getAnalysisForMatch(m.match.id);
      return { matchId: m.match.id, analysis: freshAnalysis };
    });
    const freshAnalysisResults = await Promise.all(freshAnalysisPromises);
    const analysisMap = new Map(freshAnalysisResults.map(a => [a.matchId, a.analysis]));
    
    // Update batchMatches with fresh analysis containing new odds
    const batchMatchesWithFreshOdds = batchMatches.map(m => ({
      ...m,
      analysis: analysisMap.get(m.match.id) || m.analysis,
    }));

    // Fetch standings for all matches in batch (in parallel)
    const standingsPromises = batchMatchesWithFreshOdds.map(async (m) => {
      const leagueId = m.competition.apiFootballId;
      if (!leagueId) return { matchId: m.match.id, homeStanding: null, awayStanding: null };
      
      try {
        const [homeStanding, awayStanding] = await Promise.all([
          getStandingByTeamName(m.match.homeTeam, leagueId),
          getStandingByTeamName(m.match.awayTeam, leagueId),
        ]);
        
        return {
          matchId: m.match.id,
          homeStanding,
          awayStanding,
        };
      } catch (error) {
        console.error(`  Error fetching standings for ${m.match.homeTeam} vs ${m.match.awayTeam}:`, error);
        return { matchId: m.match.id, homeStanding: null, awayStanding: null };
      }
    });

    const standingsResults = await Promise.all(standingsPromises);
    const standingsMap = new Map(standingsResults.map(s => [s.matchId, { home: s.homeStanding, away: s.awayStanding }]));

    // Build batch prompt with standings and fresh odds
    const batchPrompt = buildBatchPrompt(
      batchMatchesWithFreshOdds.map(m => {
        const standings = standingsMap.get(m.match.id);
        return {
          matchId: m.match.id,
          homeTeam: m.match.homeTeam,
          awayTeam: m.match.awayTeam,
          competition: m.competition.name,
          kickoffTime: m.match.kickoffTime,
          analysis: m.analysis,
          homeStanding: standings?.home || null,
          awayStanding: standings?.away || null,
        } as BatchMatchContextWithStandings;
      })
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
        // Collect predictions for batch insert
        const predictionsToInsert: Array<Omit<NewPrediction, 'id'>> = [];
        const attemptsToClean: Array<{ matchId: string; modelId: string }> = [];

        // Collect all successful predictions
        for (const batchMatch of batchMatches) {
          const prediction = predResult.predictions.get(batchMatch.match.id);

          if (prediction) {
            predictionsToInsert.push({
              matchId: batchMatch.match.id,
              modelId: provider.id,
              predictedHomeScore: prediction.homeScore,
              predictedAwayScore: prediction.awayScore,
              rawResponse: `[batch] ${prediction.homeScore}-${prediction.awayScore}`,
              processingTimeMs: Math.round(predResult.processingTimeMs / batchMatches.length),
            });
            attemptsToClean.push({ matchId: batchMatch.match.id, modelId: provider.id });
          } else {
            const errorMsg = `${modelId}: No prediction for ${batchMatch.match.homeTeam} vs ${batchMatch.match.awayTeam}`;
            console.error(`    ${errorMsg}`);
            errors.push(errorMsg);

            // Record failed attempt
            await recordPredictionAttemptFailure(batchMatch.match.id, provider.id, errorMsg);
          }
        }

        // Batch save all predictions and clear attempts
        if (predictionsToInsert.length > 0) {
          await createPredictionsBatch(predictionsToInsert);
          await clearPredictionAttemptsBatch(attemptsToClean);
          successfulPredictions += predictionsToInsert.length;
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

  return {
    modelId,
    success: successfulPredictions > 0,
    successfulPredictions,
    gaveUpPredictions,
    errors,
    retryStats: totalRetries > 0 ? { attempts: totalRetries, successes: successfulRetries } : undefined,
  };
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

    // Create parallel processing with concurrency limit
    const limit = pLimit(MODEL_CONCURRENCY);
    const startTime = Date.now();

    // Create parallel tasks for all models
    const modelTasks = Array.from(pairsByModel.entries()).map(([modelId, matchesToPredict]) =>
      limit(async () => {
        totalPredictions += matchesToPredict.length;
        return processModelPredictions(
          modelId,
          matchesToPredict,
          matchesReadyForPrediction,
          activeProviders,
          startTime
        );
      })
    );

    // Execute all tasks with controlled concurrency
    console.log(`\nProcessing ${modelTasks.length} models with concurrency ${MODEL_CONCURRENCY}...`);
    const results = await Promise.all(modelTasks);

    // Aggregate results from all models
    for (const result of results) {
      if (result.skipped) {
        console.log(`Skipped ${result.modelId}: ${result.reason}`);
        gaveUpPredictions += result.gaveUpPredictions;
        continue;
      }

      successfulPredictions += result.successfulPredictions;
      retriedPredictions += result.successfulPredictions; // All successful predictions went through retry logic
      gaveUpPredictions += result.gaveUpPredictions;
      errors.push(...result.errors);

      if (result.retryStats) {
        retryStatsByProvider.set(result.modelId, result.retryStats);
        totalRetries += result.retryStats.attempts;
        if (result.retryStats.successes > 0) successfulRetries++;
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
