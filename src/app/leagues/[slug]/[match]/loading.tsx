import { FullLayoutSkeleton } from '@/components/match/skeletons';

/**
 * Route-level loading state for match pages.
 *
 * Uses FullLayoutSkeleton to show placeholder matching final layout
 * dimensions during page load, preventing layout shift.
 */
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <FullLayoutSkeleton />
    </div>
  );
}
