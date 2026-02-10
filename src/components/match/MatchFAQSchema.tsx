import { format } from 'date-fns';
import type { Match, Competition, MatchAnalysis } from '@/lib/db/schema';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PredictionSummary {
  totalModels: number;
  modelNames: string[];           // e.g. ["Gemini 2.5 Pro", "GPT-4.1", ...]
  homeWinCount: number;
  drawCount: number;
  awayWinCount: number;
  topScoreline?: string;          // e.g. "2-1" (most predicted)
  topScorelineCount?: number;     // how many models predicted it
  // Finished match only:
  correctResultCount?: number;    // models that got the right outcome
  exactScoreCount?: number;       // models that nailed exact score
  topScorerNames?: string[];      // top 3 model names by points
}

/**
 * Generates exactly 5 FAQ items based on match state.
 *
 * Finished matches: final score, prediction accuracy, odds analysis, competition, AI methodology
 * Upcoming/Live matches: kickoff time, predictions summary, who is favored, team form, AI methodology
 *
 * When enrichment data is provided, answers contain real statistics, odds, and model details.
 * Without enrichment data, answers are generic but self-contained (no "see above" redirects).
 */
export function generateMatchFAQs(
  match: Match,
  competition: Competition,
  options?: { predictions?: PredictionSummary; analysis?: MatchAnalysis | null }
): FAQItem[] {
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const kickoffDate = new Date(match.kickoffTime);
  const formattedDate = format(kickoffDate, 'MMMM d, yyyy');
  const formattedTime = format(kickoffDate, 'h:mm a');

  if (isFinished) {
    return generateFinishedMatchFAQs(match, competition, formattedDate, options);
  }

  // Upcoming or live matches share the same question set
  return generateUpcomingOrLiveFAQs(match, competition, formattedDate, formattedTime, isLive, options);
}

