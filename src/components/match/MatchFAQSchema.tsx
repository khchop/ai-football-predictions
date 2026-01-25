import { FaqSchema } from '@/components/FaqSchema';
import type { Match, Competition } from '@/lib/db/schema';
import type { FAQItem } from '@/lib/seo/schemas';

interface MatchFAQSchemaProps {
  match: Match;
  competition: Competition;
  predictionCount: number;
}

/**
 * Match-specific FAQ schema component
 * Generates dynamic FAQs based on match data
 * Injects into page for rich snippet visibility in search results
 */
export function MatchFAQSchema({ 
  match, 
  competition, 
  predictionCount 
}: MatchFAQSchemaProps) {
  // Generate dynamic FAQs based on match data
  const faqs: FAQItem[] = [
    {
      question: `What is the predicted score for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `AI models predict an average score based on team form, historical matchups, and player performance. The predictions vary by model, as each uses different algorithms and training data. View the full prediction table above for individual model forecasts.`,
    },
    {
      question: 'How are Kicktipp points calculated?',
      answer: 'In the Kicktipp scoring system, models earn points for predicting the correct match result (win/draw/loss) and bonus points for predicting the exact final score. Tendency points are awarded for getting the outcome right, and exact score bonuses for predicting the precise scoreline.',
    },
    {
      question: 'Why do different AI models predict different scores?',
      answer: `Different AI models have been trained on different datasets and use different methodologies. Some focus on recent form, others on historical head-to-head records, player statistics, or league-wide patterns. This diversity is valuable because it provides multiple perspectives on the likely outcome.`,
    },
    {
      question: `Can I trust these AI predictions for ${competition.name}?`,
      answer: `These AI model predictions should be used as one information source among many. They are based on historical data and statistical patterns, but football involves inherent unpredictability. Always consider team news, injuries, and other contextual factors before making decisions based on any predictions.`,
    },
    {
      question: `What competition is ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `This match is part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. The kroam.xyz platform tracks AI model predictions across multiple football competitions to help you understand how different algorithms forecast match outcomes.`,
    },
  ];

  return <FaqSchema faqs={faqs} />;
}
