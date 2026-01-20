'use client';

import { cn } from '@/lib/utils';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  averagePoints: number;
  // Quota-based scoring breakdown
  pointsTendency?: number;     // Sum of tendency quota points (2-6 per correct)
  pointsGoalDiff?: number;     // Sum of goal diff bonuses (+1 each)
  pointsExactScore?: number;   // Sum of exact score bonuses (+3 each)
  // Category counts
  correctTendencies?: number;  // How many correct H/D/A predictions
  correctGoalDiffs?: number;   // How many correct goal differences
  exactScores?: number;        // How many exact score matches
  // Legacy fields (for backward compat)
  correctResults?: number;
  exactScorePercent?: number;
  correctResultPercent?: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showBreakdown?: boolean;
}

export function LeaderboardTable({ entries, showBreakdown = false }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No predictions have been scored yet.
      </div>
    );
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-400" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-orange-400" />;
      default:
        return <span className="text-muted-foreground font-mono">{index + 1}</span>;
    }
  };

  // Calculate accuracy percentage (correct tendencies / total predictions)
  const getAccuracy = (entry: LeaderboardEntry) => {
    if (entry.totalPredictions === 0) return 0;
    const correct = entry.correctTendencies ?? entry.correctResults ?? 0;
    return Math.round((correct / entry.totalPredictions) * 100);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rank
            </th>
            <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model
            </th>
            <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Matches
            </th>
            <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Correct Tendency (H/D/A)">
              Correct
            </th>
            <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Exact Score Predictions">
              Exact
            </th>
            <th className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Points
            </th>
            <th className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Average Points per Match">
              Avg
            </th>
            <th className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Correct Tendency Rate">
              Accuracy
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const accuracy = getAccuracy(entry);
            const correctCount = entry.correctTendencies ?? entry.correctResults ?? 0;
            const exactCount = entry.exactScores ?? 0;
            
            return (
              <tr 
                key={entry.modelId}
                className={cn(
                  "border-b border-border/30 transition-colors hover:bg-muted/30",
                  index === 0 && "bg-yellow-500/5",
                  index === 1 && "bg-gray-500/5",
                  index === 2 && "bg-orange-500/5"
                )}
              >
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center w-8 h-8">
                    {getRankIcon(index)}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium">{entry.displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{entry.provider}</p>
                  </div>
                </td>
                <td className="py-4 px-3 text-center font-mono text-sm">
                  {entry.totalPredictions}
                </td>
                <td className="py-4 px-3 text-center">
                  <span className={cn(
                    "font-semibold",
                    correctCount > 0 ? "text-yellow-400" : "text-muted-foreground"
                  )}>
                    {correctCount}
                  </span>
                </td>
                <td className="py-4 px-3 text-center">
                  <span className={cn(
                    "font-semibold",
                    exactCount > 0 ? "text-green-400" : "text-muted-foreground"
                  )}>
                    {exactCount}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="font-bold text-lg">{entry.totalPoints}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={cn(
                    "px-2 py-1 rounded-md font-mono text-sm font-medium",
                    entry.averagePoints >= 4 && "bg-green-500/20 text-green-400",
                    entry.averagePoints >= 2 && entry.averagePoints < 4 && "bg-yellow-500/20 text-yellow-400",
                    entry.averagePoints < 2 && "bg-muted text-muted-foreground"
                  )}>
                    {entry.averagePoints.toFixed(2)}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[50px]">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          accuracy >= 50 ? "bg-gradient-to-r from-green-500 to-green-400" :
                          accuracy >= 30 ? "bg-gradient-to-r from-yellow-500 to-yellow-400" :
                          "bg-gradient-to-r from-red-500 to-red-400"
                        )}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-10 text-right">
                      {accuracy}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
