import { NextRequest, NextResponse } from 'next/server';
import { 
  getMatchesPendingResults, 
  updateMatchResult, 
  getPredictionsForMatch,
  updatePredictionScores,
  setMatchUpset,
  getMatchAnalysisByMatchId,
} from '@/lib/db/queries';
import { getFinishedFixtures, mapFixtureStatus } from '@/lib/football/api-football';
import { calculateEnhancedScores } from '@/lib/utils/scoring';
import { isUpsetResult } from '@/lib/utils/upset';

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

          // If match is finished, calculate scores for all predictions
          if (newStatus === 'finished') {
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

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} of ${pendingMatches.length} pending matches`,
      pending: pendingMatches.length,
      fetched: fixtures.length,
      updated,
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

// Score all predictions for a finished match
async function scorePredictionsForMatch(
  matchId: string,
  actualHome: number,
  actualAway: number
) {
  console.log(`[Scoring] Calculating scores for match ${matchId}`);
  
  try {
    // Get analysis data for upset detection (may not exist)
    const analysis = await getMatchAnalysisByMatchId(matchId);
    
    // Only use win percentages if analysis exists and has valid data
    const homeWinPct = (analysis?.homeWinPct != null && analysis.homeWinPct > 0) ? analysis.homeWinPct : null;
    const awayWinPct = (analysis?.awayWinPct != null && analysis.awayWinPct > 0) ? analysis.awayWinPct : null;

    // Determine if this was an upset (only if we have analysis data)
    let wasUpset = false;
    if (homeWinPct !== null && awayWinPct !== null) {
      wasUpset = isUpsetResult(homeWinPct, awayWinPct, actualHome, actualAway);
      if (wasUpset) {
        console.log(`[Scoring] Match was an UPSET! (home: ${homeWinPct}%, away: ${awayWinPct}%)`);
      }
    } else {
      console.log(`[Scoring] No win percentages available for upset detection`);
    }
    
    await setMatchUpset(matchId, wasUpset);

    // Get all predictions for this match
    const matchPredictions = await getPredictionsForMatch(matchId);
    console.log(`[Scoring] Found ${matchPredictions.length} predictions to score`);

    if (matchPredictions.length === 0) {
      console.log(`[Scoring] No predictions to score for match ${matchId}`);
      return;
    }

    let scoredCount = 0;
    let totalPoints = 0;

    for (const { prediction } of matchPredictions) {
      // Calculate enhanced scores (6 categories)
      const scores = calculateEnhancedScores({
        predictedHome: prediction.predictedHomeScore,
        predictedAway: prediction.predictedAwayScore,
        actualHome,
        actualAway,
        homeWinPct,
        awayWinPct,
      });

      // Update prediction with scores
      await updatePredictionScores(prediction.id, scores);
      
      scoredCount++;
      totalPoints += scores.total;
      
      // Log notable scores
      if (scores.exactScore > 0) {
        console.log(`[Scoring] EXACT SCORE: ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} = ${scores.total} pts`);
      } else if (scores.upsetBonus > 0) {
        console.log(`[Scoring] UPSET CALLED: ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} = ${scores.total} pts`);
      }
    }

    console.log(`[Scoring] Scored ${scoredCount} predictions, total ${totalPoints} points`);
  } catch (error) {
    console.error(`[Scoring] Error scoring match ${matchId}:`, error);
  }
}
