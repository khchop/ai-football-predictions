// SEO-related constants

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL
  ?? process.env.NEXT_PUBLIC_APP_URL
  ?? '';

export const SITE_NAME = 'BettingSoccer';

export const DEFAULT_OG_TEMPLATE = 'upcoming' as const;

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

export const MatchStatus = {
  upcoming: 'upcoming',
  live: 'live',
  finished: 'finished',
} as const;

export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export const SEO_DEFAULTS = {
  title: SITE_NAME,
  description: 'AI-powered football match predictions and analysis',
  siteName: SITE_NAME,
  twitterHandle: '@bettingsoccer',
  locale: 'en_US',
} as const;

export const ROBOTS_DEFAULTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
  },
} as const;

// SEO length constraints for optimal display in search results
export const MAX_TITLE_LENGTH = 60;
export const MAX_META_DESCRIPTION_LENGTH = 155;
export const MAX_OG_DESCRIPTION_LENGTH = 200;