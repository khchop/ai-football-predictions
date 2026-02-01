'use client';

import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  useEffect(() => {
    // Send to GlitchTip error tracking (same as existing error.tsx)
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        error_boundary: 'react_error_boundary',
      },
    });
    console.error('[ErrorBoundary]', error);
  }, [error]);

  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center my-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {errorMessage}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

interface ErrorBoundaryProviderProps {
  children: React.ReactNode;
}

export function ErrorBoundaryProvider({ children }: ErrorBoundaryProviderProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Clear any cached data that might be stale
        // For now, just let the component remount
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Export ErrorFallback for use in more granular boundaries
export { ErrorFallback };
