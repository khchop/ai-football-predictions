import { getDb, leagueStandings } from '@/lib/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { NewLeagueStanding, LeagueStanding } from '@/lib/db/schema';
import { COMPETITIONS } from './competitions';
import { fetchFromAPIFootball } from './api-client';
import { sleep } from '@/lib/utils/api-client';
import { loggers } from '@/lib/logger/modules';

const log = loggers.standings;

// Re-export LeagueStanding for convenience
export type { LeagueStanding };

const RATE_LIMIT_DELAY_MS = 300;

// Result type for standings update operations
interface StandingsUpdateResult {
  updated: number;
  success: boolean;
  error?: string;
}

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
  const data = await fetchFromAPIFootball<APIStandingsResponse>({
    endpoint: '/standings',
    params: { league: leagueId, season },
  });
  
  // Standings come as array of arrays (for groups in group stages)
  // Flatten them all into one array
  const allStandings: APIStandingEntry[] = [];
  for (const leagueData of data.response || []) {
    if (leagueData?.league?.standings) {
      for (const group of leagueData.league.standings) {
        allStandings.push(...group);
      }
    }
  }

  log.info({ leagueId, count: allStandings.length }, 'Found teams');
  return allStandings;
}

// Update standings for a single league
export async function updateLeagueStandings(leagueId: number, season: number): Promise<StandingsUpdateResult> {
  const db = getDb();
  
  try {
    const standings = await fetchStandingsFromAPI(leagueId, season);
    
    // Distinguish between "no standings available" and "error fetching"
    if (standings.length === 0) {
      log.warn({ leagueId, season }, 'No standings available from API');
      return { updated: 0, success: true, error: 'no_standings_available' };
    }
    
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

     log.info({ leagueId, count: updated }, 'Updated teams');
     return { updated, success: true };
   } catch (error) {
     const errorMsg = error instanceof Error ? error.message : 'Unknown error';
     log.error({ leagueId, error }, 'Error updating league');
     return { updated: 0, success: false, error: errorMsg };
   }
}

