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
import { fetchWithRetry, APIError } from '@/lib/utils/api-client';
import { 
  fetchTeamStatistics, 
  extractTeamStatistics 
} from '@/lib/football/team-statistics';
import { 
  fetchH2HDetailed, 
  extractH2HStatistics 
} from '@/lib/football/h2h';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_TIMEOUT_MS = 30000;

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string | number>;
}

async function fetchFromAPI<T>({ endpoint, params }: FetchOptions): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  console.log(`[Match Analysis] Fetching: ${url.toString()}`);

  const response = await fetchWithRetry(
    url.toString(),
    {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new APIError(
      `API-Football error: ${response.status} ${response.statusText}`,
      response.status,
      endpoint
    );
  }

  const data = await response.json();
  
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('[Match Analysis] API Errors:', data.errors);
  }
  
  console.log(`[Match Analysis] Results: ${data.results || 0}`);

  return data;
}

// Parse percentage string to integer (e.g., "68%" -> 68)
function parsePercent(percentStr: string | null | undefined): number | null {
  if (!percentStr) return null;
  const match = percentStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Fetch predictions from API-Football
export async function fetchPrediction(fixtureId: number): Promise<APIFootballPredictionResponse | null> {
  try {
    const data = await fetchFromAPI<APIFootballPredictionResponse>({
      endpoint: '/predictions',
      params: { fixture: fixtureId },
    });
    return data;
  } catch (error) {
    console.error(`[Match Analysis] Error fetching prediction for fixture ${fixtureId}:`, error);
    return null;
  }
}

// Fetch injuries from API-Football
export async function fetchInjuries(fixtureId: number): Promise<APIFootballInjuryResponse | null> {
  try {
    const data = await fetchFromAPI<APIFootballInjuryResponse>({
      endpoint: '/injuries',
      params: { fixture: fixtureId },
    });
    return data;
  } catch (error) {
    console.error(`[Match Analysis] Error fetching injuries for fixture ${fixtureId}:`, error);
    return null;
  }
}

// Fetch odds from API-Football (prefer Bet365, bookmaker id: 8)
export async function fetchOdds(fixtureId: number): Promise<APIFootballOddsResponse | null> {
  try {
    const data = await fetchFromAPI<APIFootballOddsResponse>({
      endpoint: '/odds',
      params: { fixture: fixtureId },
    });
    return data;
  } catch (error) {
    console.error(`[Match Analysis] Error fetching odds for fixture ${fixtureId}:`, error);
    return null;
  }
}

// Extract match winner odds from odds response
function extractMatchWinnerOdds(oddsResponse: APIFootballOddsResponse | null): {
  oddsHome: string | null;
  oddsDraw: string | null;
  oddsAway: string | null;
  likelyScores: LikelyScore[];
} {
  const result = {
    oddsHome: null as string | null,
    oddsDraw: null as string | null,
    oddsAway: null as string | null,
    likelyScores: [] as LikelyScore[],
  };

  if (!oddsResponse?.response?.[0]?.bookmakers) {
    return result;
  }

  const bookmakers = oddsResponse.response[0].bookmakers;
  
  // Try Bet365 first (id: 8), then any available bookmaker
  const bookmaker = bookmakers.find(b => b.id === 8) || bookmakers[0];
  if (!bookmaker) return result;

  // Find Match Winner bet (usually id: 1 or name: "Match Winner")
  const matchWinnerBet = bookmaker.bets.find(
    b => b.id === 1 || b.name.toLowerCase().includes('match winner')
  );

  if (matchWinnerBet) {
    for (const value of matchWinnerBet.values) {
      if (value.value === 'Home') result.oddsHome = value.odd;
      else if (value.value === 'Draw') result.oddsDraw = value.odd;
      else if (value.value === 'Away') result.oddsAway = value.odd;
    }
  }

  // Find Exact Score bet for likely scores
  const exactScoreBet = bookmaker.bets.find(
    b => b.name.toLowerCase().includes('exact score')
  );

  if (exactScoreBet) {
    // Sort by odds (lower odds = more likely) and take top 5
    const sortedScores = exactScoreBet.values
      .filter(v => v.value && v.odd)
      .map(v => ({ score: v.value, odds: v.odd }))
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
  console.log(`[Match Analysis] Fetching analysis for match ${matchId} (fixture ${fixtureId})`);

  // Fetch basic data in parallel
  const [predictionData, injuriesData, oddsData] = await Promise.all([
    fetchPrediction(fixtureId),
    fetchInjuries(fixtureId),
    fetchOdds(fixtureId),
  ]);

  // Check if we got any useful data
  if (!predictionData?.response?.[0] && !injuriesData?.response && !oddsData?.response) {
    console.log(`[Match Analysis] No data available for fixture ${fixtureId}`);
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
    console.log(`[Match Analysis] Fetching enhanced data for teams ${homeTeamId} vs ${awayTeamId}, league ${leagueId}, season ${season}`);
    
    try {
      [teamStatsHomeData, teamStatsAwayData, h2hDetailedData] = await Promise.all([
        fetchTeamStatistics(homeTeamId, leagueId, season),
        fetchTeamStatistics(awayTeamId, leagueId, season),
        fetchH2HDetailed(homeTeamId, awayTeamId, 10),
      ]);
    } catch (error) {
      console.error(`[Match Analysis] Error fetching enhanced data:`, error);
      // Continue with basic data even if enhanced data fails
    }
  } else {
    console.log(`[Match Analysis] Missing data for enhanced fetch (home:${homeTeamId}, away:${awayTeamId}, league:${leagueId}, season:${season})`);
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

  // Extract odds
  const odds = extractMatchWinnerOdds(oddsData);

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
    
    // Odds
    oddsHome: odds.oddsHome,
    oddsDraw: odds.oddsDraw,
    oddsAway: odds.oddsAway,
    likelyScores: odds.likelyScores.length > 0 ? JSON.stringify(odds.likelyScores) : null,
    
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
    
    // Raw enhanced data for debugging
    rawTeamStatsHome: teamStatsHomeData ? JSON.stringify(teamStatsHomeData) : null,
    rawTeamStatsAway: teamStatsAwayData ? JSON.stringify(teamStatsAwayData) : null,
    rawH2HData: h2hDetailedData ? JSON.stringify(h2hDetailedData) : null,
    
    // Keep existing lineup data if present
    homeFormation: existing?.homeFormation || null,
    awayFormation: existing?.awayFormation || null,
    homeStartingXI: existing?.homeStartingXI || null,
    awayStartingXI: existing?.awayStartingXI || null,
    homeCoach: existing?.homeCoach || null,
    awayCoach: existing?.awayCoach || null,
    lineupsAvailable: existing?.lineupsAvailable || false,
    lineupsUpdatedAt: existing?.lineupsUpdatedAt || null,
    rawLineupsData: existing?.rawLineupsData || null,
    
    // Raw data for debugging
    rawPredictionsData: predictionData ? JSON.stringify(predictionData) : null,
    rawInjuriesData: injuriesData ? JSON.stringify(injuriesData) : null,
    rawOddsData: oddsData ? JSON.stringify(oddsData) : null,
    
    analysisUpdatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  await upsertMatchAnalysis(analysisData);
  
  console.log(`[Match Analysis] Stored analysis for match ${matchId}`);
  console.log(`  - Favorite: ${analysisData.favoriteTeamName} (${analysisData.homeWinPct}% vs ${analysisData.awayWinPct}%)`);
  console.log(`  - Odds: ${analysisData.oddsHome} | ${analysisData.oddsDraw} | ${analysisData.oddsAway}`);
  console.log(`  - Injuries: Home ${analysisData.homeInjuriesCount}, Away ${analysisData.awayInjuriesCount}`);
  console.log(`  - H2H (basic): ${h2h.total} matches (H:${h2h.homeWins} D:${h2h.draws} A:${h2h.awayWins})`);
  
  if (h2hDetailed) {
    console.log(`  - H2H (detailed): ${h2hDetailed.total} matches (H:${h2hDetailed.homeWins} D:${h2hDetailed.draws} A:${h2hDetailed.awayWins})`);
  }
  
  if (homeSeasonStats && awaySeasonStats) {
    console.log(`  - Season stats: Home ${homeSeasonStats.totalGoalsFor}GF/${homeSeasonStats.totalGoalsAgainst}GA, Away ${awaySeasonStats.totalGoalsFor}GF/${awaySeasonStats.totalGoalsAgainst}GA`);
  }

  return await getMatchAnalysisByMatchId(matchId);
}

// Get analysis for a match (used by prediction generation)
export async function getAnalysisForMatch(matchId: string): Promise<MatchAnalysis | null> {
  return await getMatchAnalysisByMatchId(matchId);
}
