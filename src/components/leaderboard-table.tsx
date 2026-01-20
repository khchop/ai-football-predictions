'use client';

import { cn } from '@/lib/utils';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  exactScores: number;
  correctResults: number;
  totalPoints: number;
  exactScorePercent?: number;
  correctResultPercent?: number;
  averagePoints: number;
  // Enhanced scoring breakdown
  pointsExactScore?: number;
  pointsResult?: number;
  pointsGoalDiff?: number;
  pointsOverUnder?: number;
  pointsBtts?: number;
  pointsUpsetBonus?: number;
  correctGoalDiffs?: number;
  correctOverUnders?: number;
  correctBtts?: number;
  upsetsCalled?: number;
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

  // Check if we have enhanced scoring data
  const hasEnhancedData = entries.some(e => e.pointsExactScore !== undefined);

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rank
            </th>
            <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model
            </th>
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Predictions
            </th>
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Exact
            </th>
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Correct
            </th>
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Points
            </th>
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Avg
            </th>
            {hasEnhancedData && showBreakdown && (
              <>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Exact Score (5 pts)">
                  ES
                </th>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Correct Result (2 pts)">
                  CR
                </th>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Goal Difference (1 pt)">
                  GD
                </th>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Over/Under 2.5 (1 pt)">
                  O/U
                </th>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Both Teams Score (1 pt)">
                  BTS
                </th>
                <th className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider" title="Upset Bonus (2 pts)">
                  UPS
                </th>
              </>
            )}
            <th className="text-center py-4 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Accuracy
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr 
              key={entry.modelId}
              className={cn(
                "border-b border-border/30 transition-colors hover:bg-muted/30",
                index === 0 && "bg-yellow-500/5",
                index === 1 && "bg-gray-500/5",
                index === 2 && "bg-orange-500/5"
              )}
            >
              <td className="py-4 px-6">
                <div className="flex items-center justify-center w-8 h-8">
                  {getRankIcon(index)}
                </div>
              </td>
              <td className="py-4 px-6">
                <div>
                  <p className="font-medium">{entry.displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{entry.provider}</p>
                </div>
              </td>
              <td className="py-4 px-6 text-center font-mono">
                {entry.totalPredictions}
              </td>
              <td className="py-4 px-6 text-center">
                <div className="flex flex-col items-center">
                  <span className="font-semibold text-green-400">{entry.exactScores}</span>
                  <span className="text-xs text-muted-foreground">{entry.exactScorePercent}%</span>
                </div>
              </td>
              <td className="py-4 px-6 text-center">
                <div className="flex flex-col items-center">
                  <span className="font-semibold text-yellow-400">{entry.correctResults}</span>
                </div>
              </td>
              <td className="py-4 px-6 text-center">
                <span className="font-bold text-lg">{entry.totalPoints}</span>
              </td>
              <td className="py-4 px-6 text-center">
                <span className={cn(
                  "px-2 py-1 rounded-md font-mono text-sm font-medium",
                  entry.averagePoints >= 4 && "bg-green-500/20 text-green-400",
                  entry.averagePoints >= 2 && entry.averagePoints < 4 && "bg-yellow-500/20 text-yellow-400",
                  entry.averagePoints < 2 && "bg-muted text-muted-foreground"
                )}>
                  {entry.averagePoints.toFixed(2)}
                </span>
              </td>
              {hasEnhancedData && showBreakdown && (
                <>
                  <td className="py-4 px-3 text-center text-xs font-mono text-green-400">
                    {entry.exactScores || 0}
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-mono text-yellow-400">
                    {entry.correctResults || 0}
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-mono text-muted-foreground">
                    {entry.correctGoalDiffs || 0}
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-mono text-muted-foreground">
                    {entry.correctOverUnders || 0}
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-mono text-muted-foreground">
                    {entry.correctBtts || 0}
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-mono text-orange-400">
                    {entry.upsetsCalled || 0}
                  </td>
                </>
              )}
              <td className="py-4 px-6">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                      style={{ width: `${Math.min((entry.correctResultPercent || 0) + (entry.exactScorePercent || 0), 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-12 text-right">
                    {((entry.correctResultPercent || 0) + (entry.exactScorePercent || 0)).toFixed(0)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
