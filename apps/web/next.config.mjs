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
  allowedDevOrigins: ['arbitrum.localhost'],
  rewrites: () => {
    return [
      // PostHog rewrites need to come first to ensure they're not caught by the catch-all subdomain rewrite
      {
        source: '/ingest/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://eu.i.posthog.com/decide',
      },
      // Subdomain rewrite comes last as it's a catch-all
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
    ];
  },
  skipTrailingSlashRedirect: true,
  cacheHandler: resolve('./cache-handler.js'),
  experimental: {
    reactCompiler: true,
    viewTransition: true,
    serverActions: {
      bodySizeLimit: '10mb',
    },
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
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
  serverExternalPackages: ['@proposalsapp/db-indexer'],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default withSerwist(nextConfig);
