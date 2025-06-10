import { Suspense, type ReactNode } from 'react';
import Banner from '@/app/components/consent/cookie-banner';
import { ThemeProvider } from '@/app/components/providers/theme-provider';
import { NavBar } from '../[daoSlug]/components/navigation/nav-bar';

export default async function UniswapLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme='uniswap'>
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
    </ThemeProvider>
  );
}
