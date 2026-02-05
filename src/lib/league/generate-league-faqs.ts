/**
 * League FAQ Generator
 *
 * Generates dynamic FAQ content for league pages based on competition data.
 * FAQs are optimized for GEO (Generative Engine Optimization) with:
 * - TL;DR question first (AI search citation priority)
 * - 5 FAQ max (reasonable schema size)
 * - 300 char answer truncation (schema best practice)
 */

import type { FAQItem } from '@/lib/seo/schemas';

export interface LeagueFAQData {
  competition: {
    id: string;
    name: string;
  };
  stats: {
    finishedMatches: number;
    avgGoalsPerMatch: number;
  };
  topModel?: {
    model: { name: string };
    accuracy: number;
  };
  activeModels?: number;
}

/**
 * Truncate text to max length at last complete sentence
 * Preserves complete sentences for better readability
 */
function truncateToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last sentence boundary before maxLength
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');

  // Find the last sentence ending
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

  // If we found a sentence boundary, truncate there (include the punctuation)
  if (lastSentenceEnd > maxLength / 2) {
    return text.slice(0, lastSentenceEnd + 1);
  }

  // Fallback: truncate at last space to avoid cutting words
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength / 2) {
    return text.slice(0, lastSpace) + '...';
  }

  // Final fallback: hard truncate
  return truncated + '...';
}

/**
 * Generate FAQ items for a league page
 *
 * @param data - Competition data with stats and optional top model
 * @returns Array of 5 FAQItem for FAQ section and schema
 *
 * @example
 * const faqs = generateLeagueFAQs({
 *   competition: { id: 'epl', name: 'Premier League' },
 *   stats: { finishedMatches: 245, avgGoalsPerMatch: 2.8 },
 *   topModel: { model: { name: 'GPT-4o' }, accuracy: 72.5 }
 * });
 */
export function generateLeagueFAQs(data: LeagueFAQData): FAQItem[] {
  const { competition, stats, topModel, activeModels } = data;
  const modelCount = activeModels ?? 35; // Fallback for backwards compatibility
  const name = competition.name;

  // Q1: TL;DR question FIRST (user decision from Phase 19)
  const tldrAnswer = `Our platform uses ${modelCount} AI models to predict exact scores for ${name} matches. The models analyze team form, head-to-head records, standings, and lineups to generate predictions approximately 30 minutes before kickoff.`;

  // Q2: Accuracy question with dynamic stats
  let accuracyAnswer = `Across ${stats.finishedMatches} ${name} matches, our AI models achieve varying accuracy levels.`;
  if (topModel && typeof topModel.accuracy === 'number' && !isNaN(topModel.accuracy)) {
    accuracyAnswer += ` The best performing model is ${topModel.model.name} with ${topModel.accuracy.toFixed(1)}% tendency accuracy.`;
  }

  // Q3: Match count question
  const matchCountAnswer = `We have tracked and predicted ${stats.finishedMatches} ${name} matches with AI analysis and exact score predictions from ${modelCount} different models.`;

  // Q4: Timing question
  const timingAnswer = `Predictions for ${name} matches are generated approximately 30 minutes before kickoff, once official team lineups are announced. This ensures predictions incorporate the most relevant team information.`;

  // Q5: Scoring system question
  const scoringAnswer = `We use the Kicktipp quota scoring system where correct predictions earn 2-6 points based on rarity, with an additional 3-point bonus for exact score matches (maximum 10 points per prediction).`;

  const faqs: FAQItem[] = [
    {
      question: `What are the AI predictions for ${name}?`,
      answer: truncateToSentence(tldrAnswer, 300),
    },
    {
      question: `How accurate are AI predictions for ${name}?`,
      answer: truncateToSentence(accuracyAnswer, 300),
    },
    {
      question: `How many ${name} matches have been predicted?`,
      answer: truncateToSentence(matchCountAnswer, 300),
    },
    {
      question: `When are ${name} predictions available?`,
      answer: truncateToSentence(timingAnswer, 300),
    },
    {
      question: `What scoring system is used for ${name} predictions?`,
      answer: truncateToSentence(scoringAnswer, 300),
    },
  ];

  return faqs;
}
