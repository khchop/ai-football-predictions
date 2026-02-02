/**
 * Centralized abbreviation utilities for SEO-optimized titles
 * Keeps match and league page titles under 60 characters
 */

// Team abbreviations for common long names (15+ chars)
const TEAM_ABBREVIATIONS: Record<string, string> = {
  'Manchester United': 'Man Utd',
  'Manchester City': 'Man City',
  'Tottenham Hotspur': 'Tottenham',
  'Brighton & Hove Albion': 'Brighton',
  'West Ham United': 'West Ham',
  'Wolverhampton Wanderers': 'Wolves',
  'Newcastle United': 'Newcastle',
  'Nottingham Forest': "Nott'm Forest",
  'Sheffield United': 'Sheffield Utd',
  'Crystal Palace': 'Crystal Palace', // already short enough
  'Leicester City': 'Leicester',
  'Borussia Dortmund': 'Dortmund',
  'Borussia Mönchengladbach': "M'gladbach",
  'Borussia Monchengladbach': "M'gladbach", // ASCII variant
  'Bayern Munich': 'Bayern',
  'Bayer Leverkusen': 'Leverkusen',
  'Paris Saint-Germain': 'PSG',
  'Atletico Madrid': 'Atletico',
  'Atlético Madrid': 'Atletico', // Unicode variant
  'Real Sociedad': 'Sociedad',
  'Athletic Bilbao': 'Athletic',
  'Athletic Club': 'Athletic',
  'Inter Milan': 'Inter',
  'AC Milan': 'Milan',
  'Atalanta BC': 'Atalanta',
  'Olympique Lyon': 'Lyon',
  'Olympique Marseille': 'Marseille',
  'RB Leipzig': 'Leipzig',
  'Eintracht Frankfurt': 'Frankfurt',
};

// Competition name optimizations
const COMPETITION_ABBREVIATIONS: Record<string, string> = {
  'UEFA Champions League': 'Champions League',
  'UEFA Europa League': 'Europa League',
  'UEFA Conference League': 'Conference League',
  'English Premier League': 'Premier League',
  'Spanish La Liga': 'La Liga',
  'German Bundesliga': 'Bundesliga',
  'Italian Serie A': 'Serie A',
  'French Ligue 1': 'Ligue 1',
  'Dutch Eredivisie': 'Eredivisie',
  'Portuguese Primeira Liga': 'Primeira Liga',
};

/**
 * Abbreviate team name if a shorter form exists
 * Returns original name if no abbreviation defined
 */
export function abbreviateTeam(name: string): string {
  return TEAM_ABBREVIATIONS[name] || name;
}

/**
 * Abbreviate competition name for shorter titles
 * Falls back to removing common prefixes if no explicit abbreviation
 */
export function abbreviateCompetition(name: string): string {
  return (
    COMPETITION_ABBREVIATIONS[name] ||
    name
      .replace(/^UEFA /, '')
      .replace(/^English /, '')
      .replace(/^Spanish /, '')
      .replace(/^German /, '')
      .replace(/^Italian /, '')
      .replace(/^French /, '')
      .replace(/^Dutch /, '')
      .replace(/^Portuguese /, '')
  );
}
