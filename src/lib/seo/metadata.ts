import type { Metadata } from 'next';
import { BASE_URL, SITE_NAME, MAX_TITLE_LENGTH, MAX_META_DESCRIPTION_LENGTH, MAX_OG_DESCRIPTION_LENGTH } from './constants';
import type { MatchSeoData, MatchStatus } from './types';
import { isMatchFinished, isMatchLive, isMatchUpcoming } from './types';
import { abbreviateTeam, abbreviateCompetition } from './abbreviations';

/**
 * Truncate text to maximum length at last word boundary
 * Adds ellipsis only if actually truncated
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find last space before maxLength (account for "..." = 3 chars)
  const truncateAt = maxLength - 3;
  const lastSpace = text.lastIndexOf(' ', truncateAt);

  // If no space found or too close to start, just hard truncate
  if (lastSpace === -1 || lastSpace < maxLength * 0.5) {
    return text.substring(0, truncateAt) + '...';
  }

  return text.substring(0, lastSpace) + '...';
}

export function createTitle(match: MatchSeoData): string {
  const home = abbreviateTeam(match.homeTeam);
  const away = abbreviateTeam(match.awayTeam);

  if (isMatchFinished(match.status) && match.homeScore !== null && match.awayScore !== null) {
    // Format: "Man Utd 2-1 Liverpool | kroam.xyz" (~30-40 chars)
    return `${home} ${match.homeScore}-${match.awayScore} ${away} | kroam.xyz`;
  }
  // Format: "Man Utd vs Liverpool Prediction" (~30-40 chars)
  return `${home} vs ${away} Prediction`;
}

export function createDescription(match: MatchSeoData): string {
  if (isMatchUpcoming(match.status)) {
    // Include predicted score when available
    if (match.predictedHomeScore !== undefined && match.predictedAwayScore !== undefined) {
      const baseMsg = `AI predicts ${match.predictedHomeScore}-${match.predictedAwayScore} for ${match.homeTeam} vs ${match.awayTeam}.`;
      const modelsMsg = ` 35 models compete - see who's most accurate.`;
      const full = baseMsg + modelsMsg;
      return truncateWithEllipsis(full, MAX_META_DESCRIPTION_LENGTH);
    }
    const full = `Get AI predictions for ${match.homeTeam} vs ${match.awayTeam}. See which models forecast the winner before kickoff on ${formatDate(match.startDate)}.`;
    return truncateWithEllipsis(full, MAX_META_DESCRIPTION_LENGTH);
  }

  if (isMatchLive(match.status)) {
    const full = `Follow ${match.homeTeam} vs ${match.awayTeam} live. Track AI predictions in real-time and see how models perform as the action unfolds.`;
    return truncateWithEllipsis(full, MAX_META_DESCRIPTION_LENGTH);
  }

  // Finished match
  const scoreInfo = match.homeScore !== null && match.awayScore !== null
    ? `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} match analysis.`
    : `${match.homeTeam} vs ${match.awayTeam} match analysis.`;
  const modelsMsg = ` AI predictions from 35 models with accuracy tracking.`;
  const full = scoreInfo + modelsMsg;

  return truncateWithEllipsis(full, MAX_META_DESCRIPTION_LENGTH);
}

export function buildMatchMetadata(match: MatchSeoData): Metadata {
  const title = truncateWithEllipsis(createTitle(match), MAX_TITLE_LENGTH);
  const description = createDescription(match); // Already truncated in createDescription

  const url = `/matches/${match.id}`;
  const ogImageUrl = `${BASE_URL}${url}/opengraph-image`;

  // Build OG description with predicted score and optional accuracy
  let ogDescription = description;
  if (isMatchUpcoming(match.status) && match.predictedHomeScore !== undefined && match.predictedAwayScore !== undefined) {
    const predictedScore = `AI predicts ${match.predictedHomeScore}-${match.predictedAwayScore} for ${match.homeTeam} vs ${match.awayTeam}`;
    const accuracyInfo = match.modelAccuracy ? ` - Prediction Accuracy: ${match.modelAccuracy}%` : '';
    const fullOg = predictedScore + accuracyInfo;
    ogDescription = truncateWithEllipsis(fullOg, MAX_OG_DESCRIPTION_LENGTH);
  }

  // Determine if match should be noindex (finished matches >30 days old)
  let shouldNoIndex = false;
  if (match.status === 'finished') {
    const matchDate = new Date(match.startDate);
    const daysSinceMatch = (Date.now() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
    shouldNoIndex = daysSinceMatch > 30;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description: ogDescription,
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
      description: ogDescription,
      images: [ogImageUrl],
      site: '@bettingsoccer',
    },
    alternates: {
      canonical: `${BASE_URL}${url}`,
    },
    robots: {
      index: !shouldNoIndex,
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
  const truncatedTitle = truncateWithEllipsis(headline, MAX_TITLE_LENGTH);
  const truncatedDescription = truncateWithEllipsis(description, MAX_META_DESCRIPTION_LENGTH);
  const truncatedOgDescription = truncateWithEllipsis(description, MAX_OG_DESCRIPTION_LENGTH);

  return {
    title: truncatedTitle,
    description: truncatedDescription,
    openGraph: {
      title: truncatedTitle,
      description: truncatedOgDescription,
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
      title: truncatedTitle,
      description: truncatedOgDescription,
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
    ? `${competition} Leaderboard | AI Model Rankings | kroam.xyz`
    : `AI Model Leaderboard | Compare 35 Models | kroam.xyz`;

  const description = competition
    ? `Compare ${competition} predictions across all AI models. See which model performs best with real-time accuracy tracking.`
    : `Compare AI model accuracy across 17 football competitions. See which models predict best in Champions League, Premier League, and more.`;

  const truncatedTitle = truncateWithEllipsis(title, MAX_TITLE_LENGTH);
  const truncatedDescription = truncateWithEllipsis(description, MAX_META_DESCRIPTION_LENGTH);

  return {
    title: truncatedTitle,
    description: truncatedDescription,
    openGraph: {
      title: truncatedTitle,
      description: truncatedDescription,
      type: 'website',
      url: competition ? `/leaderboard/${competition.toLowerCase().replace(/\s+/g, '-')}` : '/leaderboard',
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: truncatedTitle,
      description: truncatedDescription,
    },
    alternates: {
      canonical: competition
        ? `${BASE_URL}/leaderboard/${competition.toLowerCase().replace(/\s+/g, '-')}`
        : `${BASE_URL}/leaderboard`,
    },
  };
}

export function generateHomeMetadata(): Metadata {
  const title = `${SITE_NAME} | AI-Powered Football Match Predictions`;
  const description = `Get accurate football predictions from multiple AI models. Track model performance, analyze predictions, and see which models beat the odds.`;

  const truncatedTitle = truncateWithEllipsis(title, MAX_TITLE_LENGTH);
  const truncatedDescription = truncateWithEllipsis(description, MAX_META_DESCRIPTION_LENGTH);
  const truncatedOgDescription = truncateWithEllipsis(description, MAX_OG_DESCRIPTION_LENGTH);

  return {
    title: truncatedTitle,
    description: truncatedDescription,
    openGraph: {
      title: truncatedTitle,
      description: truncatedOgDescription,
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
      title: truncatedTitle,
      description: truncatedOgDescription,
      images: [`${BASE_URL}/og-home.png`],
    },
    alternates: {
      canonical: BASE_URL,
    },
  };
}

export interface Competition {
  id: string;
  name: string;
}

export function generateCompetitionMetadata(competition: Competition): Metadata {
  const title = `${competition.name} Predictions | AI Models Compete | kroam.xyz`;
  const description = `AI predictions for ${competition.name} from 35 models. Track accuracy, compare predictions, and see which AI performs best.`;
  const url = `${BASE_URL}/leagues/${competition.id}`;

  const ogImageUrl = new URL(`${BASE_URL}/api/og/league`);
  ogImageUrl.searchParams.set('leagueName', competition.name);
  ogImageUrl.searchParams.set('matchCount', '0');
  ogImageUrl.searchParams.set('upcomingCount', '0');

  return {
    title,
    description,
    keywords: [competition.name, 'football predictions', 'AI predictions'],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: SITE_NAME,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${competition.name} AI Predictions`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}