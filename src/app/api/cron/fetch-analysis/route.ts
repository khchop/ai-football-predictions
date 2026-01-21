import { NextRequest, NextResponse } from 'next/server';
import { getMatchesNeedingAnalysis, getMatchesNeedingLineups, getMatchesNeedingAnalysisRefresh } from '@/lib/db/queries';
import { fetchAndStoreAnalysis } from '@/lib/football/match-analysis';
import { updateMatchLineups } from '@/lib/football/lineups';
import { updateStandingsIfStale } from '@/lib/football/standings';
import { validateCronRequest } from '@/lib/auth/cron-auth';
import pLimit from 'p-limit';

// Concurrency limit for API calls (API-Football rate limit is 10/min on free tier, ~30/min on paid)
const API_CONCURRENCY = 3;

export async function POST(request: NextRequest) {
  const authError = validateCronRequest(request);
  if (authError) return authError;

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
      standingsUpdated: 0,
    };

    // Create concurrency limiter for API calls
    const limit = pLimit(API_CONCURRENCY);

    // 1. Fetch analysis for matches within 6 hours of kickoff (if not already fetched)
    const matchesNeedingAnalysis = await getMatchesNeedingAnalysis();
    console.log(`[Cron] Found ${matchesNeedingAnalysis.length} matches needing analysis`);
    
    results.analysisChecked = matchesNeedingAnalysis.length;
    
    const validAnalysisMatches = matchesNeedingAnalysis.filter(m => {
      if (!m.externalId) {
        console.log(`[Cron] Skipping match ${m.id} - no external ID`);
        return false;
      }
      return true;
    });

    const analysisResults = await Promise.all(
      validAnalysisMatches.map(match =>
        limit(async () => {
          try {
            const fixtureId = parseInt(match.externalId!, 10);
            await fetchAndStoreAnalysis(match.id, fixtureId);
            return { success: true, match };
          } catch (error) {
            return { success: false, match, error: `Failed to fetch analysis for ${match.homeTeam} vs ${match.awayTeam}: ${error}` };
          }
        })
      )
    );

    for (const res of analysisResults) {
      if (res.success) {
        results.analysisFetched++;
      } else if (res.error) {
        console.error(`[Cron] ${res.error}`);
        results.analysisErrors.push(res.error);
      }
    }

    // 2. Refresh analysis for matches within 2 hours of kickoff (if analysis > 4 hours old)
    const matchesNeedingRefresh = await getMatchesNeedingAnalysisRefresh();
    console.log(`[Cron] Found ${matchesNeedingRefresh.length} matches needing analysis refresh`);
    
    results.analysisRefreshChecked = matchesNeedingRefresh.length;

    const validRefreshMatches = matchesNeedingRefresh.filter(m => {
      if (!m.externalId) {
        console.log(`[Cron] Skipping refresh for match ${m.id} - no external ID`);
        return false;
      }
      return true;
    });

    const refreshResults = await Promise.all(
      validRefreshMatches.map(match =>
        limit(async () => {
          try {
            const fixtureId = parseInt(match.externalId!, 10);
            await fetchAndStoreAnalysis(match.id, fixtureId);
            console.log(`[Cron] Refreshed analysis for ${match.homeTeam} vs ${match.awayTeam}`);
            return { success: true, match };
          } catch (error) {
            return { success: false, match, error: `Failed to refresh analysis for ${match.homeTeam} vs ${match.awayTeam}: ${error}` };
          }
        })
      )
    );

    for (const res of refreshResults) {
      if (res.success) {
        results.analysisRefreshed++;
      } else if (res.error) {
        console.error(`[Cron] ${res.error}`);
        results.analysisRefreshErrors.push(res.error);
      }
    }

    // 3. Fetch lineups for matches within 1 hour of kickoff (if not already available)
    const matchesNeedingLineups = await getMatchesNeedingLineups();
    console.log(`[Cron] Found ${matchesNeedingLineups.length} matches needing lineups`);
    
    results.lineupsChecked = matchesNeedingLineups.length;

    const validLineupMatches = matchesNeedingLineups.filter(m => {
      if (!m.externalId) {
        console.log(`[Cron] Skipping match ${m.id} - no external ID`);
        return false;
      }
      return true;
    });

    const lineupResults = await Promise.all(
      validLineupMatches.map(match =>
        limit(async () => {
          try {
            const fixtureId = parseInt(match.externalId!, 10);
            const success = await updateMatchLineups(match.id, fixtureId);
            return { success, match };
          } catch (error) {
            return { success: false, match, error: `Failed to fetch lineups for ${match.homeTeam} vs ${match.awayTeam}: ${error}` };
          }
        })
      )
    );

    for (const res of lineupResults) {
      if (res.success) {
        results.lineupsFetched++;
      } else if (res.error) {
        console.error(`[Cron] ${res.error}`);
        results.lineupsErrors.push(res.error);
      }
    }

    // 4. Update league standings if stale (older than 24 hours)
    // This provides team context (position, points, form) for predictions
    try {
      results.standingsUpdated = await updateStandingsIfStale(24);
      console.log(`[Cron] Standings: ${results.standingsUpdated} teams updated`);
    } catch (error) {
      console.error('[Cron] Error updating standings:', error);
    }

    console.log(`[Cron] Analysis: ${results.analysisFetched}/${results.analysisChecked} fetched`);
    console.log(`[Cron] Analysis refresh: ${results.analysisRefreshed}/${results.analysisRefreshChecked} refreshed`);
    console.log(`[Cron] Lineups: ${results.lineupsFetched}/${results.lineupsChecked} fetched`);

    return NextResponse.json({
      success: true,
      message: `Fetched analysis for ${results.analysisFetched} matches, refreshed ${results.analysisRefreshed} matches, lineups for ${results.lineupsFetched} matches, standings for ${results.standingsUpdated} teams`,
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
