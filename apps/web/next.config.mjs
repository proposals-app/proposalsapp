import withSerwistInit from '@serwist/next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const _withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
    resolveAlias: {
      // Exclude WalletConnect's bundled pino and thread-stream to prevent test file inclusion
      pino: 'pino',
      'thread-stream': 'thread-stream',
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
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    // Disable proxy buffering so streaming HTML is flushed progressively
    // Add security headers including CSP
    return [
      {
        source: '/:path*{/}?',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https:",
              "font-src 'self'",
              "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com wss:",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  images: {
    minimumCacheTTL: 3600,
    remotePatterns: [
      // DiceBear API for generated avatars
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      // GitHub avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // Raw GitHub content
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      // Discourse CDN (various subdomains)
      {
        protocol: 'https',
        hostname: '*.discourse-cdn.com',
      },
      // IPFS gateways
      {
        protocol: 'https',
        hostname: '*.ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      // Cloudflare IPFS
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
      // ENS avatars
      {
        protocol: 'https',
        hostname: 'euc.li',
      },
      {
        protocol: 'https',
        hostname: 'metadata.ens.domains',
      },
      // Snapshot CDN
      {
        protocol: 'https',
        hostname: 'cdn.stamp.fyi',
      },
      // Generic fallback for DAO logos and other static assets
      // Note: This is still permissive, but more explicit than '**'
      // Consider narrowing further as you identify specific domains
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
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
// Bundle analyzer can be enabled with ANALYZE=true npm run build
export default withBundleAnalyzer(_withSerwist(nextConfig));
