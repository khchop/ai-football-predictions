import type { SportsTeam } from 'schema-dts';
import { BASE_URL } from '../constants';
import { COMPETITIONS } from '@/lib/football/competitions';
import type { TeamConfig } from '@/lib/football/teams';

/**
 * Build SportsTeam schema with stats and memberOf relationship
 */
export function buildSportsTeamSchema(
  team: TeamConfig,
  stats: { wins: number; draws: number; losses: number; goalsScored: number; totalMatches: number }
): SportsTeam {
  // Look up competition for memberOf
  const competition = COMPETITIONS.find(c => c.id === team.league);

  return {
    '@type': 'SportsTeam',
    '@id': `${BASE_URL}/teams/${team.slug}`,
    name: team.id,
    url: `${BASE_URL}/teams/${team.slug}`,
    sport: 'Football',
    description: `${team.id} statistics: ${stats.wins}W-${stats.draws}D-${stats.losses}L with ${stats.goalsScored} goals scored across ${stats.totalMatches} matches.`,
    memberOf: competition
      ? {
          '@type': 'SportsOrganization',
          name: competition.name,
          url: `${BASE_URL}/leagues/${competition.id}`,
        }
      : undefined,
  };
}
