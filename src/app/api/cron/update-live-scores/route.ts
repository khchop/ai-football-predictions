import { NextRequest, NextResponse } from 'next/server';
import { 
  updateMatchResult,
  getPredictionsForMatch,
  updatePredictionScores,
  setMatchUpset,
  getMatchAnalysisByMatchId,
} from '@/lib/db/queries';
import { getDb, matches } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { getLiveFixtures, mapFixtureStatus, formatMatchMinute } from '@/lib/football/api-football';
import { COMPETITIONS } from '@/lib/football/competitions';
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
    console.log('[Live Scores] Fetching live fixtures...');
    
    // Single API call to get all live fixtures
    const liveFixtures = await getLiveFixtures();
    
    if (liveFixtures.length === 0) {
      console.log('[Live Scores] No live fixtures found');
      return NextResponse.json({
        success: true,
        message: 'No live fixtures',
        liveCount: 0,
        updated: 0,
        finished: 0,
      });
    }

    console.log(`[Live Scores] Found ${liveFixtures.length} live fixtures globally`);

    // Filter to only our tracked competitions
    const trackedCompetitionIds = new Set(COMPETITIONS.map(c => c.apiFootballId));
    const relevantFixtures = liveFixtures.filter(f => trackedCompetitionIds.has(f.league.id));
    
    console.log(`[Live Scores] ${relevantFixtures.length} fixtures in tracked competitions`);

    if (relevantFixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No live fixtures in tracked competitions',
        liveCount: 0,
        updated: 0,
        finished: 0,
      });
    }

    // Get our matches that might be live (by external ID)
    const db = getDb();
    const externalIds = relevantFixtures.map(f => String(f.fixture.id));
    
    const ourMatches = await db
      .select()
      .from(matches)
      .where(inArray(matches.externalId, externalIds));

    // Create lookup map
    const matchByExternalId = new Map(ourMatches.map(m => [m.externalId, m]));

    let updated = 0;
    let finished = 0;
    const errors: string[] = [];

    for (const fixture of relevantFixtures) {
      const externalId = String(fixture.fixture.id);
      const ourMatch = matchByExternalId.get(externalId);
      
      if (!ourMatch) {
        // Match not in our database - skip
        continue;
      }

      try {
        const newStatus = mapFixtureStatus(fixture.fixture.status.short);
        const matchMinute = formatMatchMinute(fixture.fixture.status);
        const homeScore = fixture.goals.home ?? 0;
        const awayScore = fixture.goals.away ?? 0;

        // Check if anything changed
        const statusChanged = newStatus !== ourMatch.status;
        const scoreChanged = homeScore !== ourMatch.homeScore || awayScore !== ourMatch.awayScore;
        const minuteChanged = matchMinute !== ourMatch.matchMinute;

        if (statusChanged || scoreChanged || minuteChanged) {
          await updateMatchResult(
            ourMatch.id,
            homeScore,
            awayScore,
            newStatus,
            matchMinute
          );
          updated++;

          console.log(
            `[Live Scores] Updated ${ourMatch.homeTeam} vs ${ourMatch.awayTeam}: ` +
            `${homeScore}-${awayScore} (${matchMinute}, ${newStatus})`
          );

          // If match just finished, score predictions
          if (newStatus === 'finished' && ourMatch.status !== 'finished') {
            finished++;
            console.log(`[Live Scores] Match finished! Scoring predictions...`);
            await scorePredictionsForMatch(ourMatch.id, homeScore, awayScore);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to update match ${ourMatch.id}: ${error}`;
        console.error(`[Live Scores] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[Live Scores] Updated ${updated} matches, ${finished} finished`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} live matches, ${finished} just finished`,
      liveCount: relevantFixtures.length,
      updated,
      finished,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Live Scores] Error:', error);
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

// Score all predictions for a finished match (copied from update-results)
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
