'use client';

import { cn } from '@/lib/utils';

interface TeamFormIndicatorProps {
  form: ('W' | 'D' | 'L')[];
}

export function TeamFormIndicator({ form }: TeamFormIndicatorProps) {
  if (form.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent matches</p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {form.map((result, index) => {
        const getResultColors = (r: 'W' | 'D' | 'L') => {
          switch (r) {
            case 'W':
              return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'D':
              return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'L':
              return 'bg-red-500/20 text-red-400 border-red-500/30';
          }
        };

        const getResultTitle = (r: 'W' | 'D' | 'L') => {
          switch (r) {
            case 'W':
              return 'Win';
            case 'D':
              return 'Draw';
            case 'L':
              return 'Loss';
          }
        };

        return (
          <div
            key={index}
            className={cn(
              'h-8 w-8 rounded-md flex items-center justify-center font-semibold text-xs border',
              getResultColors(result)
            )}
            title={getResultTitle(result)}
          >
            {result}
          </div>
        );
      })}
    </div>
  );
}
