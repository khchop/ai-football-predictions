import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrendIndicatorProps {
  direction: 'rising' | 'falling' | 'stable' | 'new';
  rankChange: number;
}

/**
 * Trend indicator showing rank change with semantic colors
 * Uses arrow direction as primary indicator (accessibility)
 * Color provides enhancement (--win green, --loss red)
 */
export function TrendIndicator({ direction, rankChange }: TrendIndicatorProps) {
  if (direction === 'new') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
        New
      </span>
    );
  }

  if (direction === 'stable') {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
      </div>
    );
  }

  const isRising = direction === 'rising';
  const Icon = isRising ? ArrowUp : ArrowDown;
  // Use semantic colors from globals.css (--win, --loss)
  const colorClass = isRising ? 'text-win' : 'text-loss';

  return (
    <div className={cn("flex items-center gap-1", colorClass)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">
        {Math.abs(rankChange)}
      </span>
    </div>
  );
}
