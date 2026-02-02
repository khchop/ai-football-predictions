import type { SportsOrganization } from 'schema-dts';
import { BASE_URL } from '../constants';
import { COMPETITIONS, type CompetitionConfig } from '@/lib/football/competitions';

export function buildCompetitionSchema(competition: CompetitionConfig): SportsOrganization {
  return {
    '@type': 'SportsOrganization',
    '@id': `${BASE_URL}/leagues/${competition.id}`,
    name: competition.name,
    url: `${BASE_URL}/leagues/${competition.id}`,
    sport: 'Football',
  };
}

export function getCompetitionSchemaById(competitionId: string): SportsOrganization | null {
  const competition = COMPETITIONS.find(c => c.id === competitionId);
  if (!competition) return null;
  return buildCompetitionSchema(competition);
}

export { buildCompetitionSchema as default };
