import { ModeToggle } from '@/app/components/theme-switch';
import Image from 'next/image';
import Link from 'next/link';

export function NavBar() {
  const DAO_PICTURE_PATH = 'assets/project-logos/arbitrum';
  const DAO_NAME = 'Arbitrum';

  return (
    <div
      className='border-neutral-350 dark:border-neutral-650 fixed top-0 left-0 z-20 flex h-full
        min-h-screen w-20 flex-col items-center justify-between border-r px-4 py-6'
    >
      <Link href={`/`} className='h-10 w-10'>
        <Image
          src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}.svg`}
          alt={DAO_NAME}
          width={64}
          height={64}
          className='rounded-sm dark:hidden'
        />
        <Image
          src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/${DAO_PICTURE_PATH}_dark.svg`}
          alt={DAO_NAME}
          width={64}
          height={64}
          className='hidden rounded-sm dark:block'
        />
      </Link>
      <div className='flex flex-col items-center gap-8'>
        <ModeToggle />

        <Image
          src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/logo.svg`}
          alt={'proposals.app'}
          width={48}
          height={48}
          className='rounded-sm dark:hidden'
        />
        <Image
          src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/logo_dark.svg`}
          alt={'proposals.app'}
          width={48}
          height={48}
          className='hidden rounded-sm dark:block'
        />
      </div>
    </div>
  );
}
