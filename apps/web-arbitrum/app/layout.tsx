import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';
import Head from 'next/head';
import { PostHogProvider } from './components/posthog-provider';
import SuspendedPostHogPageView from './components/PostHogPageView';

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <PostHogProvider>
        <SuspendedPostHogPageView />
        <Head>
          <link rel='icon' href='/favicon.ico' />
        </Head>
        <body>
          <NuqsAdapter>{children}</NuqsAdapter>
        </body>
      </PostHogProvider>
    </html>
  );
}
