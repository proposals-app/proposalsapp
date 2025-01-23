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
      className='fixed left-0 top-0 z-20 flex min-h-screen w-20 flex-col items-center border-r
        border-neutral-350 bg-neutral-200 p-4 dark:border-neutral-700
        dark:bg-neutral-800'
    >
      <Link href={`/${daoSlug}`}>
        <Image
          src={`/${dao.picture}_large.png`}
          alt={dao.name}
          width={64}
          height={64}
          className='rounded-sm'
        />
      </Link>
    </div>
  );
}
