import type { Match, Competition } from '@/lib/db/schema';

interface MatchFAQSchemaProps {
  match: Match;
  competition: Competition;
}

export interface FAQItem {
  question: string;
  answer: string;
}

function generateMatchFAQs(match: Match, competition: Competition): FAQItem[] {
  const isUpcoming = match.status === 'scheduled';
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const kickoffDate = new Date(match.kickoffTime);

  const faqs: FAQItem[] = [];

  // TL;DR question - always first (most important for GEO)
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    faqs.push({
      question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}. The match was played in the ${competition.name} on ${kickoffDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
    });
  } else if (isUpcoming || isLive) {
    faqs.push({
      question: `Who is predicted to win ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `AI models predict the outcome based on team form, historical matchups, and statistical analysis. View the predictions table on this page for individual model forecasts. Match kicks off ${kickoffDate.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}.`,
    });
  }

  // When/where questions
  faqs.push({
    question: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
    answer: `The match ${isFinished ? 'was played' : 'kicks off'} on ${kickoffDate.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}${match.venue ? ` at ${match.venue}` : ''}.`,
  });

  faqs.push({
    question: `What competition is ${match.homeTeam} vs ${match.awayTeam} in?`,
    answer: `This match is part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. Follow AI model predictions for this competition on kroam.xyz.`,
  });

  // Prediction methodology question
  faqs.push({
    question: 'How accurate are AI predictions for football matches?',
    answer: 'Our AI models use historical data, team form, head-to-head records, and statistical patterns to forecast match outcomes. Accuracy varies by model and competition. Predictions should be considered alongside other factors like team news, injuries, and match context.',
  });

  return faqs;
}

export function MatchFAQSchema({ match, competition }: MatchFAQSchemaProps) {
  const faqs = generateMatchFAQs(match, competition);

  const schema = {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // Note: @context added at page level with @graph, not here
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}

// Export for use in visual component
export { generateMatchFAQs };
