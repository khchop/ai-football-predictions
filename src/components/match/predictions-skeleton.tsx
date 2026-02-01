'use client';

import { Bot } from 'lucide-react';

/**
 * Loading skeleton for predictions section.
 * Shows 35 placeholder cards with fixed height to prevent layout shift.
 */
export function PredictionsSkeleton() {
  // Estimate: 35 predictions * ~80px per card = ~2800px total height
  // Using fixed card height prevents reflow when actual predictions load
  return (
    <div className="space-y-3" style={{ minHeight: '2800px' }}>
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-12 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground">Loading AI predictions...</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Fetching predictions from 35 models
        </p>
      </div>

      {/* Skeleton cards for visual feedback */}
      <div className="space-y-3 mt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50 animate-pulse"
          >
            {/* Icon placeholder */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted/50" />

            {/* Model name placeholder */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted/50 rounded w-1/3" />
              <div className="h-3 bg-muted/50 rounded w-1/4" />
            </div>

            {/* Prediction placeholder */}
            <div className="flex items-center gap-2">
              <div className="min-w-[80px] space-y-2">
                <div className="h-3 bg-muted/50 rounded w-full" />
                <div className="h-8 bg-muted/50 rounded w-full" />
              </div>
              <div className="w-4 h-4 bg-muted/50 rounded" />
              <div className="min-w-[80px] space-y-2">
                <div className="h-3 bg-muted/50 rounded w-full" />
                <div className="h-8 bg-muted/50 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
