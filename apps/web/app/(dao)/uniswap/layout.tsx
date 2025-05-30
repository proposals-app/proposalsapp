import { ReactNode, Suspense } from 'react';
import Banner from '@/app/components/banner';
import SuspendedThemeProvider from '@/app/components/theme-provider';
import { NavBar } from '../[daoSlug]/components/nav-bar';

export default async function UniswapLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SuspendedThemeProvider theme='uniswap'>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense>
          <NavBar daoSlug='uniswap' />
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
