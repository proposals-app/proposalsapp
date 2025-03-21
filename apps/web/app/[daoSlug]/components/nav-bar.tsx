import { ModeToggle } from '@/app/components/theme-switch';
import Image from 'next/image';
import Link from 'next/link';
import List from '@/public/assets/web/list_navbar.svg';
import Profile from '@/public/assets/web/profile_navbar.svg';

export function NavBar() {
  const DAO_PICTURE_PATH = 'assets/project-logos/arbitrum';
  const DAO_NAME = 'Arbitrum';

  return (
    <div className='fill-neutral-800 dark:fill-neutral-200'>
      {/* Mobile navbar (top) */}
      <div
        className='border-neutral-350 dark:border-neutral-650 fixed top-0 left-0 z-20 flex h-16
          w-full items-center justify-between border-b bg-neutral-50 px-4 md:hidden
          dark:bg-neutral-900'
      >
        <Link
          href={`/`}
          className='flex h-10 w-10 items-center justify-center'
          prefetch={true}
        >
          <Image
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}.svg`}
            alt={DAO_NAME}
            width={32}
            height={32}
            className='dark:hidden'
          />
          <Image
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}_dark.svg`}
            alt={DAO_NAME}
            width={32}
            height={32}
            className='hidden dark:block'
          />
        </Link>

        <div className='flex items-center gap-6'>
          <Link
            href={`/`}
            className='flex items-center justify-center'
            prefetch={true}
          >
            <div className='flex h-8 w-8 items-center justify-center'>
              <List className='h-8 w-8' />
            </div>
          </Link>

          <Link
            href={`/profile`}
            className='flex items-center justify-center'
            prefetch={true}
          >
            <div className='flex h-8 w-8 items-center justify-center'>
              <Profile className='h-8 w-8' />
            </div>
          </Link>

          <div className='flex h-10 items-center justify-center'>
            <ModeToggle />
          </div>
        </div>
      </div>

      {/* Desktop navbar (left side) */}
      <div
        className='border-neutral-350 dark:border-neutral-650 fixed top-0 left-0 z-20 hidden h-full
          min-h-screen w-20 flex-col items-center justify-between border-r px-4 py-6
          md:flex'
      >
        <div className='flex flex-col items-center justify-center gap-8'>
          <Link href={`/`} className='mb-8 h-12 w-12' prefetch={true}>
            <Image
              src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}.svg`}
              alt={DAO_NAME}
              width={64}
              height={64}
              className='dark:hidden'
            />
            <Image
              src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}_dark.svg`}
              alt={DAO_NAME}
              width={64}
              height={64}
              className='hidden dark:block'
            />
          </Link>

          <Link
            href={`/`}
            className='flex h-12 w-12 items-center justify-center'
            prefetch={true}
          >
            <List className='h-12 w-12' />
          </Link>

          <Link
            href={`/profile`}
            className='flex h-12 w-12 items-center justify-center'
            prefetch={true}
          >
            <Profile className='h-12 w-12' />
          </Link>
        </div>
        <div className='flex flex-col items-center gap-8'>
          <ModeToggle />

          <Image
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/logo.svg`}
            alt={'proposals.app'}
            width={48}
            height={48}
            className='dark:hidden'
          />
          <Image
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/logo_dark.svg`}
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
