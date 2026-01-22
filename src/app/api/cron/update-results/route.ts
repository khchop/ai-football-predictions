import { NextRequest, NextResponse } from 'next/server';
import { 
  getMatchesPendingResults, 
  getFinishedMatchesWithUnscoredPredictions, 
  updateMatchResult,
  getPendingBetsByMatch,
  settleBet,
  updateModelBalanceAfterBets,
  getCurrentSeason,
} from '@/lib/db/queries';
import { getFinishedFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import { scorePredictionsForMatch } from '@/lib/scoring/score-match';
import { 
  evaluateResultBet, 
  evaluateOverUnderBet, 
  evaluateBttsBet,
  calculatePayout,
  calculateProfit,
} from '@/lib/betting/bet-settlement';

/**
 * Settle all pending bets for a finished match
 */
async function settleBetsForMatch(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ settled: number; won: number; lost: number }> {
  const seasonName = await getCurrentSeason();
  const pendingBets = await getPendingBetsByMatch(matchId);

  if (pendingBets.length === 0) {
    return { settled: 0, won: 0, lost: 0 };
  }

  console.log(`  Settling ${pendingBets.length} pending bets...`);

  let settledCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  // Group bets by model to batch balance updates
  const balanceUpdates = new Map<string, { totalPayout: number; betsCount: number; winsCount: number }>();

  for (const bet of pendingBets) {
    let won = false;

    // Evaluate bet based on type
    switch (bet.betType) {
      case 'result':
        won = evaluateResultBet(bet.selection, homeScore, awayScore);
        break;
      case 'over_under':
        won = evaluateOverUnderBet(bet.selection, homeScore, awayScore);
        break;
      case 'btts':
        won = evaluateBttsBet(bet.selection, homeScore, awayScore);
        break;
      default:
        console.error(`Unknown bet type: ${bet.betType}`);
        continue;
    }

    const payout = calculatePayout(bet.stake || 1.0, bet.odds, won);
    const profit = calculateProfit(bet.stake || 1.0, payout);
    const status = won ? 'won' : 'lost';

    // Settle the bet
    await settleBet(bet.id, status, payout, profit);
    settledCount++;

    if (won) {
      wonCount++;
    } else {
      lostCount++;
    }

    // Accumulate balance updates per model
    if (!balanceUpdates.has(bet.modelId)) {
      balanceUpdates.set(bet.modelId, { totalPayout: 0, betsCount: 0, winsCount: 0 });
    }
    const update = balanceUpdates.get(bet.modelId)!;
    update.totalPayout += payout;
    update.betsCount++;
    if (won) update.winsCount++;
  }

  // Apply balance updates in batch per model
  for (const [modelId, update] of balanceUpdates) {
    await updateModelBalanceAfterBets(
      modelId,
      seasonName,
      update.totalPayout, // Add winnings to balance
      0, // Don't increment bet count (already done when placing bets)
      update.winsCount
    );
  }

  console.log(`  Settled: ${wonCount} won, ${lostCount} lost`);

  return { settled: settledCount, won: wonCount, lost: lostCount };
}

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

  try {
    console.log('Updating match results...');
    
    // Get matches that might have finished (kickoff was more than 2 hours ago)
    const pendingMatches = await getMatchesPendingResults();
    
    if (pendingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches pending result updates',
        updated: 0,
      });
    }

    console.log(`Found ${pendingMatches.length} matches pending results`);

    // Get external IDs to fetch
    const externalIds = pendingMatches
      .filter(m => m.externalId)
      .map(m => parseInt(m.externalId!, 10));

    if (externalIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches with external IDs to update',
        updated: 0,
      });
    }

    // Fetch results from API-Football
    const fixtures = await getFinishedFixtures(externalIds);
    
    let updated = 0;
    const errors: string[] = [];

    // Create a map for quick lookup
    const fixtureMap = new Map(
      fixtures.map(f => [String(f.fixture.id), f])
    );

    for (const match of pendingMatches) {
      if (!match.externalId) continue;

      const fixture = fixtureMap.get(match.externalId);
      if (!fixture) {
        console.log(`No fixture data found for ${match.externalId}`);
        continue;
      }

      const newStatus = mapFixtureStatus(fixture.fixture.status.short);
      
      // Only update if we have final scores or status changed
      if (
        fixture.goals.home !== null && 
        fixture.goals.away !== null &&
        (newStatus === 'finished' || newStatus !== match.status)
      ) {
        try {
          await updateMatchResult(
            match.id,
            fixture.goals.home,
            fixture.goals.away,
            newStatus
          );
          updated++;
          console.log(
            `Updated ${match.homeTeam} vs ${match.awayTeam}: ` +
            `${fixture.goals.home}-${fixture.goals.away} (${newStatus})`
          );

          // If match is finished, settle bets and calculate scores for predictions
          if (newStatus === 'finished') {
            // Settle all pending bets for this match
            await settleBetsForMatch(
              match.id,
              fixture.goals.home,
              fixture.goals.away
            );

            // Legacy: Calculate scores for old prediction system
            await scorePredictionsForMatch(
              match.id,
              fixture.goals.home,
              fixture.goals.away
            );
          }
        } catch (error) {
          const errorMsg = `Failed to update match ${match.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`Updated ${updated} matches`);

    // ============================================================================
    // Check for finished matches with unscored predictions and rescore them
    // This catches matches that finished but scoring was missed/failed
    // ============================================================================
    const unscoredMatches = await getFinishedMatchesWithUnscoredPredictions();

    let rescored = 0;
    if (unscoredMatches.length > 0) {
      console.log(`[Results] Found ${unscoredMatches.length} finished matches with unscored predictions`);
      
      for (const match of unscoredMatches) {
        if (match.homeScore !== null && match.awayScore !== null) {
          try {
            console.log(`[Results] Rescoring: ${match.homeTeam} vs ${match.awayTeam} (${match.homeScore}-${match.awayScore})`);
            
            // Settle any pending bets for this match
            await settleBetsForMatch(match.id, match.homeScore, match.awayScore);
            
            // Legacy: Rescore predictions
            await scorePredictionsForMatch(match.id, match.homeScore, match.awayScore);
            rescored++;
          } catch (error) {
            const errorMsg = `Failed to rescore match ${match.id}: ${error}`;
            console.error(`[Results] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }
      
      console.log(`[Results] Rescored ${rescored} matches`);
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} of ${pendingMatches.length} pending matches, rescored ${rescored} unscored matches`,
      pending: pendingMatches.length,
      fetched: fixtures.length,
      updated,
      rescored,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error updating results:', error);
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
