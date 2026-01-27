import type { WithContext, Article, NewsArticle } from 'schema-dts';
import { BASE_URL, SITE_NAME } from '../constants';
import type { MatchSeoData } from '../types';

export function buildArticleSchema(match: MatchSeoData): NewsArticle {
  const matchUrl = `${BASE_URL}/matches/${match.id}`;
  
  // Create article metadata from match data
  const article: NewsArticle = {
    '@type': 'NewsArticle',
    headline: createArticleHeadline(match),
    description: createArticleDescription(match),
    image: [createOgImageUrl(match)],
    datePublished: match.startDate,
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
    about: {
      '@type': 'SportsEvent',
      '@id': matchUrl,
    },
    articleSection: 'Sports',
    keywords: generateKeywords(match),
    inLanguage: 'en-US',
    isAccessibleForFree: true,
  };
  
  return article;
}

function createArticleHeadline(match: MatchSeoData): string {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} | Match Analysis`;
  }
  return `${match.homeTeam} vs ${match.awayTeam} | Match Preview & Predictions`;
}

function createArticleDescription(match: MatchSeoData): string {
  return `Comprehensive ${match.competition} coverage featuring ${match.homeTeam} vs ${match.awayTeam}. AI-powered predictions, model performance analysis, and real-time updates.`;
}

function createOgImageUrl(match: MatchSeoData): string {
  return `${BASE_URL}/matches/${match.id}/opengraph-image`;
}

function generateKeywords(match: MatchSeoData): string {
  const keywords = [
    match.homeTeam,
    match.awayTeam,
    match.competition,
    'football',
    'predictions',
    'AI',
    'match analysis',
  ];
  
  if (match.round) {
    keywords.push(match.round);
  }
  
  return keywords.join(', ');
}

export { buildArticleSchema as default };