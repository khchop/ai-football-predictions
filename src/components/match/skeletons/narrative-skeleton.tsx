import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/**
 * NarrativeSkeleton - Loading skeleton matching MatchNarrative dimensions.
 *
 * Structure mirrors match-narrative.tsx:
 * - Card with CardContent wrapper
 * - Heading placeholder
 * - Multiple text line placeholders
 */
export function NarrativeSkeleton() {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
