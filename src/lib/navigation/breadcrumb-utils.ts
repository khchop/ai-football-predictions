/**
 * Breadcrumb Builder Utilities
 * Functions to generate consistent breadcrumb arrays for each page type
 */

export interface BreadcrumbItem {
  name: string;
  href: string;
}

/**
 * Build breadcrumbs for match pages
 * Home > League > Match
 */
export function buildMatchBreadcrumbs(
  competitionName: string,
  competitionSlug: string,
  matchTitle: string,
  _matchSlug: string // Not used in href since it's current page
): BreadcrumbItem[] {
  return [
    { name: 'Home', href: '/' },
    { name: competitionName, href: `/leagues/${competitionSlug}` },
    { name: matchTitle, href: '' }, // Current page
  ];
}

/**
 * Build breadcrumbs for league pages
 * Home > Leagues > League
 */
export function buildLeagueBreadcrumbs(
  competitionName: string,
  competitionSlug: string
): BreadcrumbItem[] {
  return [
    { name: 'Home', href: '/' },
    { name: 'Leagues', href: '/leagues' },
    { name: competitionName, href: '' }, // Current page
  ];
}

/**
 * Build breadcrumbs for blog pages
 * Home > Blog > Post
 */
export function buildBlogBreadcrumbs(
  postTitle: string,
  _postSlug: string // Not used in href since it's current page
): BreadcrumbItem[] {
  return [
    { name: 'Home', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: postTitle, href: '' }, // Current page
  ];
}

/**
 * Build breadcrumbs for model pages
 * Home > Models > Model
 */
export function buildModelBreadcrumbs(
  modelName: string,
  _modelId: string // Not used in href since it's current page
): BreadcrumbItem[] {
  return [
    { name: 'Home', href: '/' },
    { name: 'Models', href: '/models' },
    { name: modelName, href: '' }, // Current page
  ];
}

/**
 * Build breadcrumbs for leaderboard page
 * Home > Leaderboard
 */
export function buildLeaderboardBreadcrumbs(): BreadcrumbItem[] {
  return [
    { name: 'Home', href: '/' },
    { name: 'Leaderboard', href: '' }, // Current page
  ];
}
