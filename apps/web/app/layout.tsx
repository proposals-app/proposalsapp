import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import WalletProvider from './components/providers/wallet-provider';
import { firaMono, firaSans, firaSansCondensed } from '../lib/fonts';
import { Toaster } from './components/ui/sonner';
import { PostHogProvider } from './components/providers/posthog-provider';
import { SafariViewportProvider } from './components/providers/safari-viewport-provider';

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'proposals.app';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${rootDomain}`),
  title: rootDomain,
  applicationName: rootDomain,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: rootDomain,
  },
  description:
    'The place where you can find all the \ud83d\udd25 and \ud83c\udf36 info from your favorite DAOs.',
  icons: ['favicon.ico'],
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: 'dark',
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={`${firaSans.variable} ${firaSansCondensed.variable} ${firaMono.variable}`}
    >
      <head>
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/manifest.json' />
      </head>
      <body>
        <SafariViewportProvider>
          <Suspense>
            <PostHogProvider>
              <Suspense>
                <WebVitals />
              </Suspense>
              <Suspense>
                <NuqsAdapter>
                  <WalletProvider>
                    <main>{children}</main>
                    <Toaster />
                  </WalletProvider>
                </NuqsAdapter>
              </Suspense>
            </PostHogProvider>
          </Suspense>
        </SafariViewportProvider>
      </body>
    </html>
  );
}
