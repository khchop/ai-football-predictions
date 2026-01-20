import {
  APIFootballPredictionResponse,
  APIFootballInjuryResponse,
  APIFootballOddsResponse,
  LikelyScore,
  KeyInjury,
} from '@/types';
import { upsertMatchAnalysis, getMatchAnalysisByMatchId } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';
import type { MatchAnalysis, NewMatchAnalysis } from '@/lib/db/schema';

const API_BASE_URL = 'https://v3.football.api-sports.io';

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

  console.log(`[API-Football] Fetching: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('[API-Football] API Errors:', data.errors);
  }
  
  console.log(`[API-Football] Results: ${data.results || 0}`);

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

  // Fetch all data in parallel
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

  // Extract odds
  const odds = extractMatchWinnerOdds(oddsData);

  // Extract injuries
  const injuries = extractInjuries(
    injuriesData,
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

  return await getMatchAnalysisByMatchId(matchId);
}

// Get analysis for a match (used by prediction generation)
export async function getAnalysisForMatch(matchId: string): Promise<MatchAnalysis | null> {
  return await getMatchAnalysisByMatchId(matchId);
}
