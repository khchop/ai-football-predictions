import { NextRequest, NextResponse } from 'next/server';
import { getMatchesReadyForPrediction, createPrediction, upsertModel, deactivateOldModels } from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildBatchPrompt, BatchMatchContext } from '@/lib/football/prompt-builder';
import { BaseLLMProvider } from '@/lib/llm/providers/base';

// Batch size for grouping matches (10 matches per API call)
const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  // Note: Auth disabled for Coolify compatibility - these endpoints are internal only

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

    // Process each batch with each provider
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const matchIds = batch.map(m => m.matchId);
      
      console.log(`\nProcessing batch ${batchIndex + 1}/${batches.length} (${batch.length} matches)`);
      console.log(`  Matches: ${batch.map(m => `${m.homeTeam} vs ${m.awayTeam}`).join(', ')}`);

      // Build batch prompt once per batch
      const batchPrompt = buildBatchPrompt(batch);

      // Process providers sequentially to prevent budget race conditions
      for (const provider of activeProviders) {
        // Check budget BEFORE API call
        const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
        if (budgetCheck.skip) {
          console.log(`  Skipping ${provider.id} - ${budgetCheck.reason}`);
          skippedDueToBudget += batch.length; // Count all matches in batch as skipped
          continue;
        }

        totalPredictions += batch.length;
        
        // Estimate cost for batch (more input tokens, proportionally more output)
        let apiCost = 0;
        const hasAnalysis = batch.some(m => m.analysis);
        
        try {
          console.log(`  ${provider.id}: Generating batch prediction...`);
          
          // Use batch prediction method
          const baseProvider = provider as BaseLLMProvider;
          const result = await baseProvider.predictBatch(batchPrompt, matchIds);

          // Record cost IMMEDIATELY after API call
          if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
            // Batch cost estimation: ~200 tokens per match input, ~50 per match output
            const inputTokens = hasAnalysis ? 400 * batch.length : 200 * batch.length;
            const outputTokens = 50 * batch.length;
            apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
            await recordPredictionCost(provider.id, apiCost);
          }

          if (result.success && result.predictions.size > 0) {
            // Save individual predictions from batch result
            for (const batchItem of batch) {
              const prediction = result.predictions.get(batchItem.matchId);
              
              if (prediction) {
                await createPrediction({
                  matchId: batchItem.matchDbId,
                  modelId: provider.id,
                  predictedHomeScore: prediction.homeScore,
                  predictedAwayScore: prediction.awayScore,
                  rawResponse: `[batch] ${prediction.homeScore}-${prediction.awayScore}`,
                  processingTimeMs: Math.round(result.processingTimeMs / batch.length),
                });
                successfulPredictions++;
              } else {
                // Match not found in response - log error
                const errorMsg = `${provider.id}: No prediction for ${batchItem.homeTeam} vs ${batchItem.awayTeam}`;
                console.error(`    ${errorMsg}`);
                errors.push(errorMsg);
              }
            }
            
            console.log(`    Saved ${result.predictions.size}/${batch.length} predictions (cost: $${apiCost.toFixed(6)})`);
            
            if (result.failedMatchIds && result.failedMatchIds.length > 0) {
              console.log(`    Missing: ${result.failedMatchIds.length} matches`);
            }
          } else {
            const errorMsg = `${provider.id} batch failed: ${result.error}`;
            console.error(`    ${errorMsg}`);
            errors.push(errorMsg);
          }

          // Small delay between provider calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          // Record cost even on error (API was still called and billed)
          if (apiCost === 0 && 'estimateCost' in provider && typeof provider.estimateCost === 'function') {
            const inputTokens = hasAnalysis ? 400 * batch.length : 200 * batch.length;
            const outputTokens = 50 * batch.length;
            apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, outputTokens);
            await recordPredictionCost(provider.id, apiCost);
          }
          const errorMsg = `Error with ${provider.id} for batch ${batchIndex + 1}: ${error}`;
          console.error(`    ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    // Get final budget status
    const budgetEnd = await getBudgetStatus();

    console.log(`\nGenerated ${successfulPredictions}/${totalPredictions} predictions`);
    console.log(`Budget used: $${(budgetEnd.spent - budgetStart.spent).toFixed(4)}`);
    if (skippedDueToBudget > 0) {
      console.log(`Skipped ${skippedDueToBudget} predictions due to budget`);
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
