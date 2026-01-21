'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Award, ArrowUp, ArrowDown, ArrowUpDown, Flame, Snowflake, Minus } from 'lucide-react';

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

type SortColumn = 'displayName' | 'totalPredictions' | 'correctTendencies' | 'exactScores' | 'totalPoints' | 'averagePoints' | 'accuracy';
type SortOrder = 'asc' | 'desc';

export function LeaderboardTable({ entries, showBreakdown = false }: LeaderboardTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get sort state from URL or use defaults
  const sortParam = searchParams.get('sort') as SortColumn | null;
  const orderParam = searchParams.get('order') as SortOrder | null;
  
  const [sortColumn, setSortColumn] = useState<SortColumn>(sortParam || 'averagePoints');
  const [sortOrder, setSortOrder] = useState<SortOrder>(orderParam || 'desc');

  // Calculate accuracy percentage (correct tendencies / total predictions)
  const getAccuracy = (entry: LeaderboardEntry) => {
    if (entry.totalPredictions === 0) return 0;
    const correct = entry.correctTendencies ?? entry.correctResults ?? 0;
    return Math.round((correct / entry.totalPredictions) * 100);
  };

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortColumn) {
        case 'displayName':
          aVal = a.displayName.toLowerCase();
          bVal = b.displayName.toLowerCase();
          break;
        case 'totalPredictions':
          aVal = a.totalPredictions;
          bVal = b.totalPredictions;
          break;
        case 'correctTendencies':
          aVal = a.correctTendencies ?? a.correctResults ?? 0;
          bVal = b.correctTendencies ?? b.correctResults ?? 0;
          break;
        case 'exactScores':
          aVal = a.exactScores ?? 0;
          bVal = b.exactScores ?? 0;
          break;
        case 'totalPoints':
          aVal = a.totalPoints;
          bVal = b.totalPoints;
          break;
        case 'averagePoints':
          aVal = a.averagePoints;
          bVal = b.averagePoints;
          break;
        case 'accuracy':
          aVal = getAccuracy(a);
          bVal = getAccuracy(b);
          break;
        default:
          aVal = a.averagePoints;
          bVal = b.averagePoints;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [entries, sortColumn, sortOrder]);

  // Update URL when sort changes
  const handleSort = (column: SortColumn) => {
    const newOrder = sortColumn === column && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortColumn(column);
    setSortOrder(newOrder);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', column);
    params.set('order', newOrder);
    router.push(`/leaderboard?${params.toString()}`, { scroll: false });
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

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

  // Get streak indicator (hot/cold/neutral)
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
      <div 
        className={cn(
          "rounded-lg border border-border/50 p-4 space-y-3",
          index === 0 && "bg-yellow-500/5 border-yellow-500/30",
          index === 1 && "bg-gray-500/5 border-gray-400/30",
          index === 2 && "bg-orange-500/5 border-orange-500/30"
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
              {entry.averagePoints.toFixed(2)}
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
      </div>
    );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rank
              </th>
              <th 
                className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('displayName')}
              >
                <span className="flex items-center">
                  Model
                  {getSortIcon('displayName')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('totalPredictions')}
              >
                <span className="flex items-center justify-center">
                  Matches
                  {getSortIcon('totalPredictions')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('correctTendencies')}
                title="Correct Tendency (H/D/A)"
              >
                <span className="flex items-center justify-center">
                  Correct
                  {getSortIcon('correctTendencies')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('exactScores')}
                title="Exact Score Predictions"
              >
                <span className="flex items-center justify-center">
                  Exact
                  {getSortIcon('exactScores')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('totalPoints')}
              >
                <span className="flex items-center justify-center">
                  Points
                  {getSortIcon('totalPoints')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('averagePoints')}
                title="Average Points per Match"
              >
                <span className="flex items-center justify-center">
                  Avg/Match
                  {getSortIcon('averagePoints')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('accuracy')}
                title="Correct Tendency Rate"
              >
                <span className="flex items-center justify-center">
                  Accuracy
                  {getSortIcon('accuracy')}
                </span>
              </th>
              <th 
                className="text-center py-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"
                title="Current Prediction Streak"
              >
                Streak
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, index) => {
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
                  <td className="py-4 px-3 text-center">
                    {getStreakIndicator(entry)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 p-4">
        {sortedEntries.map((entry, index) => (
          <MobileCard key={entry.modelId} entry={entry} index={index} />
        ))}
      </div>
    </>
  );
}
