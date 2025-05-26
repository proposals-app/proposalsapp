import { ModeToggle } from '@/app/components/theme-switch';
import Image from 'next/image';
import Link from 'next/link';
import List from '@/public/assets/web/icons/proposals.svg';
import Delegate from '@/public/assets/web/icons/delegates.svg';
import { Suspense } from 'react';
import { cookies } from 'next/headers';

export async function NavBar() {
  const DAO_PICTURE_PATH = 'assets/project-logos/uniswap';
  const DAO_NAME = 'Uniswap';

  const cookieStore = await cookies();

  const theme =
    (cookieStore.get('theme-mode')?.value as 'light' | 'dark') ?? 'dark';

  return (
    <div className='fill-neutral-800 dark:fill-neutral-200'>
      {/* Mobile navbar (top) */}
      <div className='border-neutral-350 dark:border-neutral-650 fixed top-0 left-0 z-20 flex h-16 w-full items-center justify-between border-b bg-neutral-50 px-4 md:hidden dark:bg-neutral-900'>
        <Link
          href={`/`}
          prefetch
          className='flex h-10 w-10 items-center justify-center'
        >
          <Image
            src={`/${DAO_PICTURE_PATH}.svg`}
            alt={DAO_NAME}
            width={32}
            height={32}
            className='dark:hidden'
          />
          <Image
            src={`/${DAO_PICTURE_PATH}_dark.svg`}
            alt={DAO_NAME}
            width={32}
            height={32}
            className='hidden dark:block'
          />
        </Link>

        <div className='flex items-center gap-6'>
          <Link
            href={`/`}
            prefetch
            className='flex items-center justify-center'
          >
            <div className='flex items-center justify-center'>
              <List className='h-12 w-12' />
            </div>
          </Link>

          <Link
            href={`/profile`}
            prefetch
            className='flex items-center justify-center'
          >
            <div className='flex items-center justify-center'>
              <Delegate className='h-12 w-12' />
            </div>
          </Link>

          <div className='flex h-10 items-center justify-center'>
            <Suspense>
              <ModeToggle initialTheme={theme} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Desktop navbar (left side) */}
      <div className='border-neutral-350 dark:border-neutral-650 fixed top-0 left-0 z-20 hidden h-full min-h-screen w-20 flex-col items-center justify-between border-r px-4 py-6 md:flex'>
        <div className='flex flex-col items-center justify-center gap-8'>
          <Link href={`/`} prefetch className='mb-8 h-12 w-12'>
            <Image
              src={`/${DAO_PICTURE_PATH}.svg`}
              alt={DAO_NAME}
              width={64}
              height={64}
              className='dark:hidden'
            />
            <Image
              src={`/${DAO_PICTURE_PATH}_dark.svg`}
              alt={DAO_NAME}
              width={64}
              height={64}
              className='hidden dark:block'
            />
          </Link>

          <Link
            href={`/`}
            prefetch
            className='flex items-center justify-center'
          >
            <List className='h-12 w-12' />
          </Link>

          <Link
            href={`/profile`}
            prefetch
            className='flex items-center justify-center'
          >
            <Delegate className='h-12 w-12' />
          </Link>
        </div>
        <div className='flex flex-col items-center gap-8'>
          <Suspense>
            <ModeToggle initialTheme={theme} />
          </Suspense>

          <Image
            src={`/assets/logo.svg`}
            alt={'proposals.app'}
            width={48}
            height={48}
            className='dark:hidden'
          />
          <Image
            src={`/assets/logo_dark.svg`}
            alt={'proposals.app'}
            width={48}
            height={48}
            className='hidden dark:block'
          />
        </div>
      </div>
    </div>
  );
}
