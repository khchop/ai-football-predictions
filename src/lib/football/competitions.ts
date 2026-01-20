// Competition configuration
// Add new competitions by simply adding entries to this array

export interface CompetitionConfig {
  id: string;
  name: string;
  apiFootballId: number;
  season: number;
  category: 'club-europe' | 'club-domestic' | 'international';
}

// Current season (update annually)
const CURRENT_SEASON = 2024;

export const COMPETITIONS: CompetitionConfig[] = [
  // Club - European
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    apiFootballId: 2,
    season: CURRENT_SEASON,
    category: 'club-europe',
  },
  {
    id: 'uel',
    name: 'UEFA Europa League',
    apiFootballId: 3,
    season: CURRENT_SEASON,
    category: 'club-europe',
  },
  {
    id: 'uecl',
    name: 'UEFA Conference League',
    apiFootballId: 848,
    season: CURRENT_SEASON,
    category: 'club-europe',
  },
  
  // Club - Domestic
  {
    id: 'epl',
    name: 'Premier League',
    apiFootballId: 39,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  
  // International
  {
    id: 'world-cup',
    name: 'FIFA World Cup',
    apiFootballId: 1,
    season: 2026, // Next World Cup
    category: 'international',
  },
  {
    id: 'euro',
    name: 'UEFA Euro',
    apiFootballId: 4,
    season: 2024, // Euro 2024
    category: 'international',
  },
  {
    id: 'nations-league',
    name: 'UEFA Nations League',
    apiFootballId: 5,
    season: CURRENT_SEASON,
    category: 'international',
  },
  {
    id: 'copa-america',
    name: 'Copa America',
    apiFootballId: 9,
    season: 2024,
    category: 'international',
  },
  {
    id: 'afcon',
    name: 'Africa Cup of Nations',
    apiFootballId: 6,
    season: 2025, // Next AFCON
    category: 'international',
  },
  
  // World Cup Qualifiers (add specific confederation IDs as needed)
  {
    id: 'wc-qual-europe',
    name: 'World Cup Qualifiers - Europe',
    apiFootballId: 32,
    season: CURRENT_SEASON,
    category: 'international',
  },
  {
    id: 'wc-qual-southamerica',
    name: 'World Cup Qualifiers - South America',
    apiFootballId: 28,
    season: CURRENT_SEASON,
    category: 'international',
  },
];

// Helper functions
export function getCompetitionById(id: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.id === id);
}

export function getCompetitionByApiId(apiId: number): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.apiFootballId === apiId);
}

export function getActiveCompetitions(): CompetitionConfig[] {
  return COMPETITIONS;
}

export function getCompetitionsByCategory(category: CompetitionConfig['category']): CompetitionConfig[] {
  return COMPETITIONS.filter(c => c.category === category);
}
