import {
   APIFootballPredictionResponse,
   APIFootballInjuryResponse,
   APIFootballOddsResponse,
   LikelyScore,
   KeyInjury,
   H2HMatch,
 } from '@/types';
  import { upsertMatchAnalysis, getMatchAnalysisByMatchId } from '@/lib/db/queries';
  import { v4 as uuidv4 } from 'uuid';
  import type { MatchAnalysis, NewMatchAnalysis } from '@/lib/db/schema';
  import { APIError } from '@/lib/utils/api-client';
  import { 
    fetchTeamStatistics, 
    extractTeamStatistics 
  } from '@/lib/football/team-statistics';
  import { 
    fetchH2HDetailed, 
    extractH2HStatistics 
  } from '@/lib/football/h2h';
  import {
    fetchPrediction as fetchPredictionFromAPI,
    fetchInjuries as fetchInjuriesFromAPI,
    fetchOdds as fetchOddsFromAPI,
  } from '@/lib/football/api-client';
  import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache/redis';
  import pLimit from 'p-limit';
  import { loggers } from '@/lib/logger/modules';

const log = loggers.matchAnalysis;

// Parse percentage string to integer (e.g., "68%" -> 68)
function parsePercent(percentStr: string | null | undefined): number | null {
  if (!percentStr) return null;
  const match = percentStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Re-export central API client functions with consistent error handling
// These now throw errors instead of silently returning null
export async function fetchPrediction(fixtureId: number): Promise<APIFootballPredictionResponse | null> {
  return fetchPredictionFromAPI(fixtureId);
}

export async function fetchInjuries(fixtureId: number): Promise<APIFootballInjuryResponse | null> {
  return fetchInjuriesFromAPI(fixtureId);
}

export async function fetchOdds(fixtureId: number): Promise<APIFootballOddsResponse | null> {
  return fetchOddsFromAPI(fixtureId);
}

// Validate and format odds value
// Reasonable range for football betting: 1.01 to 100.00
function validateOdds(value: any): string | null {
  if (!value) return null;
  
  const odds = typeof value === 'string' ? parseFloat(value) : value;
  
  // Check if valid number
  if (isNaN(odds)) return null;
  
  // Check reasonable range (1.01 = minimum for winning bet, 100 = extreme limit)
  if (odds < 1.01 || odds > 100) {
    return null;
  }
  
  // Round to 2 decimal places and convert back to string
  return (Math.round(odds * 100) / 100).toString();
}

// Extract all betting odds from odds response
function extractAllOdds(oddsResponse: APIFootballOddsResponse | null): {
  // Match Winner (1X2)
  oddsHome: string | null;
  oddsDraw: string | null;
  oddsAway: string | null;
  // Double Chance
  odds1X: string | null;
  oddsX2: string | null;
  odds12: string | null;
  // Over/Under
  oddsOver05: string | null;
  oddsUnder05: string | null;
  oddsOver15: string | null;
  oddsUnder15: string | null;
  oddsOver25: string | null;
  oddsUnder25: string | null;
  oddsOver35: string | null;
  oddsUnder35: string | null;
  oddsOver45: string | null;
  oddsUnder45: string | null;
  // BTTS
  oddsBttsYes: string | null;
  oddsBttsNo: string | null;
  // Other
  likelyScores: LikelyScore[];
} {
  const result = {
    oddsHome: null as string | null,
    oddsDraw: null as string | null,
    oddsAway: null as string | null,
    odds1X: null as string | null,
    oddsX2: null as string | null,
    odds12: null as string | null,
    oddsOver05: null as string | null,
    oddsUnder05: null as string | null,
    oddsOver15: null as string | null,
    oddsUnder15: null as string | null,
    oddsOver25: null as string | null,
    oddsUnder25: null as string | null,
    oddsOver35: null as string | null,
    oddsUnder35: null as string | null,
    oddsOver45: null as string | null,
    oddsUnder45: null as string | null,
    oddsBttsYes: null as string | null,
    oddsBttsNo: null as string | null,
    likelyScores: [] as LikelyScore[],
  };

  if (!oddsResponse?.response?.[0]?.bookmakers) {
    return result;
  }

  const bookmakers = oddsResponse.response[0].bookmakers;
  
  // Try Bet365 first (id: 8), then any available bookmaker
  const bookmaker = bookmakers.find(b => b.id === 8) || bookmakers[0];
  if (!bookmaker) return result;

  // 1. Match Winner (Bet ID: 1)
  const matchWinnerBet = bookmaker.bets.find(
    b => b.id === 1 || b.name.toLowerCase().includes('match winner')
  );

   if (matchWinnerBet) {
     for (const value of matchWinnerBet.values) {
       const validatedOdd = validateOdds(value.odd);
       if (validatedOdd) {
         if (value.value === 'Home') result.oddsHome = validatedOdd;
         else if (value.value === 'Draw') result.oddsDraw = validatedOdd;
         else if (value.value === 'Away') result.oddsAway = validatedOdd;
       }
     }
   }

  // 2. Double Chance (Bet ID: 12)
  const doubleChanceBet = bookmaker.bets.find(
    b => b.id === 12 || b.name.toLowerCase().includes('double chance')
  );

   if (doubleChanceBet) {
     for (const value of doubleChanceBet.values) {
       const validatedOdd = validateOdds(value.odd);
       if (validatedOdd) {
         const val = value.value;
         if (val === 'Home/Draw' || val === '1X') result.odds1X = validatedOdd;
         else if (val === 'Draw/Away' || val === 'X2') result.oddsX2 = validatedOdd;
         else if (val === 'Home/Away' || val === '12') result.odds12 = validatedOdd;
       }
     }
   }

  // 3. Goals Over/Under (Bet ID: 5)
  const overUnderBet = bookmaker.bets.find(
    b => b.id === 5 || b.name.toLowerCase().includes('goals over/under')
  );

   if (overUnderBet) {
     for (const value of overUnderBet.values) {
       const validatedOdd = validateOdds(value.odd);
       if (validatedOdd) {
         const val = value.value;
         if (val === 'Over 0.5') result.oddsOver05 = validatedOdd;
         else if (val === 'Under 0.5') result.oddsUnder05 = validatedOdd;
         else if (val === 'Over 1.5') result.oddsOver15 = validatedOdd;
         else if (val === 'Under 1.5') result.oddsUnder15 = validatedOdd;
         else if (val === 'Over 2.5') result.oddsOver25 = validatedOdd;
         else if (val === 'Under 2.5') result.oddsUnder25 = validatedOdd;
         else if (val === 'Over 3.5') result.oddsOver35 = validatedOdd;
         else if (val === 'Under 3.5') result.oddsUnder35 = validatedOdd;
         else if (val === 'Over 4.5') result.oddsOver45 = validatedOdd;
         else if (val === 'Under 4.5') result.oddsUnder45 = validatedOdd;
       }
     }
   }

  // 4. Both Teams Score (Bet ID: 8)
  const bttsBet = bookmaker.bets.find(
    b => b.id === 8 || b.name.toLowerCase().includes('both teams score')
  );

   if (bttsBet) {
     for (const value of bttsBet.values) {
       const validatedOdd = validateOdds(value.odd);
       if (validatedOdd) {
         if (value.value === 'Yes') result.oddsBttsYes = validatedOdd;
         else if (value.value === 'No') result.oddsBttsNo = validatedOdd;
       }
     }
   }

  // 5. Exact Score (for display only, not betting)
  const exactScoreBet = bookmaker.bets.find(
    b => b.name.toLowerCase().includes('exact score')
  );

   if (exactScoreBet) {
     const sortedScores = exactScoreBet.values
       .filter(v => v.value && v.odd)
       .map(v => {
         const validatedOdd = validateOdds(v.odd);
         return validatedOdd ? { score: v.value, odds: validatedOdd } : null;
       })
       .filter((v): v is NonNullable<typeof v> => v !== null)
       .sort((a, b) => parseFloat(a.odds) - parseFloat(b.odds))
       .slice(0, 5);
     
     result.likelyScores = sortedScores;
   }

  return result;
}

// Extract head-to-head stats from prediction response
// Now using richer H2H data with dates and team names
interface H2HStats {
  total: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  matches: H2HMatch[];  // Richer match data for display
}

// Type for the H2H data from API-Football prediction response
interface APIFootballH2HMatch {
  fixture: { 
    id: number;
    date: string;
    venue?: { name: string; city: string } | null;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
  };
}

function extractH2HStats(
  h2hData: APIFootballH2HMatch[] | undefined,
  _homeTeamId: number,
  _awayTeamId: number
): H2HStats {
  const result: H2HStats = {
    total: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    matches: [],
  };

  if (!h2hData || h2hData.length === 0) {
    return result;
  }

  result.total = h2hData.length;

  // Take last 5 results for display
  const recentMatches = h2hData.slice(0, 5);
  
  for (const match of h2hData) {
    const homeGoals = match.goals.home ?? 0;
    const awayGoals = match.goals.away ?? 0;

    if (homeGoals > awayGoals) {
      result.homeWins++;
    } else if (awayGoals > homeGoals) {
      result.awayWins++;
    } else {
      result.draws++;
    }
  }

  // Store last 5 results with full match details
  result.matches = recentMatches.map(m => ({
    date: m.fixture?.date || null,
    homeTeam: m.teams?.home?.name || 'Unknown',
    awayTeam: m.teams?.away?.name || 'Unknown',
    homeScore: m.goals.home ?? 0,
    awayScore: m.goals.away ?? 0,
  }));

  return result;
}

// Extract injury info from injuries response
function extractInjuries(
  injuriesResponse: APIFootballInjuryResponse | null,
  homeTeamId: number,
  awayTeamId: number
): {
  homeInjuriesCount: number;
  awayInjuriesCount: number;
  keyInjuries: KeyInjury[];
} {
  const result = {
    homeInjuriesCount: 0,
    awayInjuriesCount: 0,
    keyInjuries: [] as KeyInjury[],
  };

  if (!injuriesResponse?.response) {
    return result;
  }

  for (const injury of injuriesResponse.response) {
    const keyInjury: KeyInjury = {
      playerName: injury.player.name,
      teamName: injury.team.name,
      reason: injury.player.reason || 'Unknown',
      type: injury.player.type || 'Unknown',
    };
    
    result.keyInjuries.push(keyInjury);

    if (injury.team.id === homeTeamId) {
      result.homeInjuriesCount++;
    } else if (injury.team.id === awayTeamId) {
      result.awayInjuriesCount++;
    }
  }

  return result;
}

// Fetch and store all analysis data for a match
export async function fetchAndStoreAnalysis(
  matchId: string,
  fixtureId: number
): Promise<MatchAnalysis | null> {
   log.info({ matchId, fixtureId }, 'Fetching analysis');

  // Fetch basic data in parallel
  const [predictionData, injuriesData, oddsData] = await Promise.all([
    fetchPrediction(fixtureId),
    fetchInjuries(fixtureId),
    fetchOdds(fixtureId),
  ]);

   // Check if we got any useful data
   if (!predictionData?.response?.[0] && !injuriesData?.response && !oddsData?.response) {
     log.info({ fixtureId }, 'No data available');
     return null;
   }

  const prediction = predictionData?.response?.[0];
  const teams = prediction?.teams;
  const comparison = prediction?.comparison;
  const predictions = prediction?.predictions;

  // Extract team IDs, league ID, and season for enhanced data
  const homeTeamId = teams?.home?.id;
  const awayTeamId = teams?.away?.id;
  const leagueId = prediction?.league?.id;
  
  // Determine current season (European seasons: mid-year to mid-year)
  // January-June = previous year's season, July-December = current year's season
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const season = currentMonth < 6 ? currentYear - 1 : currentYear;

  // Fetch enhanced data in parallel (team statistics and detailed H2H)
  let teamStatsHomeData = null;
  let teamStatsAwayData = null;
  let h2hDetailedData = null;

   if (homeTeamId && awayTeamId && leagueId && season) {
     log.info({ homeTeamId, awayTeamId, leagueId, season }, 'Fetching enhanced data');
     
     try {
       [teamStatsHomeData, teamStatsAwayData, h2hDetailedData] = await Promise.all([
         fetchTeamStatisticsCached(homeTeamId, leagueId, season),
         fetchTeamStatisticsCached(awayTeamId, leagueId, season),
         fetchH2HDetailedCached(homeTeamId, awayTeamId, 10),
       ]);
     } catch (error) {
       log.error({ error }, 'Error fetching enhanced data');
       // Continue with basic data even if enhanced data fails
     }
   } else {
     log.info({ homeTeamId, awayTeamId, leagueId, season }, 'Missing data for enhanced fetch');
   }

  // Extract enhanced statistics
  const homeSeasonStats = homeTeamId && teamStatsHomeData 
    ? extractTeamStatistics(teamStatsHomeData) 
    : null;
  const awaySeasonStats = awayTeamId && teamStatsAwayData 
    ? extractTeamStatistics(teamStatsAwayData) 
    : null;
  const h2hDetailed = homeTeamId && awayTeamId && h2hDetailedData 
    ? extractH2HStatistics(h2hDetailedData, homeTeamId, awayTeamId) 
    : null;

  // Extract all odds (1X2, DC, O/U, BTTS)
  const odds = extractAllOdds(oddsData);

  // Extract injuries
  const injuries = extractInjuries(
    injuriesData,
    teams?.home?.id || 0,
    teams?.away?.id || 0
  );

  // Extract H2H stats from prediction data
  const h2h = extractH2HStats(
    prediction?.h2h,
    teams?.home?.id || 0,
    teams?.away?.id || 0
  );

  // Check if analysis already exists
  const existing = await getMatchAnalysisByMatchId(matchId);

  const analysisData: NewMatchAnalysis = {
    id: existing?.id || uuidv4(),
    matchId,
    
    // Winner prediction
    favoriteTeamId: predictions?.winner?.id || null,
    favoriteTeamName: predictions?.winner?.name || null,
    homeWinPct: parsePercent(predictions?.percent?.home),
    drawPct: parsePercent(predictions?.percent?.draw),
    awayWinPct: parsePercent(predictions?.percent?.away),
    advice: predictions?.advice || null,
    
    // Team comparison
    formHomePct: parsePercent(comparison?.form?.home),
    formAwayPct: parsePercent(comparison?.form?.away),
    attackHomePct: parsePercent(comparison?.att?.home),
    attackAwayPct: parsePercent(comparison?.att?.away),
    defenseHomePct: parsePercent(comparison?.def?.home),
    defenseAwayPct: parsePercent(comparison?.def?.away),
    
    // Team form
    homeTeamForm: teams?.home?.last_5?.form || null,
    awayTeamForm: teams?.away?.last_5?.form || null,
    homeGoalsScored: teams?.home?.last_5?.goals?.for?.total || null,
    homeGoalsConceded: teams?.home?.last_5?.goals?.against?.total || null,
    awayGoalsScored: teams?.away?.last_5?.goals?.for?.total || null,
    awayGoalsConceded: teams?.away?.last_5?.goals?.against?.total || null,
    
    // Odds - Match Winner (1X2)
    oddsHome: odds.oddsHome,
    oddsDraw: odds.oddsDraw,
    oddsAway: odds.oddsAway,
    likelyScores: odds.likelyScores.length > 0 ? JSON.stringify(odds.likelyScores) : null,
    
    // Odds - Double Chance
    odds1X: odds.odds1X,
    oddsX2: odds.oddsX2,
    odds12: odds.odds12,
    
    // Odds - Over/Under
    oddsOver05: odds.oddsOver05,
    oddsUnder05: odds.oddsUnder05,
    oddsOver15: odds.oddsOver15,
    oddsUnder15: odds.oddsUnder15,
    oddsOver25: odds.oddsOver25,
    oddsUnder25: odds.oddsUnder25,
    oddsOver35: odds.oddsOver35,
    oddsUnder35: odds.oddsUnder35,
    oddsOver45: odds.oddsOver45,
    oddsUnder45: odds.oddsUnder45,
    
    // Odds - BTTS
    oddsBttsYes: odds.oddsBttsYes,
    oddsBttsNo: odds.oddsBttsNo,
    
    // Injuries
    homeInjuriesCount: injuries.homeInjuriesCount,
    awayInjuriesCount: injuries.awayInjuriesCount,
    keyInjuries: injuries.keyInjuries.length > 0 ? JSON.stringify(injuries.keyInjuries) : null,
    
    // Head-to-head history (basic from predictions)
    h2hTotal: h2h.total > 0 ? h2h.total : null,
    h2hHomeWins: h2h.total > 0 ? h2h.homeWins : null,
    h2hDraws: h2h.total > 0 ? h2h.draws : null,
    h2hAwayWins: h2h.total > 0 ? h2h.awayWins : null,
    h2hResults: h2h.matches.length > 0 ? JSON.stringify(h2h.matches) : null,
    
    // Enhanced data: Team season statistics
    homeSeasonStats: homeSeasonStats ? JSON.stringify(homeSeasonStats) : null,
    awaySeasonStats: awaySeasonStats ? JSON.stringify(awaySeasonStats) : null,
    
    // Enhanced data: Detailed H2H with 10 matches
    h2hDetailed: h2hDetailed ? JSON.stringify(h2hDetailed) : null,
    
    // Archive raw data: Don't store raw API responses to reduce DB bloat (~50-100KB per match)
    // Processed results (injuries, h2h, stats) are already stored above
    rawTeamStatsHome: null,
    rawTeamStatsAway: null,
    rawH2HData: null,

    // Archive raw data: Don't store raw API responses to reduce DB bloat
    // Only processed results are stored (predictions, injuries, odds)
    rawPredictionsData: null,
    rawInjuriesData: null,
    rawOddsData: null,
    
    analysisUpdatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

   await upsertMatchAnalysis(analysisData);
   
   log.info({ matchId }, 'Stored analysis');
   log.info({ 
     favorite: analysisData.favoriteTeamName, 
     homeWinPct: analysisData.homeWinPct, 
     awayWinPct: analysisData.awayWinPct 
   }, 'Favorite');
   log.info({ 
     oddsHome: analysisData.oddsHome, 
     oddsDraw: analysisData.oddsDraw, 
     oddsAway: analysisData.oddsAway 
   }, 'Odds');
   log.info({ 
     homeInjuriesCount: analysisData.homeInjuriesCount, 
     awayInjuriesCount: analysisData.awayInjuriesCount 
   }, 'Injuries');
   log.info({ 
     total: h2h.total, 
     homeWins: h2h.homeWins, 
     draws: h2h.draws, 
     awayWins: h2h.awayWins 
   }, 'H2H (basic)');
   
   if (h2hDetailed) {
     log.info({ 
       total: h2hDetailed.total, 
       homeWins: h2hDetailed.homeWins, 
       draws: h2hDetailed.draws, 
       awayWins: h2hDetailed.awayWins 
     }, 'H2H (detailed)');
   }
   
   if (homeSeasonStats && awaySeasonStats) {
     log.info({ 
       homeGoalsFor: homeSeasonStats.totalGoalsFor, 
       homeGoalsAgainst: homeSeasonStats.totalGoalsAgainst, 
       awayGoalsFor: awaySeasonStats.totalGoalsFor, 
       awayGoalsAgainst: awaySeasonStats.totalGoalsAgainst 
     }, 'Season stats');
   }

  return await getMatchAnalysisByMatchId(matchId);
}

// Get analysis for a match (used by prediction generation)
export async function getAnalysisForMatch(matchId: string): Promise<MatchAnalysis | null> {
  return await getMatchAnalysisByMatchId(matchId);
}

// Refresh ONLY odds for a match (used before betting to get latest odds)
export async function refreshOddsForMatch(
  matchId: string,
  fixtureId: number
): Promise<boolean> {
   log.info({ matchId, fixtureId }, 'Refreshing odds');

  try {
    // Fetch latest odds only
    const oddsData = await fetchOdds(fixtureId);
    
     if (!oddsData?.response?.[0]?.bookmakers) {
       log.info({ fixtureId }, 'No odds available');
       return false;
     }

    // Extract all odds
    const odds = extractAllOdds(oddsData);

     // Get existing analysis
     const existing = await getMatchAnalysisByMatchId(matchId);
     if (!existing) {
       log.info({ matchId }, 'No existing analysis');
       return false;
     }

    // Update only odds fields
    const updatedAnalysis: NewMatchAnalysis = {
      ...existing,
      // Update all odds
      oddsHome: odds.oddsHome,
      oddsDraw: odds.oddsDraw,
      oddsAway: odds.oddsAway,
      odds1X: odds.odds1X,
      oddsX2: odds.oddsX2,
      odds12: odds.odds12,
      oddsOver05: odds.oddsOver05,
      oddsUnder05: odds.oddsUnder05,
      oddsOver15: odds.oddsOver15,
      oddsUnder15: odds.oddsUnder15,
      oddsOver25: odds.oddsOver25,
      oddsUnder25: odds.oddsUnder25,
      oddsOver35: odds.oddsOver35,
      oddsUnder35: odds.oddsUnder35,
      oddsOver45: odds.oddsOver45,
      oddsUnder45: odds.oddsUnder45,
       oddsBttsYes: odds.oddsBttsYes,
       oddsBttsNo: odds.oddsBttsNo,
       likelyScores: odds.likelyScores.length > 0 ? JSON.stringify(odds.likelyScores) : existing.likelyScores,
       rawOddsData: null, // Archive raw data to reduce DB bloat
       analysisUpdatedAt: new Date().toISOString(),
    };

     await upsertMatchAnalysis(updatedAnalysis);
     log.info({ matchId }, 'Refreshed odds');
     return true;
   } catch (error) {
     // Re-throw rate limit errors so BullMQ can retry with backoff
     if (error instanceof Error && error.name === 'RateLimitError') {
       log.error({ matchId }, 'Rate limit hit, will retry');
       throw error;
     }
     log.error({ matchId, error }, 'Error refreshing odds');
     return false;
   }
}

// ===== CACHED VERSIONS FOR OPTIMIZATION =====

// Cached version of fetchTeamStatistics (6-hour cache)
export async function fetchTeamStatisticsCached(
  teamId: number,
  leagueId: number,
  season: number
) {
  const cacheKey = cacheKeys.teamStats(teamId, leagueId, season.toString());
  
  return withCache(cacheKey, CACHE_TTL.TEAM_STATS, async () => {
    return fetchTeamStatistics(teamId, leagueId, season);
  });
}

// Cached version of fetchH2HDetailed (7-day cache, H2H is static)
export async function fetchH2HDetailedCached(
  team1Id: number,
  team2Id: number,
  last: number = 10
) {
  // Use consistent key ordering (lower ID first)
  const cacheKey = cacheKeys.h2h(team1Id, team2Id);
  
  return withCache(cacheKey, CACHE_TTL.H2H, async () => {
    return fetchH2HDetailed(team1Id, team2Id, last);
  });
}

// Cached version of fetchOdds (10-minute cache for betting)
export async function fetchOddsCached(fixtureId: number): Promise<APIFootballOddsResponse | null> {
  const cacheKey = cacheKeys.oddsBatch(fixtureId);
  
  return withCache(cacheKey, CACHE_TTL.ODDS_BATCH, async () => {
    return fetchOdds(fixtureId);
  });
}

// Batch refresh odds for multiple fixtures (optimization for generate-predictions)
export async function refreshOddsBatch(
  matchFixturePairs: { matchId: string; fixtureId: number }[]
): Promise<Map<string, boolean>> {
  if (matchFixturePairs.length === 0) {
    return new Map();
  }
  
   log.info({ count: matchFixturePairs.length }, 'Refreshing odds batch');
   const results = new Map<string, boolean>();
  
  // Process in parallel with rate limiting (max 5 concurrent)
  const limit = pLimit(5);
  
  const tasks = matchFixturePairs.map(({ matchId, fixtureId }) =>
    limit(async () => {
      try {
        const oddsData = await fetchOddsCached(fixtureId);
        
        if (!oddsData?.response?.[0]?.bookmakers) {
          results.set(matchId, false);
          return;
        }
        
        const odds = extractAllOdds(oddsData);
        const existing = await getMatchAnalysisByMatchId(matchId);
        
        if (!existing) {
          results.set(matchId, false);
          return;
        }
        
         // Update only odds fields
         await upsertMatchAnalysis({
           ...existing,
           ...odds,
           likelyScores: odds.likelyScores.length > 0 ? JSON.stringify(odds.likelyScores) : existing.likelyScores,
           rawOddsData: null, // Archive raw data to reduce DB bloat
           analysisUpdatedAt: new Date().toISOString(),
         });
        
        results.set(matchId, true);
       } catch (error) {
         log.error({ matchId, error }, 'Error processing batch');
         results.set(matchId, false);
       }
    })
  );
  
  await Promise.all(tasks);
  
   const successCount = [...results.values()].filter(v => v).length;
   log.info({ successCount, total: matchFixturePairs.length }, 'Batch complete');
  
  return results;
}
