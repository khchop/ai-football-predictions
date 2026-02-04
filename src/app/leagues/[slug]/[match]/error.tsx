'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary for match pages.
 *
 * Displays error message with retry button. Uses reset() to
 * re-invoke the route's server component and attempt recovery.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center space-y-6">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto" />

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {error.message || 'Failed to load match data. Please try again.'}
          </p>
        </div>

        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
