// Competition configuration
// Add new competitions by simply adding entries to this array

export interface CompetitionConfig {
  id: string;
  name: string;
  apiFootballId: number;
  season: number;
  category: 'club-europe' | 'club-domestic' | 'international';
  icon?: string;
  color?: string;
  aliases?: string[];
}

// Current season (auto-calculated: season starts in August)
// January-July = previous year's season (e.g., Jan 2026 = 2025-26 season = 2025)
// August-December = current year's season (e.g., Aug 2026 = 2026-27 season = 2026)
const now = new Date();
const CURRENT_SEASON = now.getMonth() >= 7 
  ? now.getFullYear() 
  : now.getFullYear() - 1;

export const COMPETITIONS: CompetitionConfig[] = [
  // Club - European
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    apiFootballId: 2,
    season: CURRENT_SEASON,
    category: 'club-europe',
    icon: '🏆',
    color: '#00447F',
    aliases: ['champions-league'],
  },
  {
    id: 'uel',
    name: 'UEFA Europa League',
    apiFootballId: 3,
    season: CURRENT_SEASON,
    category: 'club-europe',
    icon: '🏅',
    color: '#FF6B00',
    aliases: ['europa-league'],
  },
  {
    id: 'uecl',
    name: 'UEFA Conference League',
    apiFootballId: 848,
    season: CURRENT_SEASON,
    category: 'club-europe',
    icon: '💎',
    color: '#5C2D91',
  },

  // Club - Domestic (Top 5 Leagues)
  {
    id: 'epl',
    name: 'Premier League',
    apiFootballId: 39,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '🦁',
    color: '#3D195B',
    aliases: ['premier-league'],
  },
  {
    id: 'laliga',
    name: 'La Liga',
    apiFootballId: 140,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '🐂',
    color: '#A50044',
    aliases: ['la-liga'],
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    apiFootballId: 78,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '⚽',
    color: '#D20515',
  },
  {
    id: 'seriea',
    name: 'Serie A',
    apiFootballId: 135,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '⚽',
    color: '#004080',
    aliases: ['serie-a'],
  },
  {
    id: 'ligue1',
    name: 'Ligue 1',
    apiFootballId: 61,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '🥖',
    color: '#091C3E',
    aliases: ['ligue-1'],
  },
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    apiFootballId: 88,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '🌷',
    color: '#FF6200',
  },
  {
    id: 'superlig',
    name: 'Turkish Super Lig',
    apiFootballId: 203,
    season: CURRENT_SEASON,
    category: 'club-domestic',
    icon: '🌙',
    color: '#E30A17',
  },

  // International
  {
    id: 'world-cup',
    name: 'FIFA World Cup',
    apiFootballId: 1,
    season: 2026,
    category: 'international',
    icon: '🌍',
    color: '#326295',
  },
  {
    id: 'euro',
    name: 'UEFA Euro',
    apiFootballId: 4,
    season: 2024,
    category: 'international',
    icon: '🇪🇺',
    color: '#0040A0',
  },
  {
    id: 'nations-league',
    name: 'UEFA Nations League',
    apiFootballId: 5,
    season: CURRENT_SEASON,
    category: 'international',
    icon: '🌐',
    color: '#003399',
  },
  {
    id: 'copa-america',
    name: 'Copa America',
    apiFootballId: 9,
    season: 2024,
    category: 'international',
    icon: '🏆',
    color: '#009B3A',
  },
  {
    id: 'afcon',
    name: 'Africa Cup of Nations',
    apiFootballId: 6,
    season: 2025,
    category: 'international',
    icon: '🦁',
    color: '#009E60',
  },
  {
    id: 'wc-qual-europe',
    name: 'World Cup Qualifiers - Europe',
    apiFootballId: 32,
    season: CURRENT_SEASON,
    category: 'international',
    icon: '🌍',
    color: '#00447F',
  },
  {
    id: 'wc-qual-southamerica',
    name: 'World Cup Qualifiers - South America',
    apiFootballId: 28,
    season: CURRENT_SEASON,
    category: 'international',
    icon: '🌎',
    color: '#2E8B57',
  },
];

// Helper functions
export function getCompetitionById(id: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.id === id);
}

export function getCompetitionByIdOrAlias(slug: string): CompetitionConfig | undefined {
  // First try exact ID match
  const byId = COMPETITIONS.find(c => c.id === slug);
  if (byId) return byId;

  // Then search aliases
  return COMPETITIONS.find(c => c.aliases?.includes(slug));
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
