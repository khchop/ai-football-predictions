'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown, Trophy, Medal, Award, Flame, Snowflake, Minus } from 'lucide-react';

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

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showBreakdown?: boolean;
}

export function LeaderboardTable({ entries, showBreakdown: _showBreakdown = false }: LeaderboardTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get sort state from URL or use defaults
  const sortParam = searchParams.get('sort') as string | null;
  const orderParam = searchParams.get('order') as string | null;

  // Initial sorting state from URL
  const initialSorting: SortingState = [];
  if (sortParam) {
    initialSorting.push({
      id: sortParam,
      desc: orderParam !== 'asc',
    });
  } else {
    // Default sort by averagePoints descending
    initialSorting.push({ id: 'averagePoints', desc: true });
  }

  const [sorting, setSorting] = useState<SortingState>(initialSorting);

  // Calculate accuracy percentage (correct tendencies / total predictions)
  const getAccuracy = (entry: LeaderboardEntry) => {
    if (entry.totalPredictions === 0) return 0;
    const correct = entry.correctTendencies ?? entry.correctResults ?? 0;
    return Math.round((correct / entry.totalPredictions) * 100);
  };

  // Update URL when sort changes
  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updater === 'function' ? updater(sorting) : updater;

    if (newSorting.length > 0) {
      const sort = newSorting[0];
      const column = sort.id;
      const order = sort.desc ? 'desc' : 'asc';

      setSorting(newSorting);

      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', column);
      params.set('order', order);
      router.push(`/leaderboard?${params.toString()}`, { scroll: false });
    } else {
      setSorting(newSorting);
    }
  };

  // Helper function to get rank icon
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

  // Helper function to get streak indicator
  const getStreakIndicator = (entry: LeaderboardEntry) => {
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
  };

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<LeaderboardEntry>[]>(() => [
    // 1. Rank (display column, not sortable)
    {
      id: 'rank',
      header: 'Rank',
      cell: ({ row }) => {
        const index = row.index;
        return (
          <div className="flex items-center justify-center w-8 h-8">
            {getRankIcon(index)}
          </div>
        );
      },
      size: 60,
      enableSorting: false,
    },
    // 2. Model (accessor: displayName, sortable)
    {
      accessorKey: 'displayName',
      header: 'Model',
      cell: ({ row }) => (
        <Link href={`/models/${row.original.modelId}`} className="block group">
          <p className="font-medium group-hover:text-primary transition-colors">{row.original.displayName}</p>
          <p className="text-xs text-muted-foreground capitalize">{row.original.provider}</p>
        </Link>
      ),
      size: 180,
    },
    // 3. Matches (accessor: totalPredictions, sortable)
    {
      accessorKey: 'totalPredictions',
      header: 'Matches',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as number}</span>
      ),
      meta: { align: 'center' as const },
      size: 80,
    },
    // 4. Correct (accessor: correctTendencies, sortable)
    {
      id: 'correctTendencies',
      accessorFn: (row) => row.correctTendencies ?? row.correctResults ?? 0,
      header: 'Correct',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <span className={cn(
            "font-semibold",
            value > 0 ? "text-yellow-400" : "text-muted-foreground"
          )}>
            {value}
          </span>
        );
      },
      meta: { align: 'center' as const },
      size: 80,
    },
    // 5. Exact (accessor: exactScores, sortable)
    {
      accessorKey: 'exactScores',
      header: 'Exact',
      cell: ({ getValue }) => {
        const value = (getValue() as number | null | undefined) ?? 0;
        return (
          <span className={cn(
            "font-semibold",
            value > 0 ? "text-green-400" : "text-muted-foreground"
          )}>
            {value}
          </span>
        );
      },
      meta: { align: 'center' as const },
      size: 80,
    },
    // 6. Points (accessor: totalPoints, sortable)
    {
      accessorKey: 'totalPoints',
      header: 'Points',
      cell: ({ getValue }) => (
        <span className="font-bold text-lg">{getValue() as number}</span>
      ),
      meta: { align: 'center' as const },
      size: 90,
    },
    // 7. Avg/Match (accessor: averagePoints, sortable, default sort desc)
    {
      accessorKey: 'averagePoints',
      header: 'Avg/Match',
      cell: ({ getValue }) => {
        const value = getValue() as number;
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
      meta: { align: 'center' as const },
      size: 100,
    },
    // 8. Accuracy (computed, sortable)
    {
      id: 'accuracy',
      accessorFn: (row) => getAccuracy(row),
      header: 'Accuracy',
      cell: ({ getValue }) => {
        const accuracy = getValue() as number;
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
      meta: { align: 'center' as const },
      size: 120,
    },
    // 9. Streak (display column)
    {
      id: 'streak',
      header: 'Streak',
      cell: ({ row }) => getStreakIndicator(row.original),
      enableSorting: false,
      size: 80,
    },
  ], []);

  // Initialize TanStack Table
  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
    },
    onSortingChange: onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: initialSorting,
    },
  });

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No predictions have been scored yet.
      </div>
    );
  }

  // Mobile Card View
  const MobileCard = ({ entry, index }: { entry: LeaderboardEntry; index: number }) => {
    const accuracy = getAccuracy(entry);
    const correctCount = entry.correctTendencies ?? entry.correctResults ?? 0;
    const exactCount = entry.exactScores ?? 0;

    return (
      <Link
        href={`/models/${entry.modelId}`}
        className={cn(
          "block rounded-lg border border-border/50 p-4 space-y-3 transition-colors",
          index === 0 && "bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10",
          index === 1 && "bg-gray-500/5 border-gray-400/30 hover:bg-gray-500/10",
          index === 2 && "bg-orange-500/5 border-orange-500/30 hover:bg-orange-500/10",
          index > 2 && "hover:bg-muted/30"
        )}
      >
        {/* Header: Rank + Model Name + Streak */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8">
            {getRankIcon(index)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{entry.displayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{entry.provider}</p>
          </div>
          <div className="flex items-center">
            {getStreakIndicator(entry)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold">{entry.totalPredictions}</p>
            <p className="text-xs text-muted-foreground">Matches</p>
          </div>
          <div>
            <p className="text-lg font-bold text-primary">{entry.totalPoints}</p>
            <p className="text-xs text-muted-foreground">Points</p>
          </div>
          <div>
            <p className={cn(
              "text-lg font-bold",
              entry.averagePoints >= 4 && "text-green-400",
              entry.averagePoints >= 2 && entry.averagePoints < 4 && "text-yellow-400",
              entry.averagePoints < 2 && "text-muted-foreground"
            )}>
              {Number(entry.averagePoints).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Avg/Match</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>
              <span className="text-yellow-400 font-semibold">{correctCount}</span>
              <span className="text-muted-foreground ml-1">correct</span>
            </span>
            <span>
              <span className="text-green-400 font-semibold">{exactCount}</span>
              <span className="text-muted-foreground ml-1">exact</span>
            </span>
          </div>
        </div>

        {/* Accuracy Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
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
      </Link>
    );
  };

  // Get sort icon for a column
  const getSortIcon = (columnId: string) => {
    const sortState = sorting[0];
    if (sortState?.id !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    }
    return sortState.desc
      ? <ArrowDown className="h-3 w-3 ml-1 text-primary" />
      : <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border/50">
                {headerGroup.headers.map(header => {
                  const meta = header.column.columnDef.meta as { align?: 'center' | 'left' | 'right' } | undefined;
                  const alignClass = meta?.align === 'center' ? 'justify-center' :
                                    meta?.align === 'right' ? 'justify-end' : 'justify-start';

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider",
                        header.column.getCanSort() && "cursor-pointer hover:text-foreground transition-colors",
                        meta?.align === 'center' ? "px-3" : "px-4"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                    >
                      <div className={cn("flex items-center", alignClass)}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanSort() && getSortIcon(header.column.id)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/30 transition-colors hover:bg-muted/30",
                  index === 0 && "bg-yellow-500/5",
                  index === 1 && "bg-gray-500/5",
                  index === 2 && "bg-orange-500/5"
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={cn(
                      "py-4",
                      (cell.column.columnDef.meta as { align?: 'center' | 'left' | 'right' })?.align === 'center' ? "px-3 text-center" : "px-4"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 p-4">
        {table.getRowModel().rows.map((row, index) => (
          <MobileCard key={row.original.modelId} entry={row.original} index={index} />
        ))}
      </div>
    </>
  );
}

// Add useMemo import
import { useMemo } from 'react';
