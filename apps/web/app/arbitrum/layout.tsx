import { ReactNode, Suspense } from 'react';
import Banner from '../components/banner';
import SuspendedThemeProvider from '../components/theme-provider';
import { NavBar } from './components/nav-bar';

export default async function ArbitrumLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SuspendedThemeProvider theme={'arbitrum'}>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense>
          <NavBar />
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
