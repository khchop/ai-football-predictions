// Competition configuration
// Add new competitions by simply adding entries to this array

export interface CompetitionConfig {
  id: string;
  name: string;
  apiFootballId: number;
  season: number;
  category: 'club-europe' | 'club-domestic' | 'international';
}

// Current season (auto-calculated: season starts in August)
// January-July = previous year's season (e.g., Jan 2026 = 2025-26 season = 2025)
// August-December = current year's season (e.g., Aug 2026 = 2026-27 season = 2026)
const CURRENT_SEASON = new Date().getMonth() >= 7 
  ? new Date().getFullYear() 
  : new Date().getFullYear() - 1;

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
  
  // Club - Domestic (Top 5 Leagues)
  {
    id: 'epl',
    name: 'Premier League',
    apiFootballId: 39,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  {
    id: 'laliga',
    name: 'La Liga',
    apiFootballId: 140,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    apiFootballId: 78,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  {
    id: 'seriea',
    name: 'Serie A',
    apiFootballId: 135,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  {
    id: 'ligue1',
    name: 'Ligue 1',
    apiFootballId: 61,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  // Club - Domestic (Other)
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    apiFootballId: 88,
    season: CURRENT_SEASON,
    category: 'club-domestic',
  },
  {
    id: 'superlig',
    name: 'Turkish Super Lig',
    apiFootballId: 203,
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
