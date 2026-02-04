import { Skeleton } from '@/components/ui/skeleton';

/**
 * HeroSkeleton - Loading skeleton matching MatchHero dimensions.
 *
 * Structure mirrors match-hero.tsx exactly:
 * - Teams + Score/VS row with logo placeholders
 * - Meta row with competition, date, and status badge
 */
export function HeroSkeleton() {
  return (
    <section className="bg-card border-border border rounded-xl p-6 md:p-8">
      {/* Teams + Score/VS row */}
      <div className="flex items-center justify-between gap-4 md:gap-8">
        {/* Home team placeholder */}
        <div className="flex-1 text-center">
          <Skeleton className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl" />
          <Skeleton className="h-6 w-24 mx-auto" />
        </div>

        {/* VS/Score placeholder */}
        <Skeleton className="h-16 w-20" />

        {/* Away team placeholder */}
        <div className="flex-1 text-center">
          <Skeleton className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 rounded-xl" />
          <Skeleton className="h-6 w-24 mx-auto" />
        </div>
      </div>

      {/* Meta row placeholder */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-6 border-t border-border/50">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </section>
  );
}