// Update standings for all tracked competitions
export async function updateAllStandings(): Promise<{ updated: number; leagues: number; errors: number }> {
  let totalUpdated = 0;
  let leaguesProcessed = 0;
  let errors = 0;

  for (const competition of COMPETITIONS) {
    // Skip competitions without a regular standings structure (e.g., World Cup qualifiers)
    // Most domestic leagues and UCL/UEL have standings
    try {
      const result = await updateLeagueStandings(competition.apiFootballId, competition.season);
      totalUpdated += result.updated;
      if (result.success && result.updated > 0) leaguesProcessed++;
      if (!result.success) errors++;
      
       // Rate limit delay between API calls
       await sleep(RATE_LIMIT_DELAY_MS);
     } catch (error) {
       log.error({ competition: competition.name, error }, 'Failed to update');
       errors++;
     }
   }

   log.info({ totalUpdated, leaguesProcessed, errors }, 'Total');
   return { updated: totalUpdated, leagues: leaguesProcessed, errors };
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

// Get all stale league IDs in a single query (optimization)
export async function getStaleLeagueIds(maxAgeHours: number = 24): Promise<number[]> {
  const db = getDb();
  const staleTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  
  // Get most recent update per league that we track
  const trackedLeagueIds = COMPETITIONS.map(c => c.apiFootballId);
  
  const results = await db
    .select({
      leagueId: leagueStandings.leagueId,
      maxUpdated: sql<string>`MAX(${leagueStandings.updatedAt})`,
    })
    .from(leagueStandings)
    .where(inArray(leagueStandings.leagueId, trackedLeagueIds))
    .groupBy(leagueStandings.leagueId);

  // Find leagues that are fresh (updated within maxAgeHours)
  const freshLeagueIds = new Set(
    results
      .filter(r => r.maxUpdated && new Date(r.maxUpdated) >= staleTime)
      .map(r => r.leagueId)
  );

  // Stale = tracked but not fresh, or not in DB at all
  return trackedLeagueIds.filter(id => !freshLeagueIds.has(id));
}

// Update standings only if stale (now uses batch staleness check)
export async function updateStandingsIfStale(maxAgeHours: number = 24): Promise<number> {
  const staleLeagueIds = await getStaleLeagueIds(maxAgeHours);
  
   if (staleLeagueIds.length === 0) {
     log.info({}, 'All leagues are fresh');
     return 0;
   }
   
   log.info({ count: staleLeagueIds.length, leagueIds: staleLeagueIds.join(', ') }, 'Leagues are stale');
  
  let updated = 0;
  for (const leagueId of staleLeagueIds) {
    const competition = COMPETITIONS.find(c => c.apiFootballId === leagueId);
    if (!competition) continue;
    
     log.info({ competition: competition.name }, 'Updating');
     const result = await updateLeagueStandings(leagueId, competition.season);
     updated += result.updated;
    
    await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
  }
  
  return updated;
}

// Get standing for a specific team by name (fuzzy match)
export async function getStandingByTeamName(
  teamName: string, 
  leagueId: number,
  season: number
): Promise<LeagueStanding | null> {
  const db = getDb();
  
  // First try exact match
  const exact = await db
    .select()
    .from(leagueStandings)
    .where(
      and(
        eq(leagueStandings.leagueId, leagueId),
        eq(leagueStandings.season, season),
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
    .where(
      and(
        eq(leagueStandings.leagueId, leagueId),
        eq(leagueStandings.season, season)
      )
    );

  // Fuzzy match: check if team name contains or is contained by search term
  const normalizedSearch = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const standing of allInLeague) {
    const normalizedTeam = standing.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact substring match
    if (normalizedTeam.includes(normalizedSearch) || normalizedSearch.includes(normalizedTeam)) {
      return standing;
    }
    
    // First word match (for cases like "Galatasaray" vs "Galatasaray SK")
    const searchWords = teamName.toLowerCase().split(/\s+/);
    const standingWords = standing.teamName.toLowerCase().split(/\s+/);
    const searchFirstWord = searchWords[0].replace(/[^a-z0-9]/g, '');
    const standingFirstWord = standingWords[0].replace(/[^a-z0-9]/g, '');
    
    // Match if first words are same and long enough (4+ chars to avoid false positives)
    if (searchFirstWord.length >= 4 && searchFirstWord === standingFirstWord) {
      return standing;
    }
  }

  return null;
}

// Get all standings for a league
export async function getStandingsForLeague(leagueId: number, season: number): Promise<LeagueStanding[]> {
  const db = getDb();
  
  return db
    .select()
    .from(leagueStandings)
    .where(
      and(
        eq(leagueStandings.leagueId, leagueId),
        eq(leagueStandings.season, season)
      )
    )
    .orderBy(leagueStandings.position);
}

// Load all standings for multiple leagues at once (optimization for batch processing)
export async function getStandingsForLeagues(leagueIds: number[], season: number): Promise<Map<string, LeagueStanding>> {
  const db = getDb();
  
  if (leagueIds.length === 0) {
    return new Map();
  }
  
  const results = await db
    .select()
    .from(leagueStandings)
    .where(
      and(
        inArray(leagueStandings.leagueId, leagueIds),
        eq(leagueStandings.season, season)
      )
    );
  
  // Create lookup map with multiple key formats for flexible lookup
  const standingsMap = new Map<string, LeagueStanding>();
  
  for (const standing of results) {
    // Store with exact team name
    standingsMap.set(`${standing.teamName}:${standing.leagueId}`, standing);
    
    // Also store with normalized name for fuzzy matching
    const normalizedName = standing.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    standingsMap.set(`${normalizedName}:${standing.leagueId}`, standing);
  }
  
  return standingsMap;
}

// Look up standing from pre-loaded map with fuzzy matching (optimization)
export function getStandingFromMap(
  teamName: string,
  leagueId: number,
  standingsMap: Map<string, LeagueStanding>
): LeagueStanding | null {
  // Try exact match first
  const exactKey = `${teamName}:${leagueId}`;
  if (standingsMap.has(exactKey)) {
    return standingsMap.get(exactKey)!;
  }
  
  // Try normalized match
  const normalizedName = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedKey = `${normalizedName}:${leagueId}`;
  if (standingsMap.has(normalizedKey)) {
    return standingsMap.get(normalizedKey)!;
  }
  
  // Fuzzy match: iterate through all standings for this league
  for (const [key, standing] of standingsMap.entries()) {
    if (!key.endsWith(`:${leagueId}`)) continue;
    
    const standingNormalized = standing.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Substring match
    if (standingNormalized.includes(normalizedName) || normalizedName.includes(standingNormalized)) {
      return standing;
    }
    
    // First word match (4+ chars)
    const searchFirstWord = teamName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    const standingFirstWord = standing.teamName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    
    if (searchFirstWord.length >= 4 && searchFirstWord === standingFirstWord) {
      return standing;
    }
  }
  
  return null;
}
