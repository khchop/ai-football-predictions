import { getDb, leagueStandings } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import type { NewLeagueStanding, LeagueStanding } from '@/lib/db/schema';
import { COMPETITIONS } from './competitions';

const API_BASE_URL = 'https://v3.football.api-sports.io';

interface APIStandingTeam {
  id: number;
  name: string;
  logo: string;
}

interface APIStandingStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
}

interface APIStandingEntry {
  rank: number;
  team: APIStandingTeam;
  points: number;
  goalsDiff: number;
  form: string | null;
  all: APIStandingStats;
  home: APIStandingStats;
  away: APIStandingStats;
}

interface APIStandingsResponse {
  response: Array<{
    league: {
      id: number;
      name: string;
      season: number;
      standings: APIStandingEntry[][];
    };
  }>;
}

// Fetch standings from API-Football
async function fetchStandingsFromAPI(leagueId: number, season: number): Promise<APIStandingEntry[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const url = new URL(`${API_BASE_URL}/standings`);
  url.searchParams.append('league', String(leagueId));
  url.searchParams.append('season', String(season));

  console.log(`[Standings] Fetching: ${url.toString()}`);

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

  const data: APIStandingsResponse = await response.json();
  
  // Standings come as array of arrays (for groups in group stages)
  // Flatten them all into one array
  const allStandings: APIStandingEntry[] = [];
  for (const leagueData of data.response || []) {
    for (const group of leagueData.league.standings || []) {
      allStandings.push(...group);
    }
  }

  console.log(`[Standings] Found ${allStandings.length} teams for league ${leagueId}`);
  return allStandings;
}

// Update standings for a single league
export async function updateLeagueStandings(leagueId: number, season: number): Promise<number> {
  const db = getDb();
  
  try {
    const standings = await fetchStandingsFromAPI(leagueId, season);
    
    let updated = 0;
    for (const entry of standings) {
      const standingData: NewLeagueStanding = {
        id: `${leagueId}-${season}-${entry.team.id}`,
        leagueId,
        season,
        teamId: entry.team.id,
        teamName: entry.team.name,
        position: entry.rank,
        points: entry.points,
        played: entry.all.played,
        won: entry.all.win,
        drawn: entry.all.draw,
        lost: entry.all.lose,
        goalsFor: entry.all.goals.for,
        goalsAgainst: entry.all.goals.against,
        goalDiff: entry.goalsDiff,
        form: entry.form,
        homeWon: entry.home.win,
        homeDrawn: entry.home.draw,
        homeLost: entry.home.lose,
        homeGoalsFor: entry.home.goals.for,
        homeGoalsAgainst: entry.home.goals.against,
        awayWon: entry.away.win,
        awayDrawn: entry.away.draw,
        awayLost: entry.away.lose,
        awayGoalsFor: entry.away.goals.for,
        awayGoalsAgainst: entry.away.goals.against,
        updatedAt: new Date().toISOString(),
      };

      await db
        .insert(leagueStandings)
        .values(standingData)
        .onConflictDoUpdate({
          target: leagueStandings.id,
          set: {
            position: standingData.position,
            points: standingData.points,
            played: standingData.played,
            won: standingData.won,
            drawn: standingData.drawn,
            lost: standingData.lost,
            goalsFor: standingData.goalsFor,
            goalsAgainst: standingData.goalsAgainst,
            goalDiff: standingData.goalDiff,
            form: standingData.form,
            homeWon: standingData.homeWon,
            homeDrawn: standingData.homeDrawn,
            homeLost: standingData.homeLost,
            homeGoalsFor: standingData.homeGoalsFor,
            homeGoalsAgainst: standingData.homeGoalsAgainst,
            awayWon: standingData.awayWon,
            awayDrawn: standingData.awayDrawn,
            awayLost: standingData.awayLost,
            awayGoalsFor: standingData.awayGoalsFor,
            awayGoalsAgainst: standingData.awayGoalsAgainst,
            updatedAt: standingData.updatedAt,
          },
        });
      
      updated++;
    }

    console.log(`[Standings] Updated ${updated} teams for league ${leagueId}`);
    return updated;
  } catch (error) {
    console.error(`[Standings] Error updating league ${leagueId}:`, error);
    return 0;
  }
}

// Update standings for all tracked competitions
export async function updateAllStandings(): Promise<{ updated: number; leagues: number }> {
  let totalUpdated = 0;
  let leaguesProcessed = 0;

  for (const competition of COMPETITIONS) {
    // Skip competitions without a regular standings structure (e.g., World Cup qualifiers)
    // Most domestic leagues and UCL/UEL have standings
    try {
      const updated = await updateLeagueStandings(competition.apiFootballId, competition.season);
      totalUpdated += updated;
      if (updated > 0) leaguesProcessed++;
      
      // Rate limit: 300ms between API calls
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[Standings] Failed to update ${competition.name}:`, error);
    }
  }

  console.log(`[Standings] Total: ${totalUpdated} teams across ${leaguesProcessed} leagues`);
  return { updated: totalUpdated, leagues: leaguesProcessed };
}

// Check if standings are stale (older than specified hours)
export async function areStandingsStale(leagueId: number, maxAgeHours: number = 24): Promise<boolean> {
  const db = getDb();
  
  const result = await db
    .select({ updatedAt: leagueStandings.updatedAt })
    .from(leagueStandings)
    .where(eq(leagueStandings.leagueId, leagueId))
    .limit(1);

  if (result.length === 0) {
    return true; // No standings at all, definitely stale
  }

  const lastUpdate = result[0].updatedAt;
  if (!lastUpdate) return true;

  const staleTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return new Date(lastUpdate) < staleTime;
}

// Update standings only if stale
export async function updateStandingsIfStale(maxAgeHours: number = 24): Promise<number> {
  let updated = 0;

  for (const competition of COMPETITIONS) {
    const isStale = await areStandingsStale(competition.apiFootballId, maxAgeHours);
    
    if (isStale) {
      console.log(`[Standings] ${competition.name} is stale, updating...`);
      const count = await updateLeagueStandings(competition.apiFootballId, competition.season);
      updated += count;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return updated;
}

// Get standing for a specific team by name (fuzzy match)
export async function getStandingByTeamName(
  teamName: string, 
  leagueId: number
): Promise<LeagueStanding | null> {
  const db = getDb();
  
  // First try exact match
  const exact = await db
    .select()
    .from(leagueStandings)
    .where(
      and(
        eq(leagueStandings.leagueId, leagueId),
        eq(leagueStandings.teamName, teamName)
      )
    )
    .limit(1);

  if (exact.length > 0) {
    return exact[0];
  }

  // If no exact match, try to find similar (for cases like "Man United" vs "Manchester United")
  const allInLeague = await db
    .select()
    .from(leagueStandings)
    .where(eq(leagueStandings.leagueId, leagueId));

  // Simple fuzzy match: check if team name contains or is contained by search term
  const normalizedSearch = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const standing of allInLeague) {
    const normalizedTeam = standing.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedTeam.includes(normalizedSearch) || normalizedSearch.includes(normalizedTeam)) {
      return standing;
    }
  }

  return null;
}

// Get all standings for a league
export async function getStandingsForLeague(leagueId: number): Promise<LeagueStanding[]> {
  const db = getDb();
  
  return db
    .select()
    .from(leagueStandings)
    .where(eq(leagueStandings.leagueId, leagueId))
    .orderBy(leagueStandings.position);
}
