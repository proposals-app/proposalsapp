import { ModeToggle } from '@/app/components/theme-switch';
import Image from 'next/image';
import Link from 'next/link';

interface NavBarProps {
  dao: {
    name: string;
    picture: string;
  };
  daoSlug: string;
}

export function NavBar({ daoSlug, dao }: NavBarProps) {
  return (
    <div
      className='border-neutral-350 fixed top-0 left-0 z-20 flex h-full min-h-screen w-20
        flex-col items-center justify-between border-r bg-neutral-200 p-2
        dark:border-neutral-700 dark:bg-neutral-800'
    >
      <Link href={`/${daoSlug}`} className='h-16 w-16'>
        <Image
          src={`/${dao.picture}_large.png`}
          alt={dao.name}
          width={64}
          height={64}
          className='rounded-sm'
        />
      </Link>
      <div className='self-center'>
        <ModeToggle />
      </div>
    </div>
  );
}
