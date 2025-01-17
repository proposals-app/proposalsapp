'use client';

import { notFound } from 'next/navigation';
import { BodiesDataType, GroupWithDataType } from '../../actions';
import { useEffect, useState } from 'react';
import * as Avatar from '@radix-ui/react-avatar';

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
      className={`fixed left-0 right-0 top-0 z-10 h-20 shadow-md transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
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
            <Avatar.Fallback className='flex h-full w-full items-center justify-center'>
              {authorName.slice(0, 2)}
            </Avatar.Fallback>
          </Avatar.Root>
          <h1 className='text-lg font-bold'>{title}</h1>
        </div>
      </div>
    </div>
  );
}
