import { ReactNode, Suspense } from 'react';
import { NavBar } from './components/nav-bar';
import SuspendedThemeProvider from '@/app/components/theme-provider';
import Banner from '@/app/components/banner';

export default async function DaoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  return (
    <SuspendedThemeProvider theme={daoSlug}>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense>
          <NavBar daoSlug={daoSlug} />
        </Suspense>
        <div className='flex w-full pt-20 pl-0 md:pt-0 md:pl-20'>
          {children}
        </div>
        <Suspense>
          <Banner />
        </Suspense>
      </div>
    </SuspendedThemeProvider>
  );
}
