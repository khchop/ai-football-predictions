import { APIFootballH2HResponse } from '@/types';
import { fetchFromAPIFootball } from './api-client';
import { loggers } from '@/lib/logger/modules';

const log = loggers.h2h;

// Fetch detailed H2H data for two teams
export async function fetchH2HDetailed(
  team1Id: number,
  team2Id: number,
  count: number = 10
): Promise<APIFootballH2HResponse | null> {
  try {
    const data = await fetchFromAPIFootball<APIFootballH2HResponse>({
      endpoint: '/fixtures/headtohead',
      params: { 
        h2h: `${team1Id}-${team2Id}`,
        last: count
      },
    });
    return data;
  } catch (error) {
    log.error({ team1Id, team2Id, error }, 'Error fetching H2H');
    return null;
  }
}

// Detailed H2H match info
export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  halftimeHome: number | null;
  halftimeAway: number | null;
}

// Extract H2H statistics
export interface H2HStatistics {
  total: number;
  homeWins: number; // Wins when first team is at home
  draws: number;
  awayWins: number; // Wins when first team is away
  matches: H2HMatch[];
}

export function extractH2HStatistics(
  h2hResponse: APIFootballH2HResponse | null,
  homeTeamId: number,
  awayTeamId: number
): H2HStatistics {
  const result: H2HStatistics = {
    total: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    matches: [],
  };

  if (!h2hResponse?.response || h2hResponse.response.length === 0) {
    return result;
  }

  result.total = h2hResponse.response.length;

  for (const match of h2hResponse.response) {
    const matchHomeScore = match.goals.home ?? 0;
    const matchAwayScore = match.goals.away ?? 0;
    const matchHomeTeamId = match.teams.home.id;

    // Determine if current home team was home in this H2H match
    const currentHomeWasHome = matchHomeTeamId === homeTeamId;

    // Count wins from perspective of current home team
    if (matchHomeScore > matchAwayScore) {
      if (currentHomeWasHome) {
        result.homeWins++;
      } else {
        result.awayWins++;
      }
    } else if (matchAwayScore > matchHomeScore) {
      if (currentHomeWasHome) {
        result.awayWins++;
      } else {
        result.homeWins++;
      }
    } else {
      result.draws++;
    }

    // Store match details (take first 10)
    if (result.matches.length < 10) {
      result.matches.push({
        date: match.fixture.date,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        homeScore: matchHomeScore,
        awayScore: matchAwayScore,
        halftimeHome: match.score.halftime.home,
        halftimeAway: match.score.halftime.away,
      });
    }
  }

  return result;
}
