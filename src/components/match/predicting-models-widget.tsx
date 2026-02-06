import { getDb, predictions, models } from '@/lib/db';
import { eq, desc, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';
import { HoverPrefetchLink } from '@/components/navigation/hover-prefetch-link';

interface PredictingModelsWidgetProps {
  matchId: string;
}

export async function PredictingModelsWidget({ matchId }: PredictingModelsWidgetProps) {
  const db = getDb();

  // Join predictions with models to get all models that predicted this match
  const modelPredictions = await db
    .select({
      modelId: models.id,
      displayName: models.displayName,
      provider: models.provider,
      predictedHomeScore: predictions.predictedHome,
      predictedAwayScore: predictions.predictedAway,
      points: predictions.totalPoints,
    })
    .from(predictions)
    .innerJoin(models, eq(predictions.modelId, models.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(
      desc(predictions.totalPoints), // Best performers first (nulls last by default in Postgres)
      asc(models.displayName) // Tiebreaker
    );

  // Early return if no predictions found
  if (modelPredictions.length === 0) return null;

  const hasFinishedMatch = modelPredictions.some(p => p.points !== null);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Models That Predicted This Match
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {modelPredictions.length} {modelPredictions.length === 1 ? 'model' : 'models'} made predictions
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {modelPredictions.map((model) => {
            const predictedScore = `${model.predictedHomeScore}-${model.predictedAwayScore}`;
            const hasPoints = model.points !== null;

            // Color coding for points (if match finished)
            let pointsColor = 'text-muted-foreground';
            if (hasPoints && model.points! >= 5) {
              pointsColor = 'text-green-600 dark:text-green-400';
            } else if (hasPoints && model.points! >= 3) {
              pointsColor = 'text-yellow-600 dark:text-yellow-400';
            } else if (hasPoints) {
              pointsColor = 'text-foreground';
            }

            return (
              <HoverPrefetchLink
                key={model.modelId}
                href={`/models/${model.modelId}`}
                className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
              >
                <div className="space-y-1">
                  <p className="font-medium text-sm truncate">
                    {model.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {model.provider}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-mono">
                      {predictedScore}
                    </span>
                    {hasPoints && (
                      <span className={`text-sm font-bold ${pointsColor}`}>
                        {model.points} pts
                      </span>
                    )}
                  </div>
                </div>
              </HoverPrefetchLink>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
