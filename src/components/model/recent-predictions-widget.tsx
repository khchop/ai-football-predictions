import { getDb } from '@/lib/db';
import { predictions, matches, competitions } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { HoverPrefetchLink } from '@/components/navigation/hover-prefetch-link';
import { eq, desc } from 'drizzle-orm';
import { cn } from '@/lib/utils';

interface RecentPredictionsWidgetProps {
  modelId: string;
}

export async function RecentPredictionsWidget({ modelId }: RecentPredictionsWidgetProps) {
  const db = getDb();

  // Query recent predictions with match and competition details
  const recentPredictions = await db
    .select({
      matchId: matches.id,
      matchSlug: matches.slug,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
      kickoffTime: matches.kickoffTime,
      competitionId: competitions.id,
      competitionName: competitions.name,
      predictedHomeScore: predictions.predictedHome,
      predictedAwayScore: predictions.predictedAway,
      points: predictions.totalPoints,
      predictionStatus: predictions.status,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(predictions.modelId, modelId))
    .orderBy(desc(matches.kickoffTime))
    .limit(10);

  if (recentPredictions.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Recent Predictions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentPredictions.map((prediction) => {
            const isFinished = prediction.status === 'finished';
            const isScored = prediction.predictionStatus === 'scored';

            return (
              <HoverPrefetchLink
                key={prediction.matchId}
                href={`/leagues/${prediction.competitionId}/${prediction.matchSlug}`}
                className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
              >
                <div className="space-y-2">
                  {/* Match teams */}
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">
                      {prediction.homeTeam} vs {prediction.awayTeam}
                    </p>
                  </div>

                  {/* Prediction and result */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        Predicted: <span className="font-mono font-semibold text-foreground">
                          {prediction.predictedHomeScore}-{prediction.predictedAwayScore}
                        </span>
                      </span>
                      {isFinished && prediction.homeScore !== null && prediction.awayScore !== null && (
                        <span className="text-muted-foreground">
                          Actual: <span className="font-mono font-semibold text-foreground">
                            {prediction.homeScore}-{prediction.awayScore}
                          </span>
                        </span>
                      )}
                    </div>
                    {isScored && prediction.points !== null && (
                      <span className={cn(
                        "font-bold px-2 py-0.5 rounded",
                        prediction.points >= 4 ? "bg-green-500/20 text-green-400" :
                        prediction.points > 0 ? "bg-blue-500/20 text-blue-400" :
                        "bg-muted/50 text-muted-foreground"
                      )}>
                        {prediction.points} pts
                      </span>
                    )}
                  </div>

                  {/* Competition badge */}
                  <div>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                      {prediction.competitionName}
                    </span>
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
