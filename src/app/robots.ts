/**
 * robots.ts - AI Crawler Configuration
 *
 * This file configures crawler access to kroam.xyz with explicit allow rules
 * for AI search engines to maximize visibility in AI-generated search results.
 *
 * AI Crawler Strategy:
 * - ALLOW all major AI crawlers for content indexing and citation
 * - Separate rules for training vs search crawlers (both allowed)
 * - Group by company for maintainability
 * - Review quarterly for new crawlers (AI landscape evolves rapidly)
 *
 * Last updated: 2026-02-02
 */

import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/_next/', '/static/'],
      },

      // OpenAI crawlers
      {
        userAgent: 'GPTBot', // Training crawler
        allow: '/',
      },
      {
        userAgent: 'ChatGPT-User', // ChatGPT browse mode
        allow: '/',
      },
      {
        userAgent: 'OAI-SearchBot', // SearchGPT (search results crawler)
        allow: '/',
      },

      // Anthropic crawlers
      {
        userAgent: 'ClaudeBot', // Training crawler
        allow: '/',
      },
      {
        userAgent: 'Claude-SearchBot', // Claude search feature
        allow: '/',
      },
      {
        userAgent: 'Anthropic-AI', // General Anthropic crawler
        allow: '/',
      },

      // Google AI
      {
        userAgent: 'Google-Extended', // Gemini/Bard training
        allow: '/',
      },

      // Perplexity
      {
        userAgent: 'PerplexityBot', // Perplexity search crawler
        allow: '/',
      },

      // Amazon
      {
        userAgent: 'Amazonbot', // Alexa, Amazon Q, shopping search
        allow: '/',
      },

      // Common Crawl (training data for many AI systems)
      {
        userAgent: 'CCBot',
        allow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
