'use client';

import { cn } from '@/lib/utils';
import { Bot, Trophy, Target, X } from 'lucide-react';

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
  // Enhanced scoring breakdown
  pointsExactScore?: number;
  pointsResult?: number;
  pointsGoalDiff?: number;
  pointsOverUnder?: number;
  pointsBtts?: number;
  pointsUpsetBonus?: number;
  pointsTotal?: number;
}

interface PredictionTableProps {
  predictions: Prediction[];
  homeTeam: string;
  awayTeam: string;
  isFinished: boolean;
}

export function PredictionTable({
  predictions,
  homeTeam,
  awayTeam,
  isFinished,
}: PredictionTableProps) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-12 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No predictions yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          AI predictions are generated when lineups are confirmed (~1 hour before kickoff)
        </p>
      </div>
    );
  }

  // Sort predictions: if finished, sort by points desc; otherwise by model name
  const sortedPredictions = [...predictions].sort((a, b) => {
    if (isFinished && a.points !== null && b.points !== null) {
      return (b.points || 0) - (a.points || 0);
    }
    return a.modelDisplayName.localeCompare(b.modelDisplayName);
  });

  return (
    <div className="space-y-3">
      {sortedPredictions.map((prediction, index) => (
        <div 
          key={prediction.id}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-colors",
            prediction.isExact && "bg-green-500/10 border-green-500/30",
            prediction.isCorrectResult && !prediction.isExact && "bg-yellow-500/10 border-yellow-500/30",
            !prediction.isExact && !prediction.isCorrectResult && isFinished && prediction.points === 0 && "bg-muted/30 border-border/50",
            !isFinished && "bg-card/50 border-border/50 hover:bg-card/80"
          )}
        >
          {/* Rank/Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
            {isFinished ? (
              prediction.isExact ? (
                <Trophy className="h-5 w-5 text-green-400" />
              ) : prediction.isCorrectResult ? (
                <Target className="h-5 w-5 text-yellow-400" />
              ) : (
                <X className="h-5 w-5 text-muted-foreground" />
              )
            ) : (
              <span className="text-sm font-mono text-muted-foreground">{index + 1}</span>
            )}
          </div>

          {/* Model Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{prediction.modelDisplayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{prediction.provider}</p>
          </div>

          {/* Prediction */}
          <div className="flex items-center gap-2 text-center">
            <div className="min-w-[80px]">
              <p className="text-xs text-muted-foreground mb-1 truncate">{homeTeam}</p>
              <p className="text-2xl font-bold font-mono">{prediction.predictedHomeScore}</p>
            </div>
            <span className="text-muted-foreground">-</span>
            <div className="min-w-[80px]">
              <p className="text-xs text-muted-foreground mb-1 truncate">{awayTeam}</p>
              <p className="text-2xl font-bold font-mono">{prediction.predictedAwayScore}</p>
            </div>
          </div>

          {/* Points Badge */}
          {isFinished && (prediction.pointsTotal !== undefined || prediction.points !== null) && (
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <div className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold min-w-[70px] text-center",
                (prediction.pointsTotal || prediction.points || 0) >= 5 && "bg-green-500/20 text-green-400",
                (prediction.pointsTotal || prediction.points || 0) >= 2 && (prediction.pointsTotal || prediction.points || 0) < 5 && "bg-yellow-500/20 text-yellow-400",
                (prediction.pointsTotal || prediction.points || 0) < 2 && "bg-muted text-muted-foreground"
              )}>
                {prediction.pointsTotal ?? prediction.points ?? 0} pts
              </div>
              {/* Points breakdown tooltip/details for enhanced scoring */}
              {prediction.pointsTotal !== undefined && (prediction.pointsTotal || 0) > 0 && (
                <div className="flex gap-1 text-[10px]">
                  {(prediction.pointsExactScore || 0) > 0 && (
                    <span className="text-green-400" title="Exact Score">ES</span>
                  )}
                  {(prediction.pointsResult || 0) > 0 && (
                    <span className="text-yellow-400" title="Correct Result">CR</span>
                  )}
                  {(prediction.pointsGoalDiff || 0) > 0 && (
                    <span className="text-blue-400" title="Goal Diff">GD</span>
                  )}
                  {(prediction.pointsOverUnder || 0) > 0 && (
                    <span className="text-purple-400" title="Over/Under">O/U</span>
                  )}
                  {(prediction.pointsBtts || 0) > 0 && (
                    <span className="text-cyan-400" title="Both Teams Score">BTS</span>
                  )}
                  {(prediction.pointsUpsetBonus || 0) > 0 && (
                    <span className="text-orange-400" title="Upset Bonus">UPS</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
