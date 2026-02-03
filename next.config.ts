import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  cacheComponents: true,  // Enable PPR for static shell + dynamic streaming
  experimental: {
    viewTransition: true,
  },
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
  async redirects() {
    return [
      // Long-form to short-form league redirects (SEO canonical URLs)
      { source: '/leagues/premier-league/:path*', destination: '/leagues/epl/:path*', permanent: true },
      { source: '/leagues/champions-league/:path*', destination: '/leagues/ucl/:path*', permanent: true },
      { source: '/leagues/europa-league/:path*', destination: '/leagues/uel/:path*', permanent: true },
      { source: '/leagues/la-liga/:path*', destination: '/leagues/laliga/:path*', permanent: true },
      { source: '/leagues/serie-a/:path*', destination: '/leagues/seriea/:path*', permanent: true },
      { source: '/leagues/ligue-1/:path*', destination: '/leagues/ligue1/:path*', permanent: true },
    ];
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
