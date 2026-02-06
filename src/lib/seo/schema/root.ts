/**
 * Root Schema Module
 *
 * Single source of truth for Organization and WebSite schemas.
 * These are rendered once in root layout and referenced via @id elsewhere.
 *
 * SCHEMA-01: No duplicate Organization/WebSite schemas on any page.
 */

// Stable @id constants for cross-referencing
export const ORGANIZATION_ID = 'https://kroam.xyz#organization';
export const WEBSITE_ID = 'https://kroam.xyz#website';

/**
 * Build root Organization schema
 * Rendered once in root layout, referenced by Article publisher and author
 */
export function buildRootOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Kroam',
    url: 'https://kroam.xyz',
    logo: {
      '@type': 'ImageObject',
      url: 'https://kroam.xyz/logo.png',
    },
    description: 'AI football prediction platform comparing 42 AI models on match predictions across 17 competitions',
  };
}

/**
 * Build root WebSite schema
 * Rendered once in root layout, referenced by WebPage isPartOf
 */
export function buildRootWebSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Kroam - AI Football Predictions',
    url: 'https://kroam.xyz',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://kroam.xyz/matches?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-US',
  };
}

/**
 * Build root SoftwareApplication schema
 * Describes the platform as a web application
 */
export function buildSoftwareApplicationSchema() {
  return {
    '@type': 'SoftwareApplication',
    name: 'kroam.xyz - AI Football Prediction Platform',
    description: 'Compare and track AI model predictions for football matches using the Kicktipp scoring system',
    applicationCategory: 'SportsApplication',
    url: 'https://kroam.xyz',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    inLanguage: 'en-US',
  };
}
