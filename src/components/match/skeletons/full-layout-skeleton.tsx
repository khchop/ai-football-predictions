import { HeroSkeleton } from './hero-skeleton';
import { NarrativeSkeleton } from './narrative-skeleton';
import { PredictionsSkeleton } from '../predictions-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * FullLayoutSkeleton - Complete page skeleton matching MatchLayout structure.
 *
 * Composes section skeletons with appropriate headings and spacing.
 * Used by loading.tsx for route-level loading state.
 */
export function FullLayoutSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12">
      <HeroSkeleton />

      {/* Narrative section */}
      <section>
        <Skeleton className="h-8 w-40 mb-6" />
        <NarrativeSkeleton />
      </section>

      {/* Predictions section */}
      <section>
        <Skeleton className="h-8 w-32 mb-6" />
        <PredictionsSkeleton />
      </section>

      {/* FAQ section */}
      <section className="mt-16 pt-8 border-t border-border/50">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}
