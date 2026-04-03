import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import List from '@/public/assets/web/icons/proposals.svg';
import Delegate from '@/public/assets/web/icons/delegates.svg';
import { ModeToggle } from './theme-switch';
import { SkeletonModeToggle } from '@/app/components/ui/skeleton';

interface NavBarContentProps {
  daoSlug: string;
  initialTheme: 'light' | 'dark';
  layout?: 'fixed' | 'static';
}

export function NavBarContent({
  daoSlug,
  initialTheme,
  layout = 'fixed',
}: NavBarContentProps) {
  const daoPicturePath = daoSlug
    ? `assets/project-logos/${daoSlug}`
    : '/assets/logo';
  const mobileShellClassName =
    layout === 'fixed'
      ? 'fixed left-0 top-0'
      : 'relative';
  const desktopShellClassName =
    layout === 'fixed'
      ? 'fixed left-0 top-0'
      : 'relative';

  return (
    <div className='fill-neutral-800 dark:fill-neutral-200'>
      <div
        className={`${mobileShellClassName} z-20 flex h-16 w-full items-center justify-between border-b border-neutral-350 bg-neutral-50 px-4 dark:border-neutral-650 dark:bg-neutral-900 md:hidden`}
      >
        <Link
          href='/'
          prefetch
          className='flex h-10 w-10 items-center justify-center'
        >
          <Image
            src={`/${daoPicturePath}.svg`}
            width={32}
            height={32}
            priority
            className='dark:hidden'
            alt=''
          />
          <Image
            src={`/${daoPicturePath}_dark.svg`}
            width={32}
            height={32}
            priority
            className='hidden dark:block'
            alt=''
          />
        </Link>

        <div className='flex items-center gap-6'>
          <Link href='/' prefetch className='flex items-center justify-center'>
            <div className='flex items-center justify-center'>
              <List className='h-12 w-12' />
            </div>
          </Link>

          <Link
            href='/profile'
            prefetch
            className='flex items-center justify-center'
          >
            <div className='flex items-center justify-center'>
              <Delegate className='h-12 w-12' />
            </div>
          </Link>

          <div className='flex h-10 items-center justify-center'>
            <Suspense fallback={<SkeletonModeToggle />}>
              <ModeToggle initialTheme={initialTheme} />
            </Suspense>
          </div>
        </div>
      </div>

      <div
        className={`${desktopShellClassName} z-20 hidden h-full min-h-screen w-20 flex-col items-center justify-between border-r border-neutral-350 px-4 py-6 dark:border-neutral-650 md:flex`}
      >
        <div className='flex flex-col items-center justify-center gap-8'>
          <Link href='/' prefetch className='mb-8 h-12 w-12'>
            <Image
              src={`/${daoPicturePath}.svg`}
              width={64}
              height={64}
              priority
              className='dark:hidden'
              alt=''
            />
            <Image
              src={`/${daoPicturePath}_dark.svg`}
              width={64}
              height={64}
              priority
              className='hidden dark:block'
              alt=''
            />
          </Link>

          <Link href='/' prefetch className='flex items-center justify-center'>
            <List className='h-12 w-12' />
          </Link>

          <Link
            href='/profile'
            prefetch
            className='flex items-center justify-center'
          >
            <Delegate className='h-12 w-12' />
          </Link>
        </div>
        <div className='flex flex-col items-center gap-8'>
          <Suspense fallback={<SkeletonModeToggle />}>
            <ModeToggle initialTheme={initialTheme} />
          </Suspense>

          <Image
            src='/assets/logo.svg'
            alt='proposals.app'
            width={48}
            height={48}
            className='dark:hidden'
          />
          <Image
            src='/assets/logo_dark.svg'
            alt='proposals.app'
            width={48}
            height={48}
            className='hidden dark:block'
          />
        </div>
      </div>
    </div>
  );
}
