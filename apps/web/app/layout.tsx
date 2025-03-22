import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { PHProvider } from './components/posthog-provider';
import SuspendedPostHogPageView from './components/posthog-page-view';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import Banner from './components/banner';
import { ThemeProvider } from './components/theme-provider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? 'https://proposals.app'),
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
  authors: [
    { name: 'Paulo Fonseca', url: 'https://paulofonseca.com' },
    {
      name: 'Andrei Voinea',
      url: 'https://andreiv.com',
    },
  ],
};

export const viewport: Viewport = {
  themeColor: 'light',
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
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel='icon' href='/favicon.ico' />
      </head>
      <body>
        <NuqsAdapter>
          <ThemeProvider>
            <Suspense>
              <WebVitals />
            </Suspense>

            <SuspendedPostHogPageView />

            <Suspense>
              <PHProvider>{children}</PHProvider>
            </Suspense>

            <Suspense>
              <Banner />
            </Suspense>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
