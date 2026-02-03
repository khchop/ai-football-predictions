/**
 * Leaderboard FAQ Generator
 *
 * Generates dynamic FAQ content based on current leaderboard data.
 * Optimized for GEO (Generative Engine Optimization) with:
 * - TL;DR question first (AI search citation priority)
 * - 5 FAQ max (reasonable schema size)
 * - 300 char answer truncation (schema best practice)
 */

import type { FAQItem } from '@/lib/seo/schemas';

export interface LeaderboardFAQData {
  totalModels: number;
  totalPredictions: number;
  topModel: {
    name: string;
    avgPoints: number;
    accuracy: number;
  } | null;
  timePeriod: 'all' | 'weekly' | 'monthly';
}

/**
 * Truncate text to max length at last complete sentence
 */
function truncateToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastSentenceEnd > maxLength / 2) {
    return text.slice(0, lastSentenceEnd + 1);
  }

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength / 2) {
    return text.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Generate FAQ items for leaderboard page
 */
export function generateLeaderboardFAQs(data: LeaderboardFAQData): FAQItem[] {
  const { totalModels, totalPredictions, topModel, timePeriod } = data;

  const periodLabel = timePeriod === 'weekly' ? 'this week'
    : timePeriod === 'monthly' ? 'this month'
    : 'all time';

  // Q1: TL;DR - What determines ranking (always first for AI citation)
  const tldrAnswer = `Models are ranked by average points per prediction using the Kicktipp scoring system. Points are awarded for correct tendency (2-6 based on rarity), goal difference bonus (+1), and exact score bonus (+3). Maximum 10 points per match. The leaderboard tracks ${totalModels} AI models across ${totalPredictions.toLocaleString()} predictions.`;

  // Q2: Best performing model (dynamic)
  let bestModelAnswer = `Performance varies by time period and competition.`;
  if (topModel) {
    bestModelAnswer = `${topModel.name} leads the leaderboard ${periodLabel} with ${topModel.avgPoints.toFixed(2)} average points per match and ${topModel.accuracy.toFixed(1)}% tendency accuracy. Use weekly/monthly filters to compare recent performance versus long-term consistency.`;
  }

  // Q3: Trend indicators explanation (new feature)
  const trendAnswer = `Trend indicators show rank changes compared to the previous ${timePeriod === 'weekly' ? 'week' : timePeriod === 'monthly' ? 'month' : 'period'}. Green up arrows indicate rising rank, red down arrows indicate falling rank. Gray minus means stable position. "New" badges mark models that recently started making predictions.`;

  // Q4: Time filtering explanation
  const filterAnswer = `Use time period filters to view all-time rankings for consistency, monthly rankings for medium-term trends, or weekly rankings for recent hot streaks. Competition filters narrow results to specific leagues like Premier League or Champions League.`;

  // Q5: Update frequency
  const updateAnswer = `The leaderboard updates automatically after each match is scored, typically within minutes of the final whistle. Rankings reflect the most recent results. Weekly views reset each Monday (ISO week standard), monthly views reset on the 1st.`;

  const faqs: FAQItem[] = [
    {
      question: 'What determines AI model ranking on this leaderboard?',
      answer: truncateToSentence(tldrAnswer, 300),
    },
    {
      question: 'Which AI model is currently performing best?',
      answer: truncateToSentence(bestModelAnswer, 300),
    },
    {
      question: 'What do the trend indicators (arrows) mean?',
      answer: truncateToSentence(trendAnswer, 300),
    },
    {
      question: 'Can I filter the leaderboard by time period?',
      answer: truncateToSentence(filterAnswer, 300),
    },
    {
      question: 'How often is the leaderboard updated?',
      answer: truncateToSentence(updateAnswer, 300),
    },
  ];

  return faqs;
}
