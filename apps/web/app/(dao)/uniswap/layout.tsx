import { Suspense, type ReactNode } from 'react';
import Banner from '@/app/components/consent/cookie-banner';
import { ThemeProvider } from '@/app/components/providers/theme-provider';
import { NavBar } from '../[daoSlug]/components/navigation/nav-bar';

// Minimal skeleton for navbar while loading
function NavBarSkeleton() {
  return (
    <>
      {/* Mobile navbar skeleton */}
      <div className='fixed left-0 top-0 z-20 flex h-16 w-full items-center justify-between border-b border-neutral-350 bg-neutral-50 px-4 dark:border-neutral-650 dark:bg-neutral-900 md:hidden'>
        <div className='h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700' />
        <div className='flex gap-4'>
          <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
      {/* Desktop navbar skeleton */}
      <div className='fixed left-0 top-0 z-20 hidden h-full w-20 flex-col items-center justify-between border-r border-neutral-350 bg-neutral-50 py-6 dark:border-neutral-650 dark:bg-neutral-900 md:flex'>
        <div className='flex flex-col items-center gap-8'>
          <div className='h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          <div className='h-6 w-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
        </div>
      </div>
    </>
  );
}

export default async function UniswapLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme='uniswap'>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense fallback={<NavBarSkeleton />}>
          <NavBar daoSlug='uniswap' />
        </Suspense>
        <div className='flex w-full pl-0 pt-20 md:pl-20 md:pt-0'>
          {children}
        </div>
        <Suspense fallback={null}>
          <Banner />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}
