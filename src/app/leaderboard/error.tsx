'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Leaderboard Error]', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Failed to load leaderboard</h2>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t load the leaderboard data. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
