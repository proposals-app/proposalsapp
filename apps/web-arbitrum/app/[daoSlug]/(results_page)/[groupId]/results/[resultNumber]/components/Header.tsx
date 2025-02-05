import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ResultsHeaderProps {
  authorName: string;
  authorPicture: string;
  proposalName: string;
  daoSlug: string;
  itemId: string;
}

export function Header({
  authorName,
  authorPicture,
  proposalName,
  daoSlug,
  itemId,
}: ResultsHeaderProps) {
  return (
    <div
      className='fixed top-0 right-0 left-0 z-50 ml-20 flex h-20 items-center gap-4 bg-neutral-50
        px-6 shadow-md'
    >
      <Link
        href={`/${daoSlug}/${itemId}`}
        className='flex items-center gap-2 rounded-full px-3 py-2'
        prefetch={true}
      >
        <ArrowLeft size={20} />
        <span className='text-sm font-medium'>Back</span>
      </Link>

      <div className='flex items-center gap-2'>
        <div className='h-10 w-10 overflow-hidden rounded-full'>
          <Image
            src={authorPicture}
            alt={authorName}
            className='object-cover'
            width={40}
            height={40}
          />
        </div>
        <h1 className='text-lg font-bold'>{proposalName}</h1>
      </div>
    </div>
  );
}
