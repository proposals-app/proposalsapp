import withSerwistInit from '@serwist/next';
import { resolve } from 'path';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  allowedDevOrigins: [
    'arbitrum.localhost',
    'uniswap.localhost',
    'localhost',
    '*.localhost',
  ],
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
    ];
  },
  skipTrailingSlashRedirect: true,
  experimental: {
    reactCompiler: true,
    viewTransition: true,
    useCache: true,
    // dynamicIO: true,
    // cacheHandlers: { default: resolve('./cache-handler.mjs') },
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Additional headers for CORS and subdomain support
  async headers() {
    return [
      // Specific headers for Discourse API routes
      {
        source: '/api/discourse/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Allow all origins for now, match API route
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }, // Allow GET and OPTIONS
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Discourse-Logged-In, Discourse-Present, X-Requested-With, X-CSRF-Token', // Add required Discourse headers
          },
        ],
      },
      // General headers for all other routes
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Keep general allow origin
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS', // Keep general methods
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization', // Keep general headers
          },
        ],
      },
    ];
  },
  images: {
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost',
      },
    ],
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
};

export default nextConfig;

//export default withSerwist(nextConfig);
