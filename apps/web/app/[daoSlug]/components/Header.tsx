import Link from 'next/link';
import Image from 'next/image';
import { getGroupAuthor_cached } from '../actions';
import { HeaderClient } from './HeaderClient';
import { Suspense } from 'react';
import ArrowSvg from '@/public/assets/web/arrow.svg';
import { unstable_ViewTransition as ViewTransition } from 'react';

interface HeaderProps {
  groupId: string;
  withBack: boolean;
  withHide: boolean;
}

export async function Header({ groupId, withBack, withHide }: HeaderProps) {
  const { originalAuthorName, originalAuthorPicture, groupName } =
    await getGroupAuthor_cached(groupId);

  if (withHide)
    return (
      <Suspense>
        <ViewTransition name={`header`}>
          <HeaderClient
            originalAuthorName={originalAuthorName}
            originalAuthorPicture={originalAuthorPicture}
            groupName={groupName}
            groupId={groupId}
            withBack={withBack}
          />
        </ViewTransition>
      </Suspense>
    );
  else
    return (
      <ViewTransition name={`header`}>
        <div
          className={`border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 ml-20
            flex h-20 items-center border-b bg-neutral-50 px-6 transition-transform
            duration-300 dark:bg-neutral-900`}
        >
          {withBack && (
            <Link
              href={`/${groupId}`}
              className='flex items-center gap-2 rounded-full px-3 py-2'
              prefetch={true}
            >
              <ArrowSvg className='-rotate-90' width={24} height={24} />
              <span className='text-sm font-medium'>Back</span>
            </Link>
          )}

          <div className={'flex items-center gap-2 pl-12'}>
            <div
              className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2
                border-neutral-700 dark:border-neutral-300'
            >
              <Image
                src={originalAuthorPicture}
                alt={originalAuthorName}
                className='object-cover'
                width={40}
                height={40}
              />
            </div>
            <h1 className='text-lg font-bold'>{groupName}</h1>
          </div>
        </div>{' '}
      </ViewTransition>
    );
}
