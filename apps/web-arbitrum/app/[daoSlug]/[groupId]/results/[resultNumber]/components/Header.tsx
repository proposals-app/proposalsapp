import * as Avatar from '@radix-ui/react-avatar';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
      className='fixed left-0 right-0 top-0 z-50 ml-20 flex h-20 items-center gap-4 bg-neutral-50
        px-6 shadow-md dark:bg-neutral-950'
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
        <Avatar.Root className='h-10 w-10 overflow-hidden rounded-full'>
          <Avatar.Image
            src={authorPicture}
            alt={authorName}
            className='h-full w-full object-cover'
          />
          <Avatar.Fallback className='flex h-full w-full items-center justify-center'>
            {authorName.slice(0, 2)}
          </Avatar.Fallback>
        </Avatar.Root>
        <h1 className='text-lg font-bold'>{proposalName}</h1>
      </div>
    </div>
  );
}
