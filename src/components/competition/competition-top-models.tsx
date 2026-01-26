import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Star, Zap } from 'lucide-react';
import Link from 'next/link';

interface TopModelEntry {
  model: {
    id: string;
    displayName: string;
    provider: string;
  };
  totalPoints: number;
  totalPredictions: number;
  exactScores: number;
  correctTendencies: number;
  avgPoints: number;
  accuracy: number;
}

interface CompetitionTopModelsProps {
  models: TopModelEntry[];
  competitionId: string;
}

function ModelCard({ model, index }: { model: TopModelEntry; index: number }) {
  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalColor = index < 3 ? medalColors[index] : undefined;
  
  return (
    <Link href={`/models/${model.model.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
        <div 
          className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm"
          style={{ 
            backgroundColor: medalColor ? `${medalColor}20` : 'var(--muted)',
            color: medalColor || 'var(--muted-foreground)'
          }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{model.model.displayName}</p>
          <p className="text-xs text-muted-foreground capitalize">{model.model.provider}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">{model.avgPoints}</p>
          <p className="text-xs text-muted-foreground">avg pts</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm">{model.totalPredictions}</p>
          <p className="text-xs text-muted-foreground">predictions</p>
        </div>
      </div>
    </Link>
  );
}

export async function CompetitionTopModels({ models, competitionId }: CompetitionTopModelsProps) {
  if (!models || models.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Top Performing Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No prediction data available for this competition yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Top Performing Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {models.map((entry, index) => (
            <ModelCard key={entry.model.id} model={entry} index={index} />
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border/50">
          <Link 
            href={`/leaderboard?competition=${competitionId}`}
            className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
          >
            <Star className="h-4 w-4" />
            View Full Leaderboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
