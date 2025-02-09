'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface HeaderClientProps {
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
  groupId: string;
  withBack: boolean;
}

export function HeaderClient({
  originalAuthorName,
  originalAuthorPicture,
  groupName,
  groupId,
  withBack,
}: HeaderClientProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      className={`border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 ml-20
        flex h-20 items-center border-b bg-neutral-50 px-6 transition-transform
        duration-300 dark:bg-neutral-900
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      {withBack && (
        <Link
          href={`/${groupId}`}
          className='flex items-center gap-2 rounded-full px-3 py-2'
          prefetch={true}
        >
          <ArrowLeft size={20} />
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
    </div>
  );
}
