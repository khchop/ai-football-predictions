import { NextRequest, NextResponse } from 'next/server';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { calculatePoints } from '@/lib/utils/scoring';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = checkRateLimit(`match:${rateLimitKey}`, RATE_LIMIT_PRESETS.standard);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const { id } = await params;
    
    // Validate ID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid match ID format' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }
    
    const result = await getMatchWithAnalysis(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { match, competition, predictions, analysis } = result;

    // Calculate points for each prediction if match is finished
    const predictionsWithPoints = predictions.map(({ prediction, model }) => {
      let points = null;
      let isExact = false;
      let isCorrectResult = false;

      if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null) {
        const scoring = calculatePoints(
          prediction.predictedHomeScore,
          prediction.predictedAwayScore,
          match.homeScore,
          match.awayScore
        );
        points = scoring.points;
        isExact = scoring.isExact;
        isCorrectResult = scoring.isCorrectResult;
      }

      return {
        id: prediction.id,
        modelId: model.id,
        modelDisplayName: model.displayName,
        provider: model.provider,
        predictedHomeScore: prediction.predictedHomeScore,
        predictedAwayScore: prediction.predictedAwayScore,
        confidence: prediction.confidence,
        points,
        isExact,
        isCorrectResult,
        createdAt: prediction.createdAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        match: {
          id: match.id,
          externalId: match.externalId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamLogo: match.homeTeamLogo,
          awayTeamLogo: match.awayTeamLogo,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          kickoffTime: match.kickoffTime,
          status: match.status,
          round: match.round,
          venue: match.venue,
          isUpset: match.isUpset,
          competition: {
            id: competition.id,
            name: competition.name,
          },
        },
        analysis: analysis ? {
          favoriteTeamId: analysis.favoriteTeamId,
          homeWinPct: analysis.homeWinPct,
          drawPct: analysis.drawPct,
          awayWinPct: analysis.awayWinPct,
          advice: analysis.advice,
          formHomePct: analysis.formHomePct,
          formAwayPct: analysis.formAwayPct,
          attackHomePct: analysis.attackHomePct,
          attackAwayPct: analysis.attackAwayPct,
          defenseHomePct: analysis.defenseHomePct,
          defenseAwayPct: analysis.defenseAwayPct,
          homeTeamForm: analysis.homeTeamForm,
          awayTeamForm: analysis.awayTeamForm,
          homeGoalsScored: analysis.homeGoalsScored,
          homeGoalsConceded: analysis.homeGoalsConceded,
          awayGoalsScored: analysis.awayGoalsScored,
          awayGoalsConceded: analysis.awayGoalsConceded,
          oddsHome: analysis.oddsHome,
          oddsDraw: analysis.oddsDraw,
          oddsAway: analysis.oddsAway,
          likelyScores: analysis.likelyScores,
          homeInjuriesCount: analysis.homeInjuriesCount,
          awayInjuriesCount: analysis.awayInjuriesCount,
          keyInjuries: analysis.keyInjuries,
          homeFormation: analysis.homeFormation,
          awayFormation: analysis.awayFormation,
          homeStartingXI: analysis.homeStartingXI,
          awayStartingXI: analysis.awayStartingXI,
          homeCoach: analysis.homeCoach,
          awayCoach: analysis.awayCoach,
        } : null,
        predictions: predictionsWithPoints,
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    console.error('Error fetching match:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An internal error occurred'
      },
      { status: 500 }
    );
  }
}
