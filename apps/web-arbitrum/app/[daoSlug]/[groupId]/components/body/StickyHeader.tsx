'use client';

import * as Avatar from '@radix-ui/react-avatar';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BodiesDataType, GroupWithDataType } from '../../actions';

interface StickyHeaderProps {
  bodies: BodiesDataType;
  group: GroupWithDataType;
  version: number;
}

export function StickyHeader({ bodies, group, version }: StickyHeaderProps) {
  if (!group || !bodies) {
    notFound();
  }

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

  const title = bodies[version].title;
  const authorPicture = bodies[version].author_picture;
  const authorName = bodies[version].author_name;

  return (
    <div
      className={`fixed top-0 right-0 left-0 z-10 h-20 bg-neutral-50 shadow-md
        transition-transform duration-300 dark:bg-neutral-950
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <div className='mx-auto flex h-full w-full items-center px-6 lg:px-24'>
        <div className='flex flex-row items-center gap-4 md:pl-10 lg:pl-20'>
          <Avatar.Root className='h-10 w-10 overflow-hidden rounded-full'>
            <Avatar.Image
              src={authorPicture}
              alt={authorName}
              className='h-full w-full rounded-full object-cover'
              width={40}
              height={40}
            />
            <Avatar.Fallback
              className='flex h-full w-full items-center justify-center text-neutral-700
                dark:text-neutral-100'
            >
              {authorName.slice(0, 2)}
            </Avatar.Fallback>
          </Avatar.Root>
          <h1 className='text-lg font-bold text-neutral-700 dark:text-neutral-100'>
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
