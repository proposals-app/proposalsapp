import withSerwistInit from '@serwist/next';
import { resolve } from 'path';

const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  cacheOnNavigation: true,
  swSrc: '/app/sw.ts',
  swDest: './public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  maximumFileSizeToCacheInBytes: 25000000,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  rewrites: () => {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: '(?<daoSlug>.*).example.com',
          },
        ],
        destination: '/:daoSlug/:path*',
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  cacheHandler: resolve('./cache-handler.js'),
  experimental: {
    reactCompiler: true,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  serverExternalPackages: ['@proposalsapp/db'],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default withSerwist(nextConfig);
