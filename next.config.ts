import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
        pathname: '/football/**',
      },
      {
        protocol: 'https',
        hostname: 'media-*.api-sports.io',
        pathname: '/football/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options for error instrumentation
  silent: true, // Suppress logs during build
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});

// Note: Instrumentation is enabled by default in Next.js 16+
// The instrumentation.ts file will be automatically detected and run
