import { ReactNode, Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { ThemeProvider } from '../components/theme-provider';
import { UpdateManifest } from '../components/update-manifest';
import Banner from '../components/Banner';

export default async function DaoLayout({
  params,
  children,
}: {
  params: Promise<{ daoSlug: string }>;
  children: ReactNode;
}) {
  const { daoSlug } = await params;

  return (
    <ThemeProvider daoSlug={daoSlug}>
      <UpdateManifest daoSlug={daoSlug} />
      <div
        className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700
          dark:bg-neutral-900 dark:text-neutral-300'
      >
        <NavBar />
        <div className='flex w-full pl-20'>{children}</div>
      </div>
      <Banner />
    </ThemeProvider>
  );
}