function generateFinishedMatchFAQs(
  match: Match,
  competition: Competition,
  formattedDate: string,
  options?: { predictions?: PredictionSummary; analysis?: MatchAnalysis | null }
): FAQItem[] {
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  const predictions = options?.predictions;
  const analysis = options?.analysis;

  // FAQ 2: Prediction accuracy - dynamic with real data
  const accuracyAnswer = predictions
    ? (() => {
        const parts: string[] = [];
        parts.push(`Of ${predictions.totalModels} AI models, ${predictions.correctResultCount ?? 0} correctly predicted the match outcome`);

        if (predictions.exactScoreCount && predictions.exactScoreCount > 0) {
          parts.push(`and ${predictions.exactScoreCount} predicted the exact score of ${homeScore}-${awayScore}`);
        }

        let result = parts.join(' ') + '.';

        if (predictions.topScorerNames && predictions.topScorerNames.length > 0) {
          result += ` Top performers were ${predictions.topScorerNames.join(', ')}.`;
        }

        if (predictions.topScoreline === `${homeScore}-${awayScore}`) {
          result += ` The most popular prediction of ${predictions.topScoreline} was correct.`;
        }

        return result;
      })()
    : 'Multiple AI models predicted this match. Model accuracy for each prediction is shown with point scores on this page.';

  // FAQ 3: Odds analysis - dynamic with real data (replaces goalscorers since there's no events section)
  const oddsAnswer = analysis?.oddsHome && analysis?.oddsDraw && analysis?.oddsAway
    ? (() => {
        let result = `Pre-match betting odds were ${analysis.oddsHome} (home), ${analysis.oddsDraw} (draw), ${analysis.oddsAway} (away).`;

        if (analysis.advice) {
          result += ` The expert tip was: ${analysis.advice}.`;
        }

        result += ` The match ended ${homeScore}-${awayScore}.`;
        return result;
      })()
    : `Pre-match odds and analysis details are available for this ${competition.name} fixture.`;

  return [
    // 1. Final score
    {
      question: `What was the final score of ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: `${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}. The match was played in the ${competition.name} on ${formattedDate}.`,
    },
    // 2. Prediction accuracy
    {
      question: `How accurate were AI predictions for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: accuracyAnswer,
    },
    // 3. Odds analysis (replaces goalscorers)
    {
      question: `What were the odds for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: oddsAnswer,
    },
    // 4. Competition context
    {
      question: `What competition was ${match.homeTeam} vs ${match.awayTeam} in?`,
      answer: `This match was part of the ${competition.name}${match.round ? ` (${match.round})` : ''}. View more ${competition.name} matches and predictions on kroam.xyz.`,
    },
    // 5. AI methodology - dynamic with model count
    {
      question: `How accurate are AI predictions for football matches?`,
      answer: `${predictions?.totalModels ?? 'Over 35'} AI models independently analyze historical data, team form, head-to-head records, and statistical patterns for each match. Each model produces its own score prediction, creating a diverse consensus view. Model accuracy is tracked and ranked on the leaderboard.`,
    },
  ];
}

function generateUpcomingOrLiveFAQs(
  match: Match,
  competition: Competition,
  formattedDate: string,
  formattedTime: string,
  isLive: boolean,
  options?: { predictions?: PredictionSummary; analysis?: MatchAnalysis | null }
): FAQItem[] {
  const predictions = options?.predictions;
  const analysis = options?.analysis;

  // Question 1: Kickoff time - varies by live vs upcoming
  const kickoffQuestion: FAQItem = {
    question: `When is ${match.homeTeam} vs ${match.awayTeam}?`,
    answer: isLive
      ? `The match is currently in progress${match.venue ? ` at ${match.venue}` : ''}.`
      : `The match kicks off on ${formattedDate} at ${formattedTime}${match.venue ? ` at ${match.venue}` : ''}.`,
  };

  // FAQ 2: Predictions summary - dynamic with real data
  const predictionsAnswer = predictions
    ? (() => {
        const parts: string[] = [
          `${predictions.totalModels} AI models analyzed this match.`,
          `${predictions.homeWinCount} predict a ${match.homeTeam} win, ${predictions.drawCount} predict a draw, and ${predictions.awayWinCount} predict an ${match.awayTeam} win.`
        ];

        if (predictions.topScoreline && predictions.topScorelineCount) {
          parts.push(`The most predicted scoreline is ${predictions.topScoreline} (predicted by ${predictions.topScorelineCount} model${predictions.topScorelineCount > 1 ? 's' : ''}).`);
        }

        if (predictions.modelNames.length > 0) {
          const modelList = predictions.modelNames.slice(0, 4).join(', ');
          parts.push(`Models include ${modelList}.`);
        }

        return parts.join(' ');
      })()
    : 'Multiple AI models have analyzed this match with individual score predictions available on this page.';

  // FAQ 3: Odds/Favorites (replaces "how to watch")
  const oddsAnswer = analysis?.oddsHome && analysis?.oddsDraw && analysis?.oddsAway
    ? (() => {
        const odds = [
          { name: match.homeTeam, value: parseFloat(analysis.oddsHome) },
          { name: 'Draw', value: parseFloat(analysis.oddsDraw) },
          { name: match.awayTeam, value: parseFloat(analysis.oddsAway) }
        ];
        const favorite = odds.reduce((min, curr) => curr.value < min.value ? curr : min);
        const favoriteTeam = favorite.name === 'Draw' ? 'neither team is strongly favored' : `${favorite.name} is favored`;

        let result = `Based on betting odds, ${favoriteTeam} with odds of ${analysis.oddsHome}/${analysis.oddsDraw}/${analysis.oddsAway} (home/draw/away).`;

        if (analysis.advice) {
          result += ` Expert tip: ${analysis.advice}.`;
        }

        if (analysis.h2hTotal && analysis.h2hHomeWins !== null && analysis.h2hDraws !== null && analysis.h2hAwayWins !== null) {
          const awayWins = analysis.h2hTotal - analysis.h2hHomeWins - analysis.h2hDraws;
          result += ` In ${analysis.h2hTotal} head-to-head meeting${analysis.h2hTotal > 1 ? 's' : ''}, ${match.homeTeam} has won ${analysis.h2hHomeWins}, drawn ${analysis.h2hDraws}, with ${awayWins} ${match.awayTeam} win${awayWins !== 1 ? 's' : ''}.`;
        }

        return result;
      })()
    : 'Odds and head-to-head data are being compiled for this match. Check back closer to kickoff for detailed analysis.';

  // FAQ 4: Team Form (replaces venue)
  const teamFormAnswer = analysis?.homeTeamForm && analysis?.awayTeamForm &&
    analysis?.homeGoalsScored !== null && analysis?.homeGoalsConceded !== null &&
    analysis?.awayGoalsScored !== null && analysis?.awayGoalsConceded !== null
    ? `${match.homeTeam}'s recent form is ${analysis.homeTeamForm} with ${analysis.homeGoalsScored} goals scored and ${analysis.homeGoalsConceded} conceded in their last 5 matches. ${match.awayTeam}'s form is ${analysis.awayTeamForm} with ${analysis.awayGoalsScored} scored and ${analysis.awayGoalsConceded} conceded.`
    : match.venue
      ? `The match takes place at ${match.venue}.`
      : `The venue for this ${competition.name} match has not been confirmed. Check back closer to kickoff for venue details.`;

  const teamFormQuestion = analysis?.homeTeamForm && analysis?.awayTeamForm
    ? `How are ${match.homeTeam} and ${match.awayTeam} performing this season?`
    : `Where is ${match.homeTeam} vs ${match.awayTeam} being played?`;

  return [
    // 1. Kickoff time
    kickoffQuestion,
    // 2. Predictions summary
    {
      question: `What do AI models predict for ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: predictionsAnswer,
    },
    // 3. Odds/Favorites (replaces "how to watch")
    {
      question: `Who is favored to win ${match.homeTeam} vs ${match.awayTeam}?`,
      answer: oddsAnswer,
    },
    // 4. Team Form (or venue as fallback)
    {
      question: teamFormQuestion,
      answer: teamFormAnswer,
    },
    // 5. AI methodology - dynamic with model count
    {
      question: `How accurate are AI predictions for football matches?`,
      answer: `${predictions?.totalModels ?? 'Over 35'} AI models independently analyze historical data, team form, head-to-head records, and statistical patterns for each match. Each model produces its own score prediction, creating a diverse consensus view. Model accuracy is tracked and ranked on the leaderboard.`,
    },
  ];
}
