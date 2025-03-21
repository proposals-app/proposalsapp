import Link from 'next/link';
import Image from 'next/image';
import { HeaderClient } from './header-client';
import ArrowSvg from '@/public/assets/web/arrow.svg';

interface HeaderProps {
  groupId: string;
  withBack: boolean;
  withHide: boolean;
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
}

export async function Header({
  groupId,
  withBack,
  withHide,
  originalAuthorName,
  originalAuthorPicture,
  groupName,
}: HeaderProps) {
  if (withHide)
    return (
      <HeaderClient
        originalAuthorName={originalAuthorName}
        originalAuthorPicture={originalAuthorPicture}
        groupName={groupName}
        groupId={groupId}
        withBack={withBack}
      />
    );
  else
    return (
      <div
        className='border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 flex
          h-20 items-center border-b bg-neutral-50 px-3 transition-transform duration-300
          sm:px-4 md:left-20 md:px-6 dark:bg-neutral-900'
      >
        {withBack && (
          <Link
            href={`/${groupId}`}
            className='flex items-center gap-1 rounded-full px-2 py-2 sm:gap-2 sm:px-3'
            prefetch={true}
          >
            <ArrowSvg className='-rotate-90' width={20} height={20} />
            <span className='hidden text-xs font-medium sm:inline sm:text-sm'>
              Back
            </span>
          </Link>
        )}

        <div className='flex items-center gap-2 pl-2 sm:pl-4'>
          <div
            className='flex min-h-8 min-w-8 items-center justify-center overflow-hidden rounded-full
              border-2 border-neutral-700 sm:h-10 sm:w-10 dark:border-neutral-300'
          >
            <Image
              src={originalAuthorPicture}
              alt={originalAuthorName}
              className='object-cover'
              width={40}
              height={40}
            />
          </div>
          <h1 className='truncate text-base font-bold sm:text-lg'>
            {groupName}
          </h1>
        </div>
      </div>
    );
}
