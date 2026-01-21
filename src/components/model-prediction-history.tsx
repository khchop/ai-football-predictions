'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, X, Trophy, ChevronDown, ExternalLink } from 'lucide-react';
import type { Prediction, Match, Competition } from '@/lib/db/schema';

interface PredictionWithDetails {
  prediction: Prediction;
  match: Match;
  competition: Competition;
}

interface ModelPredictionHistoryProps {
  initialData: PredictionWithDetails[];
  modelId: string;
  competitionFilter?: string | null;
  hasMore?: boolean;
}

export function ModelPredictionHistory({
  initialData,
  modelId,
  competitionFilter,
  hasMore: initialHasMore = true,
}: ModelPredictionHistoryProps) {
  const [predictions, setPredictions] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        offset: predictions.length.toString(),
        limit: '20',
      });
      if (competitionFilter) {
        params.set('competition', competitionFilter);
      }
      
      const res = await fetch(`/api/models/${modelId}/predictions?${params}`);
      if (!res.ok) throw new Error('Failed to load more');
      
      const data = await res.json();
      setPredictions([...predictions, ...data.predictions]);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error loading more predictions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getResultIcon = (pred: PredictionWithDetails) => {
    const { prediction, match } = pred;
    if (match.homeScore === null || match.awayScore === null) {
      return <span className="text-muted-foreground">-</span>;
    }

    const isExact = 
      prediction.predictedHomeScore === match.homeScore &&
      prediction.predictedAwayScore === match.awayScore;

    if (isExact) {
      return (
        <div className="flex items-center gap-0.5">
          <Check className="h-4 w-4 text-green-400" />
          <Check className="h-4 w-4 text-green-400" />
          <Check className="h-4 w-4 text-green-400" />
        </div>
      );
    }

    const predictedResult = 
      prediction.predictedHomeScore > prediction.predictedAwayScore ? 'H' :
      prediction.predictedHomeScore < prediction.predictedAwayScore ? 'A' : 'D';
    const actualResult = 
      match.homeScore > match.awayScore ? 'H' :
      match.homeScore < match.awayScore ? 'A' : 'D';

    if (predictedResult === actualResult) {
      return <Check className="h-4 w-4 text-yellow-400" />;
    }

    return <X className="h-4 w-4 text-red-400" />;
  };

  const getPointsBadge = (points: number | null) => {
    if (points === null || points === 0) {
      return <span className="text-muted-foreground">0</span>;
    }
    
    return (
      <span className={cn(
        "px-2 py-0.5 rounded text-sm font-medium",
        points >= 7 && "bg-green-500/20 text-green-400",
        points >= 3 && points < 7 && "bg-yellow-500/20 text-yellow-400",
        points < 3 && points > 0 && "bg-muted text-foreground"
      )}>
        +{points}
      </span>
    );
  };

  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-8 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">
          {competitionFilter ? 'No predictions for this competition yet' : 'No predictions yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Match
              </th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Competition
              </th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Predicted
              </th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actual
              </th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Points
              </th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => (
              <tr
                key={pred.prediction.id}
                className="border-b border-border/30 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-3 text-sm text-muted-foreground">
                  {format(parseISO(pred.match.kickoffTime), 'MMM d')}
                </td>
                <td className="py-3 px-3">
                  <Link
                    href={`/matches/${pred.match.id}`}
                    className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {pred.match.homeTeam} vs {pred.match.awayTeam}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                </td>
                <td className="py-3 px-3 text-sm text-muted-foreground">
                  {pred.competition.name}
                </td>
                <td className="py-3 px-3 text-center font-mono">
                  {pred.prediction.predictedHomeScore}-{pred.prediction.predictedAwayScore}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold">
                  {pred.match.homeScore !== null && pred.match.awayScore !== null
                    ? `${pred.match.homeScore}-${pred.match.awayScore}`
                    : '-'}
                </td>
                <td className="py-3 px-3 text-center">
                  {getPointsBadge(pred.prediction.pointsTotal)}
                </td>
                <td className="py-3 px-3">
                  <div className="flex justify-center">
                    {getResultIcon(pred)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {predictions.map((pred) => (
          <Link
            key={pred.prediction.id}
            href={`/matches/${pred.match.id}`}
            className="block rounded-lg border border-border/50 p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{pred.match.homeTeam} vs {pred.match.awayTeam}</p>
                <p className="text-xs text-muted-foreground">
                  {pred.competition.name} &bull; {format(parseISO(pred.match.kickoffTime), 'MMM d')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getPointsBadge(pred.prediction.pointsTotal)}
                {getResultIcon(pred)}
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Predicted: </span>
                <span className="font-mono">{pred.prediction.predictedHomeScore}-{pred.prediction.predictedAwayScore}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Actual: </span>
                <span className="font-mono font-bold">
                  {pred.match.homeScore !== null && pred.match.awayScore !== null
                    ? `${pred.match.homeScore}-${pred.match.awayScore}`
                    : '-'}
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-muted/50 hover:bg-muted text-sm font-medium transition-colors",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>Loading...</>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Load more
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
