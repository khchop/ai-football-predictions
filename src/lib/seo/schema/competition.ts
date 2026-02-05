import type { SportsOrganization } from 'schema-dts';
import { BASE_URL } from '../constants';
import { COMPETITIONS, type CompetitionConfig } from '@/lib/football/competitions';

// Default model count fallback (kept in sync with actual count via dynamic queries)
const DEFAULT_MODEL_COUNT = 35;

/**
 * Enhanced competition data including optional stats
 */
export interface EnhancedCompetitionData {
  competition: CompetitionConfig;
  stats?: {
    totalMatches: number;
    finishedMatches: number;
    avgGoalsPerMatch: number;
  };
  activeModels?: number;
}

/**
 * Map competition IDs to their countries/regions for areaServed
 */
function getCountryFromCompetitionId(id: string): string {
  const countryMap: Record<string, string> = {
    // Club - European
    'ucl': 'Europe',
    'uel': 'Europe',
    'uecl': 'Europe',
    // Club - Domestic
    'epl': 'England',
    'laliga': 'Spain',
    'bundesliga': 'Germany',
    'seriea': 'Italy',
    'ligue1': 'France',
    'eredivisie': 'Netherlands',
    'superlig': 'Turkey',
    // International
    'world-cup': 'World',
    'euro': 'Europe',
    'nations-league': 'Europe',
    'copa-america': 'South America',
    'afcon': 'Africa',
    'wc-qual-europe': 'Europe',
    'wc-qual-southamerica': 'South America',
  };
  return countryMap[id] || 'Europe';
}

/**
 * Basic competition schema (backward compatible)
 */
export function buildCompetitionSchema(competition: CompetitionConfig): SportsOrganization {
  return {
    '@type': 'SportsOrganization',
    '@id': `${BASE_URL}/leagues/${competition.id}`,
    name: competition.name,
    url: `${BASE_URL}/leagues/${competition.id}`,
    sport: 'Football',
  };
}

/**
 * Enhanced competition schema with areaServed and dynamic description
 */
export function buildEnhancedCompetitionSchema(data: EnhancedCompetitionData): SportsOrganization {
  const { competition, stats, activeModels } = data;
  const modelCount = activeModels ?? DEFAULT_MODEL_COUNT;

  // Build dynamic description based on stats availability
  const description = stats && stats.finishedMatches > 0
    ? `${competition.name} football competition with ${stats.finishedMatches} matches tracked and AI predictions from ${modelCount} models.`
    : `${competition.name} football competition with AI predictions from ${modelCount} models. Track model accuracy and compare predictions.`;

  return {
    '@type': 'SportsOrganization',
    '@id': `${BASE_URL}/leagues/${competition.id}`,
    name: competition.name,
    url: `${BASE_URL}/leagues/${competition.id}`,
    sport: 'Football',
    areaServed: getCountryFromCompetitionId(competition.id),
    description,
  };
}

export function getCompetitionSchemaById(competitionId: string): SportsOrganization | null {
  const competition = COMPETITIONS.find(c => c.id === competitionId);
  if (!competition) return null;
  return buildCompetitionSchema(competition);
}

export { buildCompetitionSchema as default };
export { getCountryFromCompetitionId };
