'use client';

import { useMatch } from './use-match';
import { MatchHero } from './match-hero';
import { MatchNarrative } from './match-narrative';
import { SortablePredictionsTable } from './sortable-predictions-table';
import { MatchFAQ, type FAQItem } from './match-faq';
import { Bot } from 'lucide-react';

interface Prediction {
  id: string;
  modelId: string;
  modelDisplayName: string;
  provider: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number | null;
  isExact: boolean;
  isCorrectResult: boolean;
}

interface MatchLayoutProps {
  predictions: Prediction[];
  faqs?: FAQItem[] | null;
}

/**
 * MatchLayout - State-aware layout orchestrator for match pages.
 *
 * Renders sections based on matchState from context:
 * - Upcoming: Hero + Narrative ("Match Preview") + Predictions + FAQ
 * - Live: Hero + Predictions + FAQ (NO narrative)
 * - Finished: Hero + Narrative ("Match Report") + Predictions + FAQ
 *
 * Section ordering and visibility per user decisions in 30-CONTEXT.md.
 *
 * @example
 * ```tsx
 * <MatchDataProvider match={match} competition={competition} analysis={analysis}>
 *   <MatchLayout predictions={predictions} faqs={faqs} />
 * </MatchDataProvider>
 * ```
 */
export function MatchLayout({ predictions, faqs }: MatchLayoutProps) {
  const { match, competition, matchState } = useMatch();

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
      {/* Hero - Always visible for all match states */}
      <MatchHero />

      {/* Narrative - Hidden during live matches per CONTEXT.md */}
      {matchState !== 'live' && (
        <section>
          <MatchNarrative />
        </section>
      )}

      {/* Predictions - Always visible per CONTEXT.md */}
      <PredictionsSection
        predictions={predictions}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        isFinished={matchState === 'finished'}
      />

      {/* FAQ - Always visible (has its own heading) */}
      <MatchFAQ match={match} competition={competition} aiFaqs={faqs} />
    </div>
  );
}

/**
 * PredictionsSection - Wraps SortablePredictionsTable with H2 heading.
 *
 * Per CONTEXT.md: "Every section has a visible H2 heading"
 */
function PredictionsSection({
  predictions,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  isFinished,
}: {
  predictions: Prediction[];
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isFinished: boolean;
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        Predictions
      </h2>
      <SortablePredictionsTable
        predictions={predictions}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeScore={homeScore}
        awayScore={awayScore}
        isFinished={isFinished}
      />
    </section>
  );
}
