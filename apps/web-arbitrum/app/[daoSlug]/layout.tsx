import { db } from '@proposalsapp/db';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import { NavBar } from './components/NavBar';
import { ThemeProvider } from '../components/theme-provider';
import { ModeToggle } from '../components/theme-switch';
import { UpdateManifest } from '../components/update-manifest';

// Define a cached function to fetch the DAO data
const getDaoBySlug = unstable_cache(
  async (daoSlug: string) => {
    return await db
      .selectFrom('dao')
      .where('slug', '=', daoSlug)
      .selectAll()
      .executeTakeFirst();
  },
  ['dao-by-slug'],
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
      <div className='absolute right-4 top-4 z-50'>
        <ModeToggle />
      </div>
      <div className='bg-red flex min-h-screen w-full flex-row bg-neutral-50 dark:bg-neutral-950'>
        <NavBar dao={dao} daoSlug={daoSlug} />
        <div className='flex w-full justify-between'>{children}</div>
      </div>
    </ThemeProvider>
  );
}
