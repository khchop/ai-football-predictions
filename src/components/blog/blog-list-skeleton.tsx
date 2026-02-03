/**
 * Blog List Skeleton
 *
 * Loading skeleton for blog posts grid, matching the exact layout
 * of the blog cards (3-column grid, 6 cards for POSTS_PER_PAGE display).
 * Used as Suspense fallback for PPR-compatible blog page.
 */

import { Skeleton } from '@/components/ui/skeleton';

export function BlogListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-wrapper rounded-lg border border-border/50 bg-card/50 p-6 h-full flex flex-col"
        >
          {/* Content type badge + competition icon row */}
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>

          {/* Title placeholder - 2 lines */}
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4 mb-4" />

          {/* Excerpt placeholder - 3 lines */}
          <div className="flex-grow">
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-4 w-2/3 mb-4" />
          </div>

          {/* Date placeholder */}
          <Skeleton className="h-3 w-20" />

          {/* Shimmer overlay */}
          <div className="shimmer" />
        </div>
      ))}
    </div>
  );
}
