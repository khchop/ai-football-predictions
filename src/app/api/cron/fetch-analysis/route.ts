import { NextRequest, NextResponse } from 'next/server';
import { getMatchesNeedingAnalysis, getMatchesNeedingLineups } from '@/lib/db/queries';
import { fetchAndStoreAnalysis } from '@/lib/football/match-analysis';
import { updateMatchLineups } from '@/lib/football/lineups';

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

// Helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Fetching analysis and lineups...');
    
    const results = {
      analysisChecked: 0,
      analysisFetched: 0,
      analysisErrors: [] as string[],
      lineupsChecked: 0,
      lineupsFetched: 0,
      lineupsErrors: [] as string[],
    };

    // 1. Fetch analysis for matches within 6 hours of kickoff (if not already fetched)
    const matchesNeedingAnalysis = await getMatchesNeedingAnalysis();
    console.log(`[Cron] Found ${matchesNeedingAnalysis.length} matches needing analysis`);
    
    results.analysisChecked = matchesNeedingAnalysis.length;

    for (const match of matchesNeedingAnalysis) {
      if (!match.externalId) {
        console.log(`[Cron] Skipping match ${match.id} - no external ID`);
        continue;
      }

      try {
        const fixtureId = parseInt(match.externalId, 10);
        await fetchAndStoreAnalysis(match.id, fixtureId);
        results.analysisFetched++;
        
        // Rate limit: 300ms between API calls
        await sleep(300);
      } catch (error) {
        const errorMsg = `Failed to fetch analysis for ${match.homeTeam} vs ${match.awayTeam}: ${error}`;
        console.error(`[Cron] ${errorMsg}`);
        results.analysisErrors.push(errorMsg);
      }
    }

    // 2. Fetch lineups for matches within 1 hour of kickoff (if not already available)
    const matchesNeedingLineups = await getMatchesNeedingLineups();
    console.log(`[Cron] Found ${matchesNeedingLineups.length} matches needing lineups`);
    
    results.lineupsChecked = matchesNeedingLineups.length;

    for (const match of matchesNeedingLineups) {
      if (!match.externalId) {
        console.log(`[Cron] Skipping match ${match.id} - no external ID`);
        continue;
      }

      try {
        const fixtureId = parseInt(match.externalId, 10);
        const success = await updateMatchLineups(match.id, fixtureId);
        
        if (success) {
          results.lineupsFetched++;
        }
        
        // Rate limit: 300ms between API calls
        await sleep(300);
      } catch (error) {
        const errorMsg = `Failed to fetch lineups for ${match.homeTeam} vs ${match.awayTeam}: ${error}`;
        console.error(`[Cron] ${errorMsg}`);
        results.lineupsErrors.push(errorMsg);
      }
    }

    console.log(`[Cron] Analysis: ${results.analysisFetched}/${results.analysisChecked} fetched`);
    console.log(`[Cron] Lineups: ${results.lineupsFetched}/${results.lineupsChecked} fetched`);

    return NextResponse.json({
      success: true,
      message: `Fetched analysis for ${results.analysisFetched} matches, lineups for ${results.lineupsFetched} matches`,
      results,
    });
  } catch (error) {
    console.error('[Cron] Error in fetch-analysis:', error);
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
