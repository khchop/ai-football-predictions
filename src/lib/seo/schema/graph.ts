import type { MatchSeoData } from '../types';
import { buildSportsEventSchema } from './sports-event';
import { buildArticleSchema } from './article';
import { buildBreadcrumbSchema, buildMatchBreadcrumbs } from './breadcrumb';

export interface MatchGraphOptions {
  competitionId?: string;
  competitionName?: string;
  competitionSlug?: string;
  matchSlug?: string;
}

export function buildMatchGraphSchema(match: MatchSeoData, options?: MatchGraphOptions): object {
  // Build individual schemas
  const eventSchema = buildSportsEventSchema(match, options?.competitionId);
  const articleSchema = buildArticleSchema(match);

  // Create organization reference
  const organizationSchema = {
    '@type': 'Organization',
    '@id': 'https://bettingsoccer.com#organization',
    name: 'BettingSoccer',
    url: 'https://bettingsoccer.com',
    logo: 'https://bettingsoccer.com/logo.png',
    description: 'AI-powered football match predictions and analysis platform',
  };

  // Build breadcrumb schema if we have the required data
  const graphItems: unknown[] = [organizationSchema, eventSchema, articleSchema];

  if (options?.competitionName && options?.competitionSlug && options?.matchSlug) {
    const matchName = `${match.homeTeam} vs ${match.awayTeam}`;
    const breadcrumbs = buildMatchBreadcrumbs(
      options.competitionName,
      options.competitionSlug,
      matchName,
      options.matchSlug
    );
    const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs);
    graphItems.push(breadcrumbSchema);
  }

  // Build graph with all entities
  const graph = {
    '@context': 'https://schema.org',
    '@graph': graphItems,
  };

  return graph;
}

export function sanitizeJsonLd(jsonLd: object): string {
  // Escape HTML characters to prevent XSS
  return JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/"/g, '\\u0022');
}

export { buildMatchGraphSchema as default };