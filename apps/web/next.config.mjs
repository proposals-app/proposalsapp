import withSerwistInit from '@serwist/next';

const _withSerwist = withSerwistInit({
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
    // cacheComponents: true,
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

  webpack(config, { isServer, webpack }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Handle @resvg/resvg-js native binaries
    if (isServer) {
      config.externals.push({
        '@resvg/resvg-js': '@resvg/resvg-js',
      });

      // Polyfill indexedDB for server-side to prevent WalletConnect errors
      config.plugins.push(
        new webpack.DefinePlugin({
          global: {},
          globalThis: {},
          indexedDB: '{}',
          IDBTransaction: '{}',
          IDBDatabase: '{}',
          IDBObjectStore: '{}',
          IDBIndex: '{}',
          IDBCursor: '{}',
          IDBRequest: '{}',
          IDBOpenDBRequest: '{}',
          IDBVersionChangeEvent: '{}',
          IDBKeyRange: '{}',
        })
      );
    } else {
      // For client-side, exclude the entire package
      config.resolve.alias['@resvg/resvg-js'] = false;

      // Add fallbacks for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Externalize pino-pretty and lokijs to prevent bundling issues with WalletConnect
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    return config;
  },
};

// export default nextConfig;
// If you need Serwist support, uncomment the following line:
export default _withSerwist(nextConfig);
