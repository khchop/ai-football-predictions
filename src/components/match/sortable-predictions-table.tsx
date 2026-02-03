'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bot, Trophy, Target, X, ChevronUp, ChevronDown } from 'lucide-react';

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

interface SortablePredictionsTableProps {
  predictions: Prediction[];
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  isFinished: boolean;
}

type SortColumn = 'model' | 'prediction' | 'points';
type SortDirection = 'asc' | 'desc';

export function SortablePredictionsTable({
  predictions,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  isFinished,
}: SortablePredictionsTableProps) {
  // Default sort: by points (desc) for finished matches, alphabetical for upcoming
  const [sortColumn, setSortColumn] = useState<SortColumn>(isFinished ? 'points' : 'model');
  const [sortDirection, setSortDirection] = useState<SortDirection>(isFinished ? 'desc' : 'asc');

  // Memoize sorted array - NEVER mutate original
  const sortedPredictions = useMemo(() => {
    return [...predictions].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'model':
          comparison = a.modelDisplayName.localeCompare(b.modelDisplayName);
          break;
        case 'prediction':
          // Sort by home score, then away score
          comparison = a.predictedHomeScore - b.predictedHomeScore ||
                       a.predictedAwayScore - b.predictedAwayScore;
          break;
        case 'points':
          comparison = (a.points ?? -1) - (b.points ?? -1);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [predictions, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // Points default to desc, model/prediction to asc
      setSortDirection(column === 'points' ? 'desc' : 'asc');
    }
  };

  // Sortable header component
  const SortHeader = ({ column, label, className }: { column: SortColumn; label: string; className?: string }) => (
    <button
      onClick={() => handleSort(column)}
      className={cn(
        "flex items-center gap-1 font-medium hover:text-primary transition-colors",
        className
      )}
    >
      {label}
      {sortColumn === column && (
        sortDirection === 'desc'
          ? <ChevronDown className="h-4 w-4" />
          : <ChevronUp className="h-4 w-4" />
      )}
    </button>
  );

  // Color-coded points badge based on user decisions from CONTEXT.md
  // 4+ pts: green, 3 pts: yellow, 2 pts: orange, 0 pts: gray
  const PointsBadge = ({ points }: { points: number | null }) => {
    const pts = points ?? 0;
    return (
      <span className={cn(
        "px-2 py-1 rounded text-xs font-semibold",
        pts >= 4 && "bg-green-500/20 text-green-400",
        pts === 3 && "bg-yellow-500/20 text-yellow-400",
        pts === 2 && "bg-orange-500/20 text-orange-400",
        pts < 2 && "bg-muted text-muted-foreground"
      )}>
        {pts} pts
      </span>
    );
  };

  // Empty state
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-12 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No predictions yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          AI predictions are generated ~30 minutes before kickoff
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {/* Result header row for finished matches */}
          {isFinished && homeScore !== null && homeScore !== undefined &&
           awayScore !== null && awayScore !== undefined && (
            <tr className="border-b border-border/50 bg-muted/30">
              <td colSpan={4} className="p-3 text-center font-bold">
                Actual Result: {homeTeam} {homeScore} - {awayScore} {awayTeam}
              </td>
            </tr>
          )}
          <tr className="border-b border-border/50">
            <th className="p-3 text-left">
              <SortHeader column="model" label="Model" />
            </th>
            <th className="p-3 text-center">
              <SortHeader column="prediction" label="Prediction" className="justify-center" />
            </th>
            {isFinished && (
              <th className="p-3 text-center">
                <SortHeader column="points" label="Points" className="justify-center" />
              </th>
            )}
            {isFinished && (
              <th className="p-3 text-center">Result</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedPredictions.map((prediction) => (
            <tr
              key={prediction.id}
              className={cn(
                "border-b border-border/30 transition-colors",
                prediction.isExact && "bg-green-500/10",
                prediction.isCorrectResult && !prediction.isExact && "bg-yellow-500/5"
              )}
            >
              <td className="p-3">
                <div className="font-medium">{prediction.modelDisplayName}</div>
                <div className="text-xs text-muted-foreground capitalize">{prediction.provider}</div>
              </td>
              <td className="p-3 text-center font-mono">
                {prediction.predictedHomeScore} - {prediction.predictedAwayScore}
              </td>
              {isFinished && (
                <td className="p-3 text-center">
                  <PointsBadge points={prediction.points} />
                </td>
              )}
              {isFinished && (
                <td className="p-3 text-center">
                  {prediction.isExact ? (
                    <Trophy className="h-5 w-5 text-green-400 mx-auto" aria-label="Exact score" />
                  ) : prediction.isCorrectResult ? (
                    <Target className="h-5 w-5 text-yellow-400 mx-auto" aria-label="Correct result" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground mx-auto" aria-label="Incorrect" />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
