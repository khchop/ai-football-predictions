/**
 * Sentry Client Configuration
 * 
 * Captures browser-side JavaScript errors and sends them to GlitchTip.
 * Only active in production to avoid development spam.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // GlitchTip DSN (self-hosted error tracking)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Only enabled in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance monitoring: track 10% of transactions
  tracesSampleRate: 0.1,
  
  // Session replay: capture 10% of errors with session replay
  replaysOnErrorSampleRate: 0.1,
  
  // Don't capture sessions in replays (saves bandwidth)
  replaysSessionSampleRate: 0,
  
  // Environment identifier
  environment: process.env.NODE_ENV,
  
  // Attach stack traces to all messages
  attachStacktrace: true,
  
  // Ignore common non-critical errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'chrome-extension://',
    'moz-extension://',
    // Network timeouts (usually user's connection)
    'NetworkError',
    'AbortError',
    'timeout',
  ],
});
