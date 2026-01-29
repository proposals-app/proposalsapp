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
import { headers } from 'next/headers';

export const metadata: Metadata = {
  // Use production base by default; Next can override per-request in advanced setups
  metadataBase: new URL(process.env.WEB_URL || `https://proposals.app`),
  title: {
    template: '%s | proposals.app',
    default: 'proposals.app',
  },
  applicationName: 'proposals.app',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'proposals.app',
  },
  description:
    'The place where you can find all the info from your favorite DAOs.',
  icons: ['favicon.ico'],
  manifest: '/manifest.json',
  twitter: {
    card: 'summary_large_image',
    title: 'proposals.app',
    description: 'The place for DAO governance',
  },
  openGraph: {
    type: 'website',
    title: 'proposals.app',
    description: 'The place for DAO governance',
    siteName: 'proposals.app',
  },
};

export const viewport: Viewport = {
  themeColor: 'dark',
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Theme is initialized via client-side script to avoid FOUC
  // Server-side cookie reading removed - let the inline script handle it
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={`${firaSans.variable} ${firaSansCondensed.variable} ${firaMono.variable}`}
    >
      <head>
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/manifest.json' />
        {/* Apply theme class ASAP to avoid FOUC before React hydration */}
        <script
          id='theme-initializer'
          dangerouslySetInnerHTML={{
            __html: `!function(){try{var m=document.cookie.match(/(?:^|; )theme-mode=([^;]+)/);var v=document.cookie.match(/(?:^|; )theme-variant=([^;]+)/);if(m){var mode=decodeURIComponent(m[1]);if(mode==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}if(v){document.documentElement.setAttribute('data-theme', decodeURIComponent(v[1]));}}catch(e){}}();`,
          }}
        />
      </head>
      <body>
        <SafariViewportProvider>
          {/* Stream a lightweight shell immediately; hydrate providers inside Suspense */}
          <Suspense
            fallback={<ProvidersFallback>{children}</ProvidersFallback>}
          >
            <ProvidersWithRequest>{children}</ProvidersWithRequest>
          </Suspense>
        </SafariViewportProvider>
      </body>
    </html>
  );
}

async function ProvidersWithRequest({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read headers dynamically without blocking the outer shell
  const headersList = await headers();
  const cookie = headersList.get('cookie');

  return (
    <PostHogProvider>
      <Suspense>
        <WebVitals />
      </Suspense>
      <Suspense>
        <NuqsAdapter>
          <WalletProvider cookie={cookie}>
            <main>{children}</main>
            <Toaster />
          </WalletProvider>
        </NuqsAdapter>
      </Suspense>
    </PostHogProvider>
  );
}

function ProvidersFallback({ children }: { children: React.ReactNode }) {
  // Render the same structure without awaiting Request data
  return (
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
  );
}
