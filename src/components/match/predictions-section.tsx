import { Card, CardContent } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { getPredictionsForMatchWithDetails } from '@/lib/db/queries';
import { PredictionTable } from '@/components/prediction-table';
import { MatchRoundup } from './MatchRoundup';
import type { Match } from '@/lib/db/schema';

interface PredictionsSectionProps {
  matchId: string;
  match: Match;
  isFinished: boolean;
}

/**
 * Async Server Component that loads predictions.
 * Wrapped in Suspense boundary by parent page for streaming.
 */
export async function PredictionsSection({ matchId, match, isFinished }: PredictionsSectionProps) {
  // Fetch predictions - this is the slow part that streams in
  const predictions = await getPredictionsForMatchWithDetails(matchId);

  return (
    <>
      {/* AI Model Predictions */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            AI Model Predictions
          </h2>
          <PredictionTable
            predictions={predictions.map(p => ({
              id: p.predictionId,
              modelId: p.modelId,
              modelDisplayName: p.modelDisplayName,
              provider: p.provider,
              predictedHomeScore: p.predictedHome,
              predictedAwayScore: p.predictedAway,
              points: p.totalPoints,
              isExact: p.exactScoreBonus !== null && p.exactScoreBonus > 0,
              isCorrectResult: p.tendencyPoints !== null && p.tendencyPoints > 0,
            }))}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            isFinished={isFinished}
          />
        </CardContent>
      </Card>

      {/* Match Roundup (for finished matches) */}
      <MatchRoundup matchId={match.id} isFinished={isFinished} />
    </>
  );
}
