import { Suspense, type ReactNode } from 'react';
import { NavBar } from './components/navigation/nav-bar';
import { ThemeProvider } from '@/app/components/providers/theme-provider';
import Banner from '@/app/components/consent/cookie-banner';

export default function DaoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ daoSlug: string }>;
}) {
  // Avoid awaiting params at the top level so the shell can stream
  return (
    <Suspense
      fallback={<DaoLayoutFallback daoSlug=''>{children}</DaoLayoutFallback>}
    >
      <DaoLayoutContent params={params}>{children}</DaoLayoutContent>
    </Suspense>
  );
}

function DaoLayoutFallback({
  children,
  daoSlug,
}: {
  children: ReactNode;
  daoSlug: string;
}) {
  return (
    <div className='dark' data-theme={daoSlug}>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense>
          <NavBar daoSlug={daoSlug} />
        </Suspense>
        <div className='flex w-full pl-0 pt-20 md:pl-20 md:pt-0'>
          {children}
        </div>
        <Suspense>
          <Banner />
        </Suspense>
      </div>
    </div>
  );
}

async function DaoLayoutContent({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  return (
    <ThemeProvider theme={daoSlug}>
      <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
        <Suspense>
          <NavBar daoSlug={daoSlug} />
        </Suspense>
        <div className='flex w-full pl-0 pt-20 md:pl-20 md:pt-0'>
          {children}
        </div>
        <Suspense>
          <Banner />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}
