/**
 * Sentry Server Configuration
 * 
 * Captures server-side errors (API routes, SSR, etc.) and sends them to GlitchTip.
 * Only active in production.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // GlitchTip DSN (self-hosted error tracking)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Only enabled in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance monitoring: track 10% of transactions
  tracesSampleRate: 0.1,
  
  // Environment identifier
  environment: process.env.NODE_ENV,
  
  // Attach stack traces to all messages
  attachStacktrace: true,
});
