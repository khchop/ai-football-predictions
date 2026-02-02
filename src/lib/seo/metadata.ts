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
    // Include predicted score when available
    if (match.predictedHomeScore !== undefined && match.predictedAwayScore !== undefined) {
      const baseMsg = `AI predicts ${match.predictedHomeScore}-${match.predictedAwayScore} for ${match.homeTeam} vs ${match.awayTeam}.`;
      const modelsMsg = ` 35 models compete - see who's most accurate.`;
      // Keep under 155 chars
      return (baseMsg + modelsMsg).length > 155
        ? baseMsg + modelsMsg.substring(0, 155 - baseMsg.length - 3) + '...'
        : baseMsg + modelsMsg;
    }
    return `Get AI predictions for ${match.homeTeam} vs ${match.awayTeam}. See which models forecast the winner before kickoff on ${formatDate(match.startDate)}.`;
  }

  if (isMatchLive(match.status)) {
    return `Follow ${match.homeTeam} vs ${match.awayTeam} live. Track AI predictions in real-time and see how models perform as the action unfolds.`;
  }

  // Finished match
  const scoreInfo = match.homeScore !== null && match.awayScore !== null
    ? `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} match analysis.`
    : `${match.homeTeam} vs ${match.awayTeam} match analysis.`;
  const modelsMsg = ` AI predictions from 35 models with accuracy tracking.`;

  return (scoreInfo + modelsMsg).length > 155
    ? scoreInfo + modelsMsg.substring(0, 155 - scoreInfo.length - 3) + '...'
    : scoreInfo + modelsMsg;
}

export function buildMatchMetadata(match: MatchSeoData): Metadata {
  const title = createTitle(match);
  const description = createDescription(match);
  const url = `/matches/${match.id}`;
  const ogImageUrl = `${BASE_URL}${url}/opengraph-image`;

  // Build OG description with predicted score and optional accuracy
  let ogDescription = description;
  if (isMatchUpcoming(match.status) && match.predictedHomeScore !== undefined && match.predictedAwayScore !== undefined) {
    const predictedScore = `AI predicts ${match.predictedHomeScore}-${match.predictedAwayScore} for ${match.homeTeam} vs ${match.awayTeam}`;
    const accuracyInfo = match.modelAccuracy ? ` - Prediction Accuracy: ${match.modelAccuracy}%` : '';
    const fullOg = predictedScore + accuracyInfo;
    // Keep under 200 chars
    ogDescription = fullOg.length > 200 ? fullOg.substring(0, 197) + '...' : fullOg;
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