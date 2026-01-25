'use client';

interface PredictionWithScore {
  modelDisplayName: string;
  predictedHome: number;
  predictedAway: number;
}

interface PredictionInsightsBlockquoteProps {
  predictions: PredictionWithScore[];
  homeAvg: number;
  awayAvg: number;
}

/**
 * PredictionInsightsBlockquote
 * Displays AI analysis insights as a citable blockquote
 * Used on match prediction pages for GEO (Generative Engine Optimization)
 */
export function PredictionInsightsBlockquote({
  predictions,
  homeAvg,
  awayAvg,
}: PredictionInsightsBlockquoteProps) {
  // Calculate most common outcome
  const homeWins = predictions.filter(p => (p.predictedHome ?? 0) > (p.predictedAway ?? 0)).length;
  const draws = predictions.filter(p => (p.predictedHome ?? 0) === (p.predictedAway ?? 0)).length;
  const awayWins = predictions.filter(p => (p.predictedAway ?? 0) > (p.predictedHome ?? 0)).length;
  
  const homeWinPct = Math.round((homeWins / predictions.length) * 100);
  const drawPct = Math.round((draws / predictions.length) * 100);
  const awayWinPct = Math.round((awayWins / predictions.length) * 100);
  
  let mostCommon = 'home win';
  if (drawPct > homeWinPct && drawPct > awayWinPct) {
    mostCommon = 'draw';
  } else if (awayWinPct > homeWinPct && awayWinPct > drawPct) {
    mostCommon = 'away win';
  }

  // Get top 3 models by prediction count (proxy for reliability)
  const topModels = predictions
    .slice(0, 3)
    .map(p => p.modelDisplayName)
    .join(', ');

  return (
    <div className="space-y-3 border-t border-border/50 pt-4">
      <blockquote className="border-l-4 border-primary pl-4 italic text-sm space-y-2 text-muted-foreground">
        <p>
          This match has an average predicted score of <span className="font-semibold">{homeAvg.toFixed(1)}-{awayAvg.toFixed(1)}</span> according to {predictions.length} AI models.
        </p>
        <p>
          AI models are most confident in a <span className="font-semibold">{mostCommon}</span> result, with {homeWinPct}% predicting a home win, {drawPct}% predicting a draw, and {awayWinPct}% predicting an away win.
        </p>
        {topModels && (
          <p>
            Top contributing models: <span className="font-semibold">{topModels}</span>.
          </p>
        )}
      </blockquote>
      <p className="text-xs text-muted-foreground/60">
        These insights are AI-generated from {predictions.length} model predictions and are provided for informational purposes. Predictions vary based on each model&apos;s training data and methodology.
      </p>
    </div>
  );
}
