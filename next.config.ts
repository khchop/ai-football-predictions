import type { NextConfig } from "next";

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

export default nextConfig;

// Note: Instrumentation is enabled by default in Next.js 16+
// The instrumentation.ts file will be automatically detected and run
