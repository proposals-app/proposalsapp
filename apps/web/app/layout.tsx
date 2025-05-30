import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { PHProvider } from './components/posthog-provider';
import {
  PostHogIdentifier,
  PostHogPageView,
} from './components/posthog-page-view';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import WalletProvider from './components/wallet-provider';
import { firaSans, firaSansCondensed, firaMono } from '../lib/fonts';
import { Toaster } from './components/ui/sonner';

export const metadata: Metadata = {
  metadataBase: new URL('https://proposals.app'),
  title: 'proposals.app',
  applicationName: 'proposals.app',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'proposals.app',
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
        <Suspense>
          <WebVitals />
        </Suspense>
        <Suspense>
          <PostHogIdentifier />
        </Suspense>
        <Suspense>
          <PostHogPageView />
        </Suspense>
        <Suspense>
          <NuqsAdapter>
            <PHProvider>
              <WalletProvider>
                <main>
                  <Suspense>{children}</Suspense>
                </main>
                <Toaster />
              </WalletProvider>
            </PHProvider>
          </NuqsAdapter>
        </Suspense>
      </body>
    </html>
  );
}
