import { NextRequest, NextResponse } from 'next/server';
import { getFinishedMatchesWithUnscoredPredictions, getMatchById } from '@/lib/db/queries';
import { scorePredictionsForMatch } from '@/lib/scoring/score-match';

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.ADMIN_PASSWORD) {
    // SECURITY: Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin Auth] CRITICAL: ADMIN_PASSWORD not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Allow in development without password
    console.warn('[Admin Auth] ADMIN_PASSWORD not configured - allowing in development mode');
    return null;
  }
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}

// POST: Rescore matches
// Body: { matchId?: string } - if provided, rescore specific match; otherwise rescore all unscored
export async function POST(request: NextRequest) {
  const authError = validateAdminRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const { matchId } = body;

    if (matchId) {
      // Rescore specific match
      console.log(`[Admin Rescore] Rescoring specific match: ${matchId}`);
      
      const matchData = await getMatchById(matchId);
      if (!matchData) {
        return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
      }
      
      const { match } = matchData;
      if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) {
        return NextResponse.json({ 
          success: false, 
          error: 'Match is not finished or has no score' 
        }, { status: 400 });
      }

      await scorePredictionsForMatch(match.id, match.homeScore, match.awayScore);
      
      console.log(`[Admin Rescore] Successfully rescored: ${match.homeTeam} vs ${match.awayTeam}`);
      
      return NextResponse.json({
        success: true,
        message: `Rescored match: ${match.homeTeam} vs ${match.awayTeam}`,
        rescored: 1,
      });
    } else {
      // Rescore all unscored matches
      console.log('[Admin Rescore] Rescoring all unscored matches');
      
      const unscoredMatches = await getFinishedMatchesWithUnscoredPredictions();
      
      if (unscoredMatches.length === 0) {
        console.log('[Admin Rescore] No unscored matches found');
        return NextResponse.json({
          success: true,
          message: 'No unscored matches found',
          rescored: 0,
          total: 0,
        });
      }

      console.log(`[Admin Rescore] Found ${unscoredMatches.length} unscored matches`);
      
      let rescored = 0;
      const errors: string[] = [];

      for (const match of unscoredMatches) {
        if (match.homeScore !== null && match.awayScore !== null) {
          try {
            console.log(`[Admin Rescore] Rescoring: ${match.homeTeam} vs ${match.awayTeam} (${match.homeScore}-${match.awayScore})`);
            await scorePredictionsForMatch(match.id, match.homeScore, match.awayScore);
            rescored++;
          } catch (error) {
            const errorMsg = `${match.homeTeam} vs ${match.awayTeam}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[Admin Rescore] Error: ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }

      console.log(`[Admin Rescore] Successfully rescored ${rescored} of ${unscoredMatches.length} matches`);

      return NextResponse.json({
        success: true,
        message: `Rescored ${rescored} of ${unscoredMatches.length} matches`,
        rescored,
        total: unscoredMatches.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }
  } catch (error) {
    console.error('[Admin Rescore] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
