import path from 'node:path';
import { fileURLToPath } from 'node:url';
import withSerwistInit from '@serwist/next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundle analyzer is optional - only load when ANALYZE=true and package is available
let withBundleAnalyzer = (config) => config;
if (process.env.ANALYZE === 'true') {
  try {
    const bundleAnalyzer = (await import('@next/bundle-analyzer')).default;
    withBundleAnalyzer = bundleAnalyzer({ enabled: true });
  } catch {
    console.warn('Bundle analyzer not available, skipping...');
  }
}

const _withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https:",
              "font-src 'self' https://fonts.reown.com",
              [
                "connect-src 'self'",
                'https://eu.i.posthog.com',
                'https://eu-assets.i.posthog.com',
                'https://cloudflareinsights.com',
                'https://arb1.arbitrum.io',
                'https://eth.merkle.io',
                'https://rpc.walletconnect.com',
                'https://rpc.walletconnect.org',
                'https://relay.walletconnect.com',
                'https://relay.walletconnect.org',
                'wss://relay.walletconnect.com',
                'wss://relay.walletconnect.org',
                'https://pulse.walletconnect.com',
                'https://pulse.walletconnect.org',
                'https://api.web3modal.com',
                'https://api.web3modal.org',
                'https://keys.walletconnect.com',
                'https://keys.walletconnect.org',
                'https://notify.walletconnect.com',
                'https://notify.walletconnect.org',
                'https://echo.walletconnect.com',
                'https://echo.walletconnect.org',
                'https://push.walletconnect.com',
                'https://push.walletconnect.org',
                'wss://www.walletlink.org',
                'https://cca-lite.coinbase.com',
              ].join(' '),
              "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org",
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
      // Discourse forum avatars (served directly, not via CDN)
      {
        protocol: 'https',
        hostname: 'forum.arbitrum.foundation',
      },
      {
        protocol: 'https',
        hostname: 'gov.uniswap.org',
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
