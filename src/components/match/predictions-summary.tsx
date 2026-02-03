'use client';

import { Trophy, Target, X } from 'lucide-react';

interface PredictionsSummaryProps {
  predictions: Array<{
    isExact: boolean;
    isCorrectResult: boolean;
  }>;
}

/**
 * Summary component showing prediction stats for finished matches.
 * Displays counts: exact scores, correct winners, and misses.
 * Icons provide accessibility alongside colors per WCAG 1.4.1.
 */
export function PredictionsSummary({ predictions }: PredictionsSummaryProps) {
  const total = predictions.length;
  const exactCount = predictions.filter(p => p.isExact).length;
  const winnerCount = predictions.filter(p => p.isCorrectResult && !p.isExact).length;
  const missCount = total - exactCount - winnerCount;

  // Don't render if no predictions
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 text-sm mb-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-green-400" aria-hidden="true" />
        <span>
          <strong>{exactCount}</strong> exact score{exactCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-yellow-400" aria-hidden="true" />
        <span>
          <strong>{winnerCount}</strong> got winner
        </span>
      </div>
      <div className="flex items-center gap-2">
        <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>
          <strong>{missCount}</strong> missed
        </span>
      </div>
    </div>
  );
}
