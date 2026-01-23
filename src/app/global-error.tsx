'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send to GlitchTip error tracking
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        error_boundary: 'global_error',
      },
    });
    
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '20px',
        }}>
          <h1 style={{ fontSize: '2em', marginBottom: '10px' }}>Something went wrong</h1>
          <p style={{ fontSize: '1em', color: '#666', marginBottom: '20px' }}>
            A critical error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.9em', color: '#999', fontFamily: 'monospace', marginBottom: '20px' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
