import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import WalletProvider from './components/wallet-provider';
import { firaSans, firaSansCondensed, firaMono } from '../lib/fonts';
import { Toaster } from './components/ui/sonner';
import { PostHogProvider } from './components/posthog-provider';

const APP_NAME = 'proposals.app';
const APP_DEFAULT_TITLE = 'proposals.app';
const APP_TITLE_TEMPLATE = '%s - proposals.app';
const APP_DESCRIPTION =
  'The place where you can find all the \ud83d\udd25 and \ud83c\udf36 info from your favorite DAOs.';

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  icons: ['favicon.ico'],
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_DEFAULT_TITLE,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
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
        <PostHogProvider>
          <Suspense>
            <WebVitals />
          </Suspense>
          <Suspense>
            <NuqsAdapter>
              <WalletProvider>
                <main>
                  <Suspense>{children}</Suspense>
                </main>
                <Toaster />
              </WalletProvider>
            </NuqsAdapter>
          </Suspense>
        </PostHogProvider>
      </body>
    </html>
  );
}
