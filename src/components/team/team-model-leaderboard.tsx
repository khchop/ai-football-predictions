'use client';

import { useState, useMemo } from 'react';
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
import { ArrowUp, ArrowDown, ArrowUpDown, Minus, Sparkles } from 'lucide-react';

interface TeamModelLeaderboardProps {
  entries: Array<{
    rank: number;
    modelId: string;
    displayName: string;
    provider: string;
    totalPredictions: number;
    totalPoints: number;
    avgPoints: number;
    exactScores: number;
    correctTendencies: number;
    accuracy: number;
    trendDirection: 'rising' | 'falling' | 'stable' | 'new';
    rankChange: number;
    archived?: boolean;
  }>;
}

export function TeamModelLeaderboard({ entries }: TeamModelLeaderboardProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'rank', desc: false }, // Default sort by rank ascending
  ]);

  // Get trend icon
  const getTrendIcon = (direction: 'rising' | 'falling' | 'stable' | 'new') => {
    switch (direction) {
      case 'rising':
        return <ArrowUp className="h-4 w-4 text-green-400" />;
      case 'falling':
        return <ArrowDown className="h-4 w-4 text-red-400" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      case 'new':
        return <Sparkles className="h-4 w-4 text-blue-400" />;
    }
  };

  // Column definitions
  const columns = useMemo<ColumnDef<TeamModelLeaderboardProps['entries'][0]>[]>(
    () => [
      {
        accessorKey: 'rank',
        header: '#',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground font-mono">{getValue() as number}</span>
        ),
        size: 50,
      },
      {
        accessorKey: 'displayName',
        header: 'Model',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div>
              <p className={cn("font-medium", row.original.archived && "text-muted-foreground")}>
                {row.original.displayName}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{row.original.provider}</p>
            </div>
            {row.original.archived && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                Archived
              </span>
            )}
          </div>
        ),
        size: 180,
      },
      {
        accessorKey: 'avgPoints',
        header: 'Avg Points',
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <span
              className={cn(
                'px-2 py-1 rounded-md font-mono text-sm font-bold',
                value >= 4 && 'bg-green-500/20 text-green-400',
                value >= 2 && value < 4 && 'bg-yellow-500/20 text-yellow-400',
                value < 2 && 'bg-muted text-muted-foreground'
              )}
            >
              {Number(value).toFixed(2)}
            </span>
          );
        },
        size: 120,
      },
      {
        accessorKey: 'accuracy',
        header: 'Accuracy',
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return <span className="font-medium">{Math.round(value)}%</span>;
        },
        size: 100,
      },
      {
        accessorKey: 'exactScores',
        header: 'Exact',
        cell: ({ getValue }) => (
          <span className="text-green-400 font-semibold">{getValue() as number}</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'totalPredictions',
        header: 'Total',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as number}</span>
        ),
        size: 80,
      },
      {
        id: 'trend',
        header: 'Trend',
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {getTrendIcon(row.original.trendDirection)}
          </div>
        ),
        enableSorting: false,
        size: 80,
      },
    ],
    []
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.modelId,
  });

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No predictions for this team yet.
      </div>
    );
  }

  // Get sort icon for a column
  const getSortIcon = (columnId: string) => {
    const sortState = sorting[0];
    if (sortState?.id !== columnId) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    }
    return sortState.desc ? (
      <ArrowDown className="h-3 w-3 ml-1 text-primary" />
    ) : (
      <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left',
                      header.column.getCanSort() &&
                        'cursor-pointer hover:text-foreground transition-colors'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && getSortIcon(header.column.id)}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/30 transition-colors hover:bg-muted/30",
                  row.original.archived && "opacity-60"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-4 px-4">
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
        {table.getRowModel().rows.map((row) => {
          const entry = row.original;
          return (
            <div
              key={entry.modelId}
              className={cn(
                "rounded-lg border border-border/50 p-4 space-y-3 bg-card/50",
                entry.archived && "opacity-60"
              )}
            >
              {/* Header: Rank + Model Name + Trend */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground font-mono text-sm">#{entry.rank}</span>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className={cn("font-medium", entry.archived && "text-muted-foreground")}>
                        {entry.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{entry.provider}</p>
                    </div>
                    {entry.archived && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                {getTrendIcon(entry.trendDirection)}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      entry.avgPoints >= 4 && 'text-green-400',
                      entry.avgPoints >= 2 && entry.avgPoints < 4 && 'text-yellow-400',
                      entry.avgPoints < 2 && 'text-muted-foreground'
                    )}
                  >
                    {entry.avgPoints.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Pts</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{Math.round(entry.accuracy)}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">{entry.exactScores}</p>
                  <p className="text-xs text-muted-foreground">Exact</p>
                </div>
              </div>

              {/* Total Predictions */}
              <div className="text-sm text-muted-foreground text-center">
                {entry.totalPredictions} predictions
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
