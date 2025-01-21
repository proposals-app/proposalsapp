import { validateRequest } from '@/lib/auth';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';
import { PHProvider } from './providers/posthog-provider';
import { SessionProvider } from './providers/session-provider';

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

const PostHogPageView = dynamic(
  () => import('./providers/posthog-pageview'),
  {}
);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateRequest();

  return (
    <html lang='en' suppressHydrationWarning>
      <SessionProvider value={session}>
        <NuqsAdapter>
          <PHProvider>
            <body>
              <PostHogPageView />
              {children}
            </body>
          </PHProvider>
        </NuqsAdapter>
      </SessionProvider>
    </html>
  );
}
