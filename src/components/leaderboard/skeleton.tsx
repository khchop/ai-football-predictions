import 'react-loading-skeleton/dist/skeleton.css';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Skeleton loader for the leaderboard table.
 * Mirrors the structure of the actual table to prevent layout shift.
 */
export function LeaderboardTableSkeleton() {
  return (
    <>
      {/* Desktop Table Skeleton - Hidden on mobile */}
      <div className="hidden md:block">
        <div className="rounded-lg border border-border/50 overflow-hidden">
          {/* Header Row */}
          <div className="bg-muted/30 border-b border-border/50 px-4 py-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-12" /> {/* Rank */}
              <Skeleton className="h-4 w-40" /> {/* Model */}
              <Skeleton className="h-4 w-16" /> {/* Matches */}
              <Skeleton className="h-4 w-16" /> {/* Correct */}
              <Skeleton className="h-4 w-16" /> {/* Exact */}
              <Skeleton className="h-4 w-20" /> {/* Points */}
              <Skeleton className="h-4 w-24" /> {/* Avg/Match */}
              <Skeleton className="h-4 w-32" /> {/* Accuracy */}
              <Skeleton className="h-4 w-16" /> {/* Streak */}
            </div>
          </div>

          {/* Data Rows - 5 skeleton rows */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="border-b border-border/30 px-4 py-4 last:border-0"
            >
              <div className="flex gap-4 items-center">
                {/* Rank Column - Circle */}
                <Skeleton className="h-8 w-8 rounded-full" />

                {/* Model Column - Avatar + Text */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>

                {/* Stats Columns - Numbers */}
                <Skeleton className="h-5 w-12" /> {/* Matches */}
                <Skeleton className="h-5 w-12" /> {/* Correct */}
                <Skeleton className="h-5 w-12" /> {/* Exact */}
                <Skeleton className="h-6 w-14" /> {/* Points */}
                <Skeleton className="h-7 w-16" /> {/* Avg/Match */}

                {/* Accuracy Column - Progress bar */}
                <div className="flex items-center gap-2 w-32">
                  <Skeleton className="h-2 flex-1" />
                  <Skeleton className="h-3 w-8" />
                </div>

                {/* Streak Column */}
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card Skeleton - Hidden on desktop */}
      <div className="md:hidden space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-4 space-y-3">
              {/* Header: Rank + Model Name + Streak */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-6 w-12 mx-auto" />
              </div>

              {/* Secondary Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              {/* Accuracy Bar */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-3 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
