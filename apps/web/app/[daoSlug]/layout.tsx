import { ReactNode } from 'react';
import { NavBar } from './components/nav-bar';

export default async function DaoLayout({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-screen w-full flex-row bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'>
      <NavBar />
      <div className='flex w-full pt-20 pl-0 md:pt-0 md:pl-20'>{children}</div>
    </div>
  );
}
