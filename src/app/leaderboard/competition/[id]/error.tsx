'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Competition leaderboard error:', error);
  }, [error]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            Failed to load competition leaderboard
          </p>
        </div>
      </div>

      {/* Error Card */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <p className="text-lg font-medium">Error loading competition data</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button
              onClick={reset}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
