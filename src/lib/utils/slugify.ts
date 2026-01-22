import { format, parseISO } from 'date-fns';

/**
 * Convert text to URL-friendly slug
 * Removes special characters, converts to lowercase, replaces spaces with hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate match slug from team names and kickoff time
 * Format: "team-a-vs-team-b-yyyy-mm-dd"
 */
export function generateMatchSlug(
  homeTeam: string,
  awayTeam: string,
  kickoffTime: string
): string {
  const date = format(parseISO(kickoffTime), 'yyyy-MM-dd');
  const homeSlug = slugify(homeTeam);
  const awaySlug = slugify(awayTeam);
  
  return `${homeSlug}-vs-${awaySlug}-${date}`;
}

/**
 * Generate competition slug from name
 * Examples:
 * - "UEFA Champions League" -> "champions-league"
 * - "Premier League" -> "premier-league"
 * - "UEFA Europa League" -> "europa-league"
 */
export function generateCompetitionSlug(name: string): string {
  // Remove common prefixes for cleaner URLs
  const cleaned = name
    .replace(/^UEFA\s+/i, '')
    .replace(/^FIFA\s+/i, '')
    .replace(/^World\s+/i, '');
  
  return slugify(cleaned);
}

/**
 * Generate blog post slug from title
 * Format: "year/month/title-slug"
 */
export function generateBlogSlug(title: string, publishDate: string): string {
  const date = parseISO(publishDate);
  const year = format(date, 'yyyy');
  const month = format(date, 'MM');
  const titleSlug = slugify(title);
  
  return `${year}/${month}/${titleSlug}`;
}
