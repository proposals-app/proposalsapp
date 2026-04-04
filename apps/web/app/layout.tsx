import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '@/styles/globals.css';
import { WebVitals } from './web-vitals';
import { Suspense } from 'react';
import WalletProvider from './components/providers/wallet-provider';
import { firaMono, firaSans, firaSansCondensed } from '../lib/fonts';
import { Toaster } from './components/ui/sonner';
import { PostHogProvider } from './components/providers/posthog-provider';
import { SafariViewportProvider } from './components/providers/safari-viewport-provider';
import { AppThemeProvider } from './components/providers/app-theme-provider';
import {
  DEFAULT_THEME_VARIANT,
  getThemeColorEntries,
  THEME_MODE_COOKIE,
  THEME_SURFACE_COLORS,
} from '@/lib/theme';

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
  icons: {
    icon: '/favicon.ico',
  },
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
  themeColor: getThemeColorEntries(DEFAULT_THEME_VARIANT),
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
};

const themeInitializerScript = `!function(){try{var c=${JSON.stringify(THEME_SURFACE_COLORS)};var r=document.documentElement;var h=window.location.hostname.toLowerCase();var p=window.location.pathname;var s=p.split('/')[1];var o=h.split('.')[0];var v=s==='arbitrum'||s==='uniswap'?s:o==='arbitrum'||o==='uniswap'?o:'default';var m=document.cookie.match(/(?:^|; )${THEME_MODE_COOKIE}=([^;]+)/);var d=m&&decodeURIComponent(m[1])==='light'?'light':'dark';var color=c[v][d];r.classList.toggle('dark',d==='dark');r.setAttribute('data-theme',v);r.style.backgroundColor=color;r.style.colorScheme=d;var meta=document.querySelector('meta[name="theme-color"][data-active-theme="true"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';meta.setAttribute('data-active-theme','true');document.head.appendChild(meta);}meta.content=color;}catch(e){}}();`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      data-theme={DEFAULT_THEME_VARIANT}
      className={`dark ${firaSans.variable} ${firaSansCondensed.variable} ${firaMono.variable}`}
    >
      <body>
        <Script id='theme-initializer' strategy='beforeInteractive'>
          {themeInitializerScript}
        </Script>
        <AppThemeProvider>
          <Suspense fallback={null}>
            <SafariViewportProvider />
          </Suspense>
          <ProvidersTree>{children}</ProvidersTree>
        </AppThemeProvider>
      </body>
    </html>
  );
}

function ProvidersTree({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShell>{children}</AppShell>}>
      <PostHogProvider>
        <WebVitals />
        <NuqsAdapter>
          <Suspense
            fallback={
              <WalletProviderFallback>{children}</WalletProviderFallback>
            }
          >
            <WalletProvider>
              <main>{children}</main>
              <Toaster />
            </WalletProvider>
          </Suspense>
        </NuqsAdapter>
      </PostHogProvider>
    </Suspense>
  );
}

function WalletProviderFallback({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main>{children}</main>
      <Toaster />
    </>
  );
}
