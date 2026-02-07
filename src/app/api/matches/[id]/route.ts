import { NextRequest, NextResponse } from 'next/server';
import { getMatchWithAnalysis, getPredictionsForMatchWithDetails } from '@/lib/db/queries';
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/utils/rate-limiter';
import { validateParams } from '@/lib/validation/middleware';
import { getMatchParamsSchema } from '@/lib/validation/schemas';
import { sanitizeError } from '@/lib/utils/error-sanitizer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (60 req/min)
  const rateLimitKey = getRateLimitKey(request);
  const rateLimitResult = await checkRateLimit(`match:${rateLimitKey}`, RATE_LIMIT_PRESETS.api);
  
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt * 1000 - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: {
          ...createRateLimitHeaders(rateLimitResult),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  try {
    const resolvedParams = await params;
    
    // Validate route parameters
    const { data: validatedParams, error: validationError } = validateParams(getMatchParamsSchema, resolvedParams);
    if (validationError) {
      return validationError;
    }
    
    const { id } = validatedParams;
    
    const result = await getMatchWithAnalysis(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { match, competition, analysis } = result;

    // Fetch predictions for this match
    const predictions = await getPredictionsForMatchWithDetails(id);

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
          // Main odds (1X2)
          oddsHome: analysis.oddsHome,
          oddsDraw: analysis.oddsDraw,
          oddsAway: analysis.oddsAway,
          // Double chance odds
          odds1X: analysis.odds1X,
          oddsX2: analysis.oddsX2,
          odds12: analysis.odds12,
          // Over/Under odds
          oddsOver05: analysis.oddsOver05,
          oddsUnder05: analysis.oddsUnder05,
          oddsOver15: analysis.oddsOver15,
          oddsUnder15: analysis.oddsUnder15,
          oddsOver25: analysis.oddsOver25,
          oddsUnder25: analysis.oddsUnder25,
          oddsOver35: analysis.oddsOver35,
          oddsUnder35: analysis.oddsUnder35,
          oddsOver45: analysis.oddsOver45,
          oddsUnder45: analysis.oddsUnder45,
          // BTTS odds
          oddsBttsYes: analysis.oddsBttsYes,
          oddsBttsNo: analysis.oddsBttsNo,
          likelyScores: analysis.likelyScores,
          homeInjuriesCount: analysis.homeInjuriesCount,
          awayInjuriesCount: analysis.awayInjuriesCount,
          keyInjuries: analysis.keyInjuries,
        } : null,
        predictions: predictions.map(pred => ({
          id: pred.predictionId,
          modelId: pred.modelId,
          modelDisplayName: pred.modelDisplayName,
          provider: pred.provider,
          predictedHome: pred.predictedHome,
          predictedAway: pred.predictedAway,
          predictedResult: pred.predictedResult,
          tendencyPoints: pred.tendencyPoints,
          goalDiffBonus: pred.goalDiffBonus,
          exactScoreBonus: pred.exactScoreBonus,
          totalPoints: pred.totalPoints,
          status: pred.status,
          createdAt: pred.createdAt,
          scoredAt: pred.scoredAt,
        })),
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: sanitizeError(error, 'match')
      },
      { status: 500, headers: createRateLimitHeaders(rateLimitResult) }
    );
  }
}
