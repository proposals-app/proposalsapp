import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { PHProvider } from './components/posthog-provider';
import SuspendedPostHogPageView from './components/posthog-page-view';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import SuspendedThemeProvider from './components/theme-provider';
import WalletProvider from './components/wallet-provider';
import { Toaster } from '@/components/ui/sonner';

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
  // A basic sticky maintenance header. You might want to add logic here
  // to conditionally render this header based on an environment variable or feature flag.
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'; // Example flag

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='preconnect' href='https://fonts.gstatic.com' />
        <link
          href='https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap'
          rel='stylesheet'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap'
          rel='stylesheet'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500;700&family=Fira+Sans+Condensed:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap'
          rel='stylesheet'
        />
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/manifest.json' />
      </head>
      <body>
        {isMaintenanceMode && (
          <div className='fixed top-0 left-0 z-[2000] w-full bg-red-500 p-1 text-center text-white'>
            Heads up! We&apos;re currently performing scheduled maintenance. You
            might experience temporary interruptions.
          </div>
        )}
        <SuspendedThemeProvider>
          <NuqsAdapter>
            <Suspense>
              <WebVitals />
            </Suspense>
            <SuspendedPostHogPageView />
            <Suspense>
              <PHProvider>
                <WalletProvider>
                  {/* Add padding to the main content if the maintenance header is visible */}
                  <main className={isMaintenanceMode ? 'pt-8' : ''}>
                    {children}
                  </main>
                  <Toaster />
                </WalletProvider>
              </PHProvider>
            </Suspense>
          </NuqsAdapter>
        </SuspendedThemeProvider>
      </body>
    </html>
  );
}
