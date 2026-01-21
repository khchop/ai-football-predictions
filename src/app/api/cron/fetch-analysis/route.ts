import { NextRequest, NextResponse } from 'next/server';
import { getMatchesNeedingAnalysis, getMatchesNeedingLineups, getMatchesNeedingAnalysisRefresh } from '@/lib/db/queries';
import { fetchAndStoreAnalysis } from '@/lib/football/match-analysis';
import { updateMatchLineups } from '@/lib/football/lineups';

// Helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  // Note: Auth disabled for Coolify compatibility - these endpoints are internal only

  try {
    console.log('[Cron] Fetching analysis and lineups...');
    
    const results = {
      analysisChecked: 0,
      analysisFetched: 0,
      analysisErrors: [] as string[],
      analysisRefreshChecked: 0,
      analysisRefreshed: 0,
      analysisRefreshErrors: [] as string[],
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

    // 2. Refresh analysis for matches within 2 hours of kickoff (if analysis > 4 hours old)
    // This ensures we have fresh odds/injuries data before generating predictions
    const matchesNeedingRefresh = await getMatchesNeedingAnalysisRefresh();
    console.log(`[Cron] Found ${matchesNeedingRefresh.length} matches needing analysis refresh`);
    
    results.analysisRefreshChecked = matchesNeedingRefresh.length;

    for (const match of matchesNeedingRefresh) {
      if (!match.externalId) {
        console.log(`[Cron] Skipping refresh for match ${match.id} - no external ID`);
        continue;
      }

      try {
        const fixtureId = parseInt(match.externalId, 10);
        await fetchAndStoreAnalysis(match.id, fixtureId);
        results.analysisRefreshed++;
        console.log(`[Cron] Refreshed analysis for ${match.homeTeam} vs ${match.awayTeam}`);
        
        // Rate limit: 300ms between API calls
        await sleep(300);
      } catch (error) {
        const errorMsg = `Failed to refresh analysis for ${match.homeTeam} vs ${match.awayTeam}: ${error}`;
        console.error(`[Cron] ${errorMsg}`);
        results.analysisRefreshErrors.push(errorMsg);
      }
    }

    // 3. Fetch lineups for matches within 1 hour of kickoff (if not already available)
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
    console.log(`[Cron] Analysis refresh: ${results.analysisRefreshed}/${results.analysisRefreshChecked} refreshed`);
    console.log(`[Cron] Lineups: ${results.lineupsFetched}/${results.lineupsChecked} fetched`);

    return NextResponse.json({
      success: true,
      message: `Fetched analysis for ${results.analysisFetched} matches, refreshed ${results.analysisRefreshed} matches, lineups for ${results.lineupsFetched} matches`,
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
