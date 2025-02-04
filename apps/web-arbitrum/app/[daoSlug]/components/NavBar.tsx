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
    <div className='border-neutral-350 fixed top-0 left-0 z-20 flex h-full min-h-screen w-20 flex-col items-center justify-between border-r bg-neutral-50 px-4 py-6'>
      <Link href={`/${daoSlug}`} className='h-10 w-10'>
        <Image
          src={`/${dao.picture}.svg`}
          alt={dao.name}
          width={64}
          height={64}
          className='rounded-sm'
        />
      </Link>
      <div className='flex flex-col gap-8 self-center'>
        <ModeToggle />

        <Image
          src={`/assets/logo.svg`}
          alt={'proposals.app'}
          width={32}
          height={46}
          className='rounded-sm'
        />
      </div>
    </div>
  );
}
