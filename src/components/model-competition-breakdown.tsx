'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Star, ArrowUpDown, ArrowUp, ArrowDown, Trophy } from 'lucide-react';

interface CompetitionStats {
  competitionId: string;
  competitionName: string;
  totalPredictions: number;
  correctTendencies: number;
  exactScores: number;
  totalPoints: number;
  averagePoints: number;
  accuracy: number;
}

interface ModelCompetitionBreakdownProps {
  data: CompetitionStats[];
  onCompetitionSelect?: (competitionId: string | null) => void;
  selectedCompetition?: string | null;
}

type SortColumn = 'competitionName' | 'totalPredictions' | 'totalPoints' | 'averagePoints' | 'accuracy';
type SortOrder = 'asc' | 'desc';

export function ModelCompetitionBreakdown({ 
  data, 
  onCompetitionSelect,
  selectedCompetition 
}: ModelCompetitionBreakdownProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalPredictions');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Find best competition (highest avg points with min 5 predictions)
  const bestCompetitionId = useMemo(() => {
    const eligible = data.filter(d => d.totalPredictions >= 5);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, current) => 
      current.averagePoints > best.averagePoints ? current : best
    ).competitionId;
  }, [data]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortColumn) {
        case 'competitionName':
          aVal = a.competitionName.toLowerCase();
          bVal = b.competitionName.toLowerCase();
          break;
        case 'totalPredictions':
          aVal = a.totalPredictions;
          bVal = b.totalPredictions;
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
          aVal = a.accuracy;
          bVal = b.accuracy;
          break;
        default:
          aVal = a.totalPredictions;
          bVal = b.totalPredictions;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortColumn, sortOrder]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const handleRowClick = (competitionId: string) => {
    if (onCompetitionSelect) {
      if (selectedCompetition === competitionId) {
        onCompetitionSelect(null); // Deselect
      } else {
        onCompetitionSelect(competitionId);
      }
    }
  };

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-8 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No competition data yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th
              className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('competitionName')}
            >
              <span className="flex items-center">
                Competition
                {getSortIcon('competitionName')}
              </span>
            </th>
            <th
              className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('totalPredictions')}
            >
              <span className="flex items-center justify-center">
                Matches
                {getSortIcon('totalPredictions')}
              </span>
            </th>
            <th
              className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('totalPoints')}
            >
              <span className="flex items-center justify-center">
                Points
                {getSortIcon('totalPoints')}
              </span>
            </th>
            <th
              className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('averagePoints')}
            >
              <span className="flex items-center justify-center">
                Avg
                {getSortIcon('averagePoints')}
              </span>
            </th>
            <th
              className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('accuracy')}
            >
              <span className="flex items-center justify-center">
                Accuracy
                {getSortIcon('accuracy')}
              </span>
            </th>
            <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Exact
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const isBest = row.competitionId === bestCompetitionId;
            const isSelected = selectedCompetition === row.competitionId;

            return (
              <tr
                key={row.competitionId}
                onClick={() => handleRowClick(row.competitionId)}
                className={cn(
                  "border-b border-border/30 transition-colors cursor-pointer",
                  isSelected && "bg-primary/10",
                  !isSelected && "hover:bg-muted/30",
                  isBest && !isSelected && "bg-green-500/5"
                )}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.competitionName}</span>
                    {isBest && (
                      <span title="Best performing competition">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-mono text-sm">
                  {row.totalPredictions}
                </td>
                <td className="py-3 px-3 text-center font-bold">
                  {row.totalPoints}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-sm font-medium",
                    row.averagePoints >= 4 && "bg-green-500/20 text-green-400",
                    row.averagePoints >= 2 && row.averagePoints < 4 && "bg-yellow-500/20 text-yellow-400",
                    row.averagePoints < 2 && "bg-muted text-muted-foreground"
                  )}>
                    {Number(row.averagePoints).toFixed(2)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={cn(
                    "text-sm",
                    row.accuracy >= 50 ? "text-green-400" : row.accuracy >= 30 ? "text-yellow-400" : "text-muted-foreground"
                  )}>
                    {row.accuracy}%
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    row.exactScores > 0 ? "text-green-400" : "text-muted-foreground"
                  )}>
                    {row.exactScores}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {onCompetitionSelect && selectedCompetition && (
        <div className="mt-3 text-center">
          <button
            onClick={() => onCompetitionSelect(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
