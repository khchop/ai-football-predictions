/**
 * Centralized URL generation utilities
 *
 * Purpose: Enforce canonical slug usage across the application to prevent
 * redirect-triggering URLs in sitemaps, internal links, and metadata.
 *
 * Why this matters:
 * - SEO: Search engines penalize redirect chains
 * - Performance: Redirects add unnecessary latency
 * - Consistency: Single source of truth for URL format
 *
 * Always use these helpers when generating links instead of manual string
 * concatenation to ensure canonical short-form slugs are used.
 */

import { getCompetitionById } from '@/lib/football/competitions';
import { BASE_URL } from '@/lib/seo/constants';

export type InternalUrlType = 'league' | 'model' | 'match' | 'blog' | 'static';

export interface InternalUrlParams {
  slug?: string;
  id?: string;
  leagueSlug?: string;
  matchSlug?: string;
}

/**
 * Generate a canonical relative URL for internal navigation
 *
 * @param type - The type of URL to generate
 * @param params - Parameters needed for the URL
 * @returns Canonical relative path (e.g., '/leagues/epl', '/models/qwen-32b')
 * @throws Error if required parameters are missing or invalid
 *
 * @example
 * // League URL - enforces canonical short-form slug
 * getInternalUrl('league', { slug: 'epl' }) // '/leagues/epl'
 * getInternalUrl('league', { slug: 'premier-league' }) // throws (use getCompetitionById to resolve)
 *
 * @example
 * // Model URL
 * getInternalUrl('model', { id: 'qwen-32b' }) // '/models/qwen-32b'
 *
 * @example
 * // Match URL
 * getInternalUrl('match', {
 *   leagueSlug: 'epl',
 *   matchSlug: 'arsenal-vs-chelsea-2026-02-06'
 * }) // '/leagues/epl/arsenal-vs-chelsea-2026-02-06'
 *
 * @example
 * // Blog URL
 * getInternalUrl('blog', { slug: 'how-ai-predicts-football' }) // '/blog/how-ai-predicts-football'
 *
 * @example
 * // Static page URL
 * getInternalUrl('static', { slug: '/about' }) // '/about'
 */
export function getInternalUrl(type: InternalUrlType, params: InternalUrlParams): string {
  switch (type) {
    case 'league': {
      if (!params.slug) {
        throw new Error('League URL requires slug parameter');
      }

      // Enforce canonical slug by looking up competition
      const competition = getCompetitionById(params.slug);
      if (!competition) {
        throw new Error(`Unknown competition slug: ${params.slug}`);
      }

      return `/leagues/${competition.id}`;
    }

    case 'model': {
      if (!params.id) {
        throw new Error('Model URL requires id parameter');
      }
      return `/models/${params.id}`;
    }

    case 'match': {
      if (!params.leagueSlug || !params.matchSlug) {
        throw new Error('Match URL requires leagueSlug and matchSlug parameters');
      }
      return `/leagues/${params.leagueSlug}/${params.matchSlug}`;
    }

    case 'blog': {
      if (!params.slug) {
        throw new Error('Blog URL requires slug parameter');
      }
      return `/blog/${params.slug}`;
    }

    case 'static': {
      if (!params.slug) {
        throw new Error('Static URL requires slug parameter');
      }
      // Static URLs are already in canonical form (e.g., '/about', '/leaderboard')
      return params.slug;
    }

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown URL type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Generate an absolute URL for external links, metadata, and sitemaps
 *
 * @param type - The type of URL to generate
 * @param params - Parameters needed for the URL
 * @returns Full absolute URL (e.g., 'https://kroam.xyz/leagues/epl')
 *
 * @example
 * getAbsoluteUrl('league', { slug: 'epl' }) // 'https://kroam.xyz/leagues/epl'
 * getAbsoluteUrl('model', { id: 'qwen-32b' }) // 'https://kroam.xyz/models/qwen-32b'
 */
export function getAbsoluteUrl(type: InternalUrlType, params: InternalUrlParams): string {
  const relativePath = getInternalUrl(type, params);
  return `${BASE_URL}${relativePath}`;
}
