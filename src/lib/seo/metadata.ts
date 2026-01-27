import type { Metadata } from 'next';
import { BASE_URL, SITE_NAME } from './constants';
import type { MatchSeoData, MatchStatus } from './types';
import { isMatchFinished, isMatchLive, isMatchUpcoming } from './types';

export function createTitle(match: MatchSeoData): string {
  if (isMatchFinished(match.status) && match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} | Match Analysis & Predictions`;
  }
  return `${match.homeTeam} vs ${match.awayTeam} | Match Analysis & Predictions`;
}

export function createDescription(match: MatchSeoData): string {
  if (isMatchUpcoming(match.status)) {
    return `Get AI predictions for ${match.homeTeam} vs ${match.awayTeam}. See which models forecast the winner before kickoff on ${formatDate(match.startDate)}.`;
  }
  
  if (isMatchLive(match.status)) {
    return `Follow ${match.homeTeam} vs ${match.awayTeam} live. Track AI predictions in real-time and see how models perform as the action unfolds.`;
  }
  
  // Finished match
  const predictionsInfo = match.predictionsCount 
    ? ` AI predictions from ${match.predictionsCount} models`
    : '';
  const modelInfo = match.topModelName && match.topModelAccuracy
    ? ` with top model ${match.topModelName} achieving ${match.topModelAccuracy}% accuracy`
    : '';
  
  return `Comprehensive coverage of ${match.homeTeam} vs ${match.awayTeam} in ${match.competition}.${predictionsInfo}${modelInfo}. Match stats, model leaderboard rankings, and detailed performance analysis.`;
}

export function buildMatchMetadata(match: MatchSeoData): Metadata {
  const title = createTitle(match);
  const description = createDescription(match);
  const url = `/matches/${match.id}`;
  const ogImageUrl = `${BASE_URL}${url}/opengraph-image`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}${url}`,
      type: 'article',
      siteName: SITE_NAME,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${match.homeTeam} vs ${match.awayTeam}`,
        },
      ],
      publishedTime: match.startDate,
      authors: match.topModelName ? [match.topModelName] : undefined,
      section: 'Match Reports',
      tags: [
        match.homeTeam,
        match.awayTeam,
        match.competition,
        'football',
        'predictions',
        ...(match.round ? [match.round] : []),
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
      site: '@bettingsoccer',
    },
    alternates: {
      canonical: `${BASE_URL}${url}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function generateArticleMetadata(
  headline: string,
  description: string,
  slug: string,
  publishedAt: string,
  updatedAt?: string,
  image?: string
): Metadata {
  return {
    title: headline,
    description,
    openGraph: {
      title: headline,
      description,
      type: 'article',
      url: `${BASE_URL}/${slug}`,
      siteName: SITE_NAME,
      images: image ? [{ url: image, width: 1200, height: 630 }] : [],
      publishedTime: publishedAt,
      modifiedTime: updatedAt ?? publishedAt,
      authors: [SITE_NAME],
      section: 'Sports',
      tags: ['football', 'predictions', 'AI'],
    },
    twitter: {
      card: 'summary_large_image',
      title: headline,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: `${BASE_URL}/${slug}`,
    },
  };
}

export function generateLeaderboardMetadata(
  competition?: string
): Metadata {
  const title = competition 
    ? `${competition} Leaderboard | BettingSoccer`
    : `Model Leaderboard | BettingSoccer`;
    
  const description = competition
    ? `Compare ${competition} predictions across all AI models. See which model performs best with real-time accuracy tracking.`
    : `Compare AI model predictions across all competitions. Track accuracy, streaks, and performance metrics in real-time.`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: competition ? `/leaderboard/${competition.toLowerCase().replace(/\s+/g, '-')}` : '/leaderboard',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: competition 
        ? `${BASE_URL}/leaderboard/${competition.toLowerCase().replace(/\s+/g, '-')}`
        : `${BASE_URL}/leaderboard`,
    },
  };
}

export function generateHomeMetadata(): Metadata {
  return {
    title: `${SITE_NAME} | AI-Powered Football Match Predictions`,
    description: `Get accurate football predictions from multiple AI models. Track model performance, analyze predictions, and see which models beat the odds.`,
    openGraph: {
      title: `${SITE_NAME} | AI-Powered Football Match Predictions`,
      description: `Get accurate football predictions from multiple AI models. Track model performance, analyze predictions, and see which models beat the odds.`,
      type: 'website',
      url: BASE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: `${BASE_URL}/og-home.png`,
          width: 1200,
          height: 630,
          alt: 'BettingSoccer - AI Football Predictions',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} | AI-Powered Football Match Predictions`,
      description: `Get accurate football predictions from multiple AI models.`,
      images: [`${BASE_URL}/og-home.png`],
    },
    alternates: {
      canonical: BASE_URL,
    },
  };
}