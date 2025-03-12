import { db } from '@proposalsapp/db-indexer';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { ReactNode, Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { ThemeProvider } from '../components/theme-provider';
import { UpdateManifest } from '../components/update-manifest';
import Banner from '../components/Banner';
import { unstable_ViewTransition as ViewTransition } from 'react';

// Define a cached function to fetch the DAO data
const getDaoBySlug = unstable_cache(
  async (daoSlug: string) => {
    return await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();
  },
  ['dao'],
  { revalidate: 3600, tags: ['dao'] } // Cache for 1 hour
);

export default async function DaoLayout({
  params,
  children,
}: {
  params: Promise<{ daoSlug: string }>;
  children: ReactNode;
}) {
  const { daoSlug } = await params;

  // Fetch the DAO using the cached function
  const dao = await getDaoBySlug(daoSlug);

  if (!dao) {
    notFound();
  }

  return (
    <ThemeProvider daoSlug={daoSlug}>
      <UpdateManifest daoSlug={daoSlug} />
      <ViewTransition>
        <div
          className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700
            dark:bg-neutral-900 dark:text-neutral-300'
        >
          <NavBar dao={dao} />
          <div className='flex w-full pl-20'>{children}</div>
        </div>
        <Suspense>
          <Banner />
        </Suspense>
      </ViewTransition>
    </ThemeProvider>
  );
}
