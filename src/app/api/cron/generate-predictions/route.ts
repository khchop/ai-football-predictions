import { NextRequest, NextResponse } from 'next/server';
import { getMatchesReadyForPrediction, createPrediction, upsertModel, deactivateOldModels } from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildEnhancedPrompt } from '@/lib/football/prompt-builder';
import { BaseLLMProvider } from '@/lib/llm/providers/base';

export async function POST(request: NextRequest) {
  // Note: Auth disabled for Coolify compatibility - these endpoints are internal only

  try {
    console.log('Generating predictions...');
    
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

    let totalPredictions = 0;
    let successfulPredictions = 0;
    let skippedDueToBudget = 0;
    const errors: string[] = [];

    for (const { match, competition, analysis } of matchesReadyForPrediction) {
      // Build enhanced prompt with all available context
      const enhancedPrompt = buildEnhancedPrompt({
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: competition.name,
        kickoffTime: match.kickoffTime,
        analysis,
      });

      console.log(`Match: ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`  Analysis: ${analysis ? 'Yes' : 'No'}, Lineups: ${analysis?.lineupsAvailable ? 'Yes' : 'No'}`);

      // Generate predictions from all providers
      // Process sequentially (mutex pattern) to prevent budget race conditions
      for (const provider of activeProviders) {
        // Check budget BEFORE API call (budget check is now atomic per-provider)
        const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
        if (budgetCheck.skip) {
          console.log(`Skipping ${provider.id} - ${budgetCheck.reason}`);
          skippedDueToBudget++;
          continue;
        }

        totalPredictions++;
        
        // Track cost immediately after API call, not after save
        let apiCost = 0;
        
        try {
          console.log(`Generating prediction: ${provider.id} for ${match.homeTeam} vs ${match.awayTeam}`);
          
          // Use enhanced prompt via predictWithPrompt method
          let result;
          if ('predictWithPrompt' in provider && typeof provider.predictWithPrompt === 'function') {
            result = await (provider as BaseLLMProvider).predictWithPrompt(enhancedPrompt);
          } else {
            // Fallback to standard predict for providers that don't support enhanced prompts
            result = await provider.predict(
              match.homeTeam,
              match.awayTeam,
              competition.name,
              match.kickoffTime
            );
          }

          // Record cost IMMEDIATELY after API call (regardless of parse/save success)
          // This ensures budget tracking is accurate even if response parsing fails
          if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
            const inputTokens = analysis ? 500 : 200;
            apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, 50);
            await recordPredictionCost(provider.id, apiCost);
          }

          if (result.success) {
            await createPrediction({
              matchId: match.id,
              modelId: provider.id,
              predictedHomeScore: result.homeScore,
              predictedAwayScore: result.awayScore,
              confidence: result.confidence,
              rawResponse: result.rawResponse,
              processingTimeMs: result.processingTimeMs,
            });
            successfulPredictions++;
            console.log(`Prediction saved: ${result.homeScore}-${result.awayScore} (cost: $${apiCost.toFixed(6)})`);
          } else {
            const errorMsg = `${provider.id} failed for match ${match.id}: ${result.error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }

          // Small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          // Record cost even on error (API was still called and billed)
          if (apiCost === 0 && 'estimateCost' in provider && typeof provider.estimateCost === 'function') {
            const inputTokens = analysis ? 500 : 200;
            apiCost = (provider as OpenRouterProvider).estimateCost(inputTokens, 50);
            await recordPredictionCost(provider.id, apiCost);
          }
          const errorMsg = `Error with ${provider.id} for match ${match.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    // Get final budget status
    const budgetEnd = await getBudgetStatus();

    console.log(`Generated ${successfulPredictions}/${totalPredictions} predictions`);
    console.log(`Budget used: $${(budgetEnd.spent - budgetStart.spent).toFixed(4)}`);
    if (skippedDueToBudget > 0) {
      console.log(`Skipped ${skippedDueToBudget} predictions due to budget`);
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${successfulPredictions} of ${totalPredictions} predictions`,
      matches: matchesReadyForPrediction.length,
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
