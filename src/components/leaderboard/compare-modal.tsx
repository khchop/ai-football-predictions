'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/components/leaderboard-table';

interface CompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: LeaderboardEntry[];
}

export function CompareModal({ open, onOpenChange, models }: CompareModalProps) {
  // Calculate accuracy for each model
  const getAccuracy = (entry: LeaderboardEntry) => {
    if (entry.totalPredictions === 0) return 0;
    const correct = entry.correctTendencies ?? entry.correctResults ?? 0;
    return Math.round((correct / entry.totalPredictions) * 100);
  };

  // Get the best value for each stat to highlight
  const getBestValue = (stat: keyof LeaderboardEntry | 'accuracy') => {
    if (models.length === 0) return null;

    const values = models.map((model) => {
      switch (stat) {
        case 'totalPoints':
          return model.totalPoints;
        case 'averagePoints':
          return model.averagePoints;
        case 'totalPredictions':
          return model.totalPredictions;
        case 'correctTendencies':
          return model.correctTendencies ?? model.correctResults ?? 0;
        case 'exactScores':
          return model.exactScores ?? 0;
        case 'accuracy':
          return getAccuracy(model);
        case 'currentStreak':
          return model.currentStreak ?? 0;
        case 'bestStreak':
          return model.bestStreak ?? 0;
        case 'worstStreak':
          return model.worstStreak ?? 0;
        default:
          return 0;
      }
    });

    // For streaks, higher is better (except worstStreak where less negative is better)
    // For accuracy and points, higher is better
    return Math.max(...values.map((v) => (typeof v === 'number' ? v : 0)));
  };

  // Check if a value is the best (for highlighting)
  const isBest = (entry: LeaderboardEntry, stat: keyof LeaderboardEntry | 'accuracy') => {
    const best = getBestValue(stat);
    const value =
      stat === 'accuracy'
        ? getAccuracy(entry)
        : stat === 'correctTendencies'
          ? entry.correctTendencies ?? entry.correctResults ?? 0
          : stat === 'exactScores'
            ? entry.exactScores ?? 0
            : stat === 'currentStreak'
              ? entry.currentStreak ?? 0
              : stat === 'bestStreak'
                ? entry.bestStreak ?? 0
                : stat === 'worstStreak'
                  ? entry.worstStreak ?? 0
                  : entry[stat as keyof LeaderboardEntry];
    return value === best && best !== 0;
  };

  // Stat display name mapping
  const statLabels: Record<string, string> = {
    totalPoints: 'Total Points',
    averagePoints: 'Avg/Match',
    totalPredictions: 'Matches',
    correctTendencies: 'Correct',
    exactScores: 'Exact',
    accuracy: 'Accuracy',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    worstStreak: 'Worst Streak',
  };

  // Format a stat value for display
  const formatStat = (entry: LeaderboardEntry, stat: string) => {
    switch (stat) {
      case 'totalPoints':
        return entry.totalPoints.toString();
      case 'averagePoints':
        return Number(entry.averagePoints).toFixed(2);
      case 'totalPredictions':
        return entry.totalPredictions.toString();
      case 'correctTendencies':
        return (entry.correctTendencies ?? entry.correctResults ?? 0).toString();
      case 'exactScores':
        return (entry.exactScores ?? 0).toString();
      case 'accuracy':
        return `${getAccuracy(entry)}%`;
      case 'currentStreak': {
        const streak = entry.currentStreak ?? 0;
        return streak > 0 ? `+${streak}` : streak.toString();
      }
      case 'bestStreak':
        return (entry.bestStreak ?? 0).toString();
      case 'worstStreak': {
        const worst = entry.worstStreak ?? 0;
        return worst.toString();
      }
      default:
        return '-';
    }
  };

  if (models.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compare Models</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-2">Select models to compare</p>
            <p className="text-sm text-muted-foreground/70">
              Use the checkboxes in the leaderboard to select up to 4 models for comparison.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col sm:max-w-4xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Compare Models</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground sticky left-0 bg-background z-10 border-b">
                    Metric
                  </th>
                  {models.map((model) => (
                    <th
                      key={model.modelId}
                      className="text-left p-3 text-sm font-medium border-b min-w-[140px]"
                    >
                      <div>
                        <p className="font-semibold truncate max-w-[150px]" title={model.displayName}>
                          {model.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{model.provider}</p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Total Points */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Total Points
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-lg font-bold text-center',
                        isBest(model, 'totalPoints') && 'text-green-400'
                      )}
                    >
                      {model.totalPoints}
                    </td>
                  ))}
                </tr>

                {/* Average Points */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Avg/Match
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-lg font-bold text-center',
                        isBest(model, 'averagePoints') && 'text-green-400'
                      )}
                    >
                      {Number(model.averagePoints).toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* Matches Predicted */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Matches
                  </td>
                  {models.map((model) => (
                    <td key={model.modelId} className="p-3 text-center">
                      <span className="font-semibold">{model.totalPredictions}</span>
                    </td>
                  ))}
                </tr>

                {/* Correct Tendencies */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Correct
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-center',
                        isBest(model, 'correctTendencies') && 'text-green-400'
                      )}
                    >
                      <span className="font-semibold">
                        {model.correctTendencies ?? model.correctResults ?? 0}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Exact Scores */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Exact
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-center',
                        isBest(model, 'exactScores') && 'text-green-400'
                      )}
                    >
                      <span className="font-semibold">{model.exactScores ?? 0}</span>
                    </td>
                  ))}
                </tr>

                {/* Accuracy */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Accuracy
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-center',
                        isBest(model, 'accuracy') && 'text-green-400'
                      )}
                    >
                      <span className="font-semibold">{getAccuracy(model)}%</span>
                    </td>
                  ))}
                </tr>

                {/* Current Streak */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Current Streak
                  </td>
                  {models.map((model) => {
                    const streak = model.currentStreak ?? 0;
                    return (
                      <td
                        key={model.modelId}
                        className={cn(
                          'p-3 text-center',
                          isBest(model, 'currentStreak') && streak > 0 && 'text-green-400'
                        )}
                      >
                        <span className={cn(streak > 0 ? 'text-green-400' : streak < 0 ? 'text-red-400' : '')}>
                          {streak > 0 ? `+${streak}` : streak.toString()}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Best Streak */}
                <tr className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Best Streak
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-center',
                        isBest(model, 'bestStreak') && 'text-green-400'
                      )}
                    >
                      <span className="font-semibold">+{model.bestStreak ?? 0}</span>
                    </td>
                  ))}
                </tr>

                {/* Worst Streak */}
                <tr>
                  <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10">
                    Worst Streak
                  </td>
                  {models.map((model) => (
                    <td
                      key={model.modelId}
                      className={cn(
                        'p-3 text-center',
                        isBest(model, 'worstStreak') && 'text-green-400'
                      )}
                    >
                      <span className="font-semibold text-red-400">{model.worstStreak ?? 0}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-shrink-0 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Best value in each row is highlighted in green. Streaks show correct (+) or wrong (−) predictions in a row.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
