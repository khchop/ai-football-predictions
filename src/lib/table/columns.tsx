import React from 'react';
import { createColumnHelper, flexRender } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Award, Flame, Snowflake, Minus } from 'lucide-react';

export interface LeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  totalPoints: number;
  averagePoints: number;
  // Quota-based scoring breakdown
  pointsTendency?: number;
  pointsGoalDiff?: number;
  pointsExactScore?: number;
  // Category counts
  correctTendencies?: number;
  correctGoalDiffs?: number;
  exactScores?: number;
  // Legacy fields (for backward compat)
  correctResults?: number;
  exactScorePercent?: number;
  correctResultPercent?: number;
  // Streak data
  currentStreak?: number;
  currentStreakType?: string;
  bestStreak?: number;
  worstStreak?: number;
}

type RenderRankIcon = (index: number) => React.ReactNode;
type RenderStreak = (entry: LeaderboardEntry) => React.ReactNode;
type RenderModelLink = (entry: LeaderboardEntry) => React.ReactNode;

const columnHelper = createColumnHelper<LeaderboardEntry>();

export function createLeaderboardColumns(options: {
  renderRankIcon: RenderRankIcon;
  renderStreak: RenderStreak;
  renderModelLink: RenderModelLink;
}) {
  const { renderRankIcon, renderStreak, renderModelLink } = options;

  return [
    // 1. Rank (display column, not sortable)
    columnHelper.display({
      id: 'rank',
      header: 'Rank',
      cell: ({ row }) => {
        const index = row.index;
        return (
          <div className="flex items-center justify-center w-8 h-8">
            {renderRankIcon(index)}
          </div>
        );
      },
      size: 60,
    }),

    // 2. Model (accessor: displayName, sortable)
    columnHelper.accessor('displayName', {
      header: 'Model',
      cell: ({ row }) => renderModelLink(row.original),
      size: 180,
    }),

    // 3. Matches (accessor: totalPredictions, sortable)
    columnHelper.accessor('totalPredictions', {
      header: 'Matches',
      meta: { align: 'center' as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue()}</span>
      ),
      size: 80,
    }),

    // 4. Correct (accessor: correctTendencies, sortable)
    columnHelper.accessor((row) => row.correctTendencies ?? row.correctResults ?? 0, {
      id: 'correctTendencies',
      header: 'Correct',
      meta: { align: 'center' as const, tooltip: 'Correct Tendency (H/D/A)' },
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <span className={cn(
            "font-semibold",
            value > 0 ? "text-yellow-400" : "text-muted-foreground"
          )}>
            {value}
          </span>
        );
      },
      size: 80,
    }),

    // 5. Exact (accessor: exactScores, sortable)
    columnHelper.accessor('exactScores', {
      header: 'Exact',
      meta: { align: 'center' as const },
      cell: ({ getValue }) => {
        const value = getValue() ?? 0;
        return (
          <span className={cn(
            "font-semibold",
            value > 0 ? "text-green-400" : "text-muted-foreground"
          )}>
            {value}
          </span>
        );
      },
      size: 80,
    }),

    // 6. Points (accessor: totalPoints, sortable)
    columnHelper.accessor('totalPoints', {
      header: 'Points',
      meta: { align: 'center' as const },
      cell: ({ getValue }) => (
        <span className="font-bold text-lg">{getValue()}</span>
      ),
      size: 90,
    }),

    // 7. Avg/Match (accessor: averagePoints, sortable, default sort desc)
    columnHelper.accessor('averagePoints', {
      header: 'Avg/Match',
      meta: { align: 'center' as const, tooltip: 'Average Points per Match' },
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <span className={cn(
            "px-2 py-1 rounded-md font-mono text-sm font-medium",
            value >= 4 && "bg-green-500/20 text-green-400",
            value >= 2 && value < 4 && "bg-yellow-500/20 text-yellow-400",
            value < 2 && "bg-muted text-muted-foreground"
          )}>
            {Number(value).toFixed(2)}
          </span>
        );
      },
      size: 100,
    }),

    // 8. Accuracy (computed, sortable)
    columnHelper.accessor((row) => {
      if (row.totalPredictions === 0) return 0;
      const correct = row.correctTendencies ?? row.correctResults ?? 0;
      return Math.round((correct / row.totalPredictions) * 100);
    }, {
      id: 'accuracy',
      header: 'Accuracy',
      meta: { align: 'center' as const, tooltip: 'Correct Tendency Rate' },
      cell: ({ getValue }) => {
        const accuracy = getValue();
        return (
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
        );
      },
      size: 120,
    }),

    // 9. Streak (display column)
    columnHelper.display({
      id: 'streak',
      header: 'Streak',
      meta: { tooltip: 'Current Prediction Streak' },
      cell: ({ row }) => renderStreak(row.original),
      size: 80,
    }),
  ];
}

// Default columns with inline renderers (for backward compatibility)
export const leaderboardColumns = createLeaderboardColumns({
  renderRankIcon: (index: number) => {
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
  },
  renderStreak: (entry: LeaderboardEntry) => {
    const streak = entry.currentStreak || 0;

    if (streak >= 3) {
      // Hot streak: 3+ correct in a row
      return (
        <div className="flex items-center gap-1" title={`${streak} correct in a row`}>
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-500">+{streak}</span>
        </div>
      );
    } else if (streak <= -3) {
      // Cold streak: 3+ wrong in a row
      return (
        <div className="flex items-center gap-1" title={`${Math.abs(streak)} wrong in a row`}>
          <Snowflake className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-bold text-blue-400">{streak}</span>
        </div>
      );
    } else if (streak > 0) {
      // Small winning streak
      return (
        <span className="text-xs font-medium text-green-500" title={`${streak} correct in a row`}>
          +{streak}
        </span>
      );
    } else if (streak < 0) {
      // Small losing streak
      return (
        <span className="text-xs font-medium text-red-400" title={`${Math.abs(streak)} wrong in a row`}>
          {streak}
        </span>
      );
    } else {
      // Neutral
      return (
        <Minus className="h-3 w-3 text-muted-foreground" />
      );
    }
  },
  renderModelLink: (entry: LeaderboardEntry) => (
    <div>
      <p className="font-medium">{entry.displayName}</p>
      <p className="text-xs text-muted-foreground capitalize">{entry.provider}</p>
    </div>
  ),
});
