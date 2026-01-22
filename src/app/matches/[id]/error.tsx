'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong loading this match</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        {error.message || 'An unexpected error occurred'}
      </p>
      <button 
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
