'use client';

import ArrowSvg from '@/public/assets/web/arrow.svg';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';

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

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  return (
    <div
      className={`border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 flex h-20 cursor-pointer items-center border-b bg-neutral-50 px-3 transition-transform duration-300 sm:px-4 md:left-20 md:px-6 dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
      onClick={scrollToTop}
    >
      {withBack && (
        <Link
          href={`/${groupId}`}
          className='flex items-center gap-2 rounded-full px-3 py-2'
        >
          <ArrowSvg className='-rotate-90' width={24} height={24} />
          <span className='hidden text-sm font-medium sm:block'>Back</span>
        </Link>
      )}

      <div className='flex items-center gap-2 pl-2 sm:pl-4'>
        <div className='flex min-h-8 min-w-8 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 sm:h-10 sm:w-10 dark:border-neutral-300'>
          <Image
            src={originalAuthorPicture}
            alt={originalAuthorName}
            className='object-cover'
            width={40}
            height={40}
          />
        </div>
        <h1 className='text-base font-bold sm:text-lg'>{groupName}</h1>
      </div>
    </div>
  );
}
