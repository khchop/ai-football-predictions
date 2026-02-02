import { Card, CardContent } from '@/components/ui/card';
import { PredictionTable } from '@/components/prediction-table';

interface Prediction {
  id: string;
  modelId: string;
  modelDisplayName: string;
  provider: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  confidence?: string | null;
  points?: number | null;
  isExact?: boolean;
  isCorrectResult?: boolean;
  pointsExactScore?: number;
  pointsResult?: number;
  pointsGoalDiff?: number;
  pointsOverUnder?: number;
  pointsBtts?: number;
  pointsUpsetBonus?: number;
  pointsTotal?: number;
}

interface PredictionsTabProps {
  predictions: Prediction[];
  homeTeam: string;
  awayTeam: string;
  isFinished: boolean;
}

export function PredictionsTab({
  predictions,
  homeTeam,
  awayTeam,
  isFinished,
}: PredictionsTabProps) {
  return (
    <div className="space-y-6">
      {/* Consolidated predictions display */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4">AI Model Predictions</h3>
          <PredictionTable
            predictions={predictions}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            isFinished={isFinished}
          />
        </CardContent>
      </Card>

      {isFinished && predictions.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Prediction Accuracy</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Exact Scores
                </span>
                <span className="text-xl font-bold">
                  {predictions.filter((p) => p.isExact).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Correct Results
                </span>
                <span className="text-xl font-bold">
                  {predictions.filter((p) => p.isCorrectResult).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Accuracy Rate
                </span>
                <span className="text-xl font-bold">
                  {predictions.length > 0
                    ? Math.round(
                        (predictions.filter((p) => p.isCorrectResult || p.isExact)
                          .length /
                          predictions.length) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
