import withSerwistInit from '@serwist/next';

const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  cacheOnNavigation: true,
  swSrc: '/app/sw.ts',
  swDest: './public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  maximumFileSizeToCacheInBytes: 25000000,
});

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
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

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  serverExternalPackages: ['@proposalsapp/db'],
};

export default withSerwist(nextConfig);
