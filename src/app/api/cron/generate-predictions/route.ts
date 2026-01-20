import { NextRequest, NextResponse } from 'next/server';
import { getMatchesReadyForPrediction, createPrediction, upsertModel } from '@/lib/db/queries';
import { getActiveProviders, ALL_PROVIDERS, OpenRouterProvider } from '@/lib/llm';
import { shouldSkipProvider, recordPredictionCost, getBudgetStatus } from '@/lib/llm/budget';
import { buildEnhancedPrompt } from '@/lib/football/prompt-builder';
import { BaseLLMProvider } from '@/lib/llm/providers/base';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow in development without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }
  
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // Ensure all providers exist in the database
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
      for (const provider of activeProviders) {
        // Check budget for OpenRouter providers
        const budgetCheck = await shouldSkipProvider(provider as OpenRouterProvider);
        if (budgetCheck.skip) {
          console.log(`Skipping ${provider.id} - ${budgetCheck.reason}`);
          skippedDueToBudget++;
          continue;
        }

        totalPredictions++;
        
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
            console.log(`Prediction saved: ${result.homeScore}-${result.awayScore}`);

            // Record cost for OpenRouter providers
            if ('estimateCost' in provider && typeof provider.estimateCost === 'function') {
              // Enhanced prompts are longer - estimate ~500 tokens for rich context
              const inputTokens = analysis ? 500 : 200;
              const cost = (provider as OpenRouterProvider).estimateCost(inputTokens, 20);
              await recordPredictionCost(provider.id, cost);
            }
          } else {
            const errorMsg = `${provider.id} failed for match ${match.id}: ${result.error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }

          // Small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
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
