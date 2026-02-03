/**
 * Enhanced loading skeleton for predictions section with shimmer animation.
 * Matches the structure of the actual prediction table (icon, name, scores, points).
 * Shows 8 rows to fill typical viewport during streaming.
 */
export function PredictionsSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <div className="skeleton-wrapper w-5 h-5 rounded bg-muted/50">
          <div className="shimmer" />
        </div>
        <div className="skeleton-wrapper h-6 bg-muted/50 rounded w-48">
          <div className="shimmer" />
        </div>
      </div>

      {/* Prediction rows - 8 rows to fill typical viewport */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-wrapper flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50"
        >
          {/* Shimmer overlay */}
          <div className="shimmer" />

          {/* Model icon placeholder */}
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex-shrink-0" />

          {/* Model name and provider */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-muted/50 rounded w-1/3" />
            <div className="h-3 bg-muted/50 rounded w-1/4" />
          </div>

          {/* Score boxes (home - away format) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-muted/50 rounded" />
            <div className="w-3 h-3 bg-muted/30 rounded" />
            <div className="w-8 h-8 bg-muted/50 rounded" />
          </div>

          {/* Points column (visible on finished matches) */}
          <div className="w-12 h-6 bg-muted/50 rounded flex-shrink-0" />
        </div>
      ))}

      {/* Footer skeleton (avg prediction summary) */}
      <div className="skeleton-wrapper grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="shimmer" />
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded w-1/2 mx-auto" />
            <div className="h-5 bg-muted/50 rounded w-2/3 mx-auto" />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="shimmer" />
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded w-1/2 mx-auto" />
            <div className="h-5 bg-muted/50 rounded w-1/3 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
