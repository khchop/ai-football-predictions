import Link from 'next/link';
import { getTopModelsForWidget } from '@/lib/db/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

interface RelatedModelsWidgetProps {
  currentModelId: string;
}

export async function RelatedModelsWidget({ currentModelId }: RelatedModelsWidgetProps) {
  const topModels = await getTopModelsForWidget(currentModelId, 5);

  if (topModels.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Performing Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topModels.map((model, index) => (
            <Link
              key={model.id}
              href={`/models/${model.id}`}
              className="block p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-6 text-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {model.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {model.scoredPredictions} predictions
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold">{model.totalPoints} pts</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
