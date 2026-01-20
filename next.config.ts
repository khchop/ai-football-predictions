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
