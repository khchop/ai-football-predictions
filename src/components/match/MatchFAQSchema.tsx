import { format } from 'date-fns';
import type { Match, Competition } from '@/lib/db/schema';

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Generates exactly 5 FAQ items based on match state.
 *
 * Finished matches: final score, prediction accuracy, goalscorers, competition, AI methodology
 * Upcoming/Live matches: kickoff time, predictions summary, how to watch, venue, AI methodology
 */
export function generateMatchFAQs(match: Match, competition: Competition): FAQItem[] {
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const kickoffDate = new Date(match.kickoffTime);
  const formattedDate = format(kickoffDate, 'MMMM d, yyyy');
  const formattedTime = format(kickoffDate, 'h:mm a');

  if (isFinished) {
    return generateFinishedMatchFAQs(match, competition, formattedDate);
  }

  // Upcoming or live matches share the same question set
  return generateUpcomingOrLiveFAQs(match, competition, formattedDate, formattedTime, isLive);
}

function generateFinishedMatchFAQs(
  match: Match,
  competition: Competition,
  formattedDate: string
): FAQItem[] {
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;

  return [
    // 1. Final score
    {
      question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}. The match was played in the ${competition.name} on ${formattedDate}.`,
    },
    // 2. Prediction accuracy
    {
      question: `Which AI models correctly predicted ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `Multiple AI models predicted this match. Check the predictions table above to see which models like GPT-4, Claude, and Gemini got the correct result or exact score.`,
    },
    // 3. Goalscorers
    {
      question: `Who scored in ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `The match ended ${homeScore}-${awayScore}. View the match events section above for the full breakdown of goalscorers and key moments.`,
    },
    // 4. Competition context
    {
      question: `What competition was ${match.homeTeam} vs ${match.awayTeam} in?`,
      answer: `This match was part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. View more ${competition.name} matches and predictions on kroam.xyz.`,
    },
    // 5. AI methodology
    {
      question: `How accurate are AI predictions for football matches?`,
      answer: `AI models analyze historical data, team form, head-to-head records, and statistical patterns. Accuracy varies by model and competition. View the leaderboard to see which models perform best.`,
    },
  ];
}

function generateUpcomingOrLiveFAQs(
  match: Match,
  competition: Competition,
  formattedDate: string,
  formattedTime: string,
  isLive: boolean
): FAQItem[] {
  // Question 1: Kickoff time - varies by live vs upcoming
  const kickoffQuestion: FAQItem = {
    question: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
    answer: isLive
      ? `The match is currently in progress${match.venue ? ` at ${match.venue}` : ''}.`
      : `The match kicks off on ${formattedDate} at ${formattedTime}${match.venue ? ` at ${match.venue}` : ''}.`,
  };

  // Question 4: Venue - varies by whether venue is known
  const venueQuestion: FAQItem = {
    question: `Where is ${match.homeTeam} vs ${match.awayTeam} being played?`,
    answer: match.venue
      ? `The match takes place at ${match.venue}.`
      : `The venue for this ${competition.name} match has not been confirmed. Check back closer to kickoff for venue details.`,
  };

  return [
    // 1. Kickoff time
    kickoffQuestion,
    // 2. Predictions summary
    {
      question: `What do AI models predict for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `AI models including GPT-4, Claude, and Gemini have analyzed this match. View the predictions table above for individual model forecasts and the consensus prediction.`,
    },
    // 3. How to watch
    {
      question: `How can I watch ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `Check your local ${competition.name} broadcaster for live coverage. Popular options include streaming services and sports channels that carry ${competition.name} matches.`,
    },
    // 4. Venue
    venueQuestion,
    // 5. AI methodology (same as finished)
    {
      question: `How accurate are AI predictions for football matches?`,
      answer: `AI models analyze historical data, team form, head-to-head records, and statistical patterns. Accuracy varies by model and competition. View the leaderboard to see which models perform best.`,
    },
  ];
}
