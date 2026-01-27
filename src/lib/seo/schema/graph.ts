import type { MatchSeoData } from '../types';
import { buildSportsEventSchema } from './sports-event';
import { buildArticleSchema } from './article';

export function buildMatchGraphSchema(match: MatchSeoData): object {
  // Build individual schemas
  const eventSchema = buildSportsEventSchema(match);
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
  
  // Build graph with all entities
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationSchema,
      eventSchema,
      articleSchema,
    ],
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