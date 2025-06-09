import withSerwistInit from '@serwist/next';
import { resolve } from 'path';

const _withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during builds since we handle linting separately with monorepo config
    ignoreDuringBuilds: true,
  },
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
  async rewrites() {
    return [
      // PostHog rewrites need to come first to ensure they're not caught by the catch-all subdomain rewrite
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
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  experimental: {
    reactCompiler: true,
    viewTransition: true,
    useCache: true,
    // dynamicIO: true,
    cacheHandlers: { default: resolve('./cache-handler.mjs') },
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
      {
        protocol: 'http',
        hostname: process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost',
      },
    ],
  },

  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Handle @resvg/resvg-js native binaries
    if (isServer) {
      config.externals.push({
        '@resvg/resvg-js': '@resvg/resvg-js',
      });
    } else {
      // For client-side, exclude the entire package
      config.resolve.alias['@resvg/resvg-js'] = false;
    }

    return config;
  },
};

export default nextConfig;
// If you need Serwist support, uncomment the following line:
// export default _withSerwist(nextConfig);
