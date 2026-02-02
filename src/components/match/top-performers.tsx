import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

export interface TopPerformer {
  modelName: string;
  prediction: string;
  points: number;
}

interface TopPerformersProps {
  topPerformers: TopPerformer[];
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
}

export function TopPerformers({
  topPerformers,
  showTitle = true,
  compact = false,
  className,
}: TopPerformersProps) {
  if (!topPerformers || topPerformers.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showTitle && (
        <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" />
          Top Performing Models
        </h4>
      )}
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {topPerformers.map((performer, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center justify-between rounded-lg border',
              compact ? 'p-2' : 'p-3',
              index === 0 && 'bg-yellow-500/10 border-yellow-500/30',
              index === 1 && 'bg-gray-500/10 border-gray-500/30',
              index === 2 && 'bg-orange-500/10 border-orange-500/30',
              index > 2 && 'bg-muted/30 border-border/50'
            )}
          >
            <div className="flex items-center gap-3">
              {index < 3 && (
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full text-xs font-bold',
                    compact ? 'w-5 h-5' : 'w-6 h-6',
                    index === 0 && 'bg-yellow-500 text-black',
                    index === 1 && 'bg-gray-400 text-black',
                    index === 2 && 'bg-orange-500 text-black'
                  )}
                >
                  {index + 1}
                </span>
              )}
              <div>
                <p className={cn("font-semibold", compact && "text-sm")}>{performer.modelName}</p>
                <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  Predicted: {performer.prediction}
                </p>
              </div>
            </div>
            <span className={cn("font-bold text-primary", compact ? "text-sm" : "text-lg")}>
              {performer.points} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
