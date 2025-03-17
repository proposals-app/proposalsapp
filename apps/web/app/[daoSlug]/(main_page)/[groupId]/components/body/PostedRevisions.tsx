'use client';

import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useState } from 'react';
import { useQueryState, parseAsInteger, parseAsBoolean } from 'nuqs';
import { BodyVersionType } from '../../actions';
import CheckSvg from '@/public/assets/web/check.svg';

// Helper component to display the time with a tooltip
export function PostedRevisions({ versions }: { versions: BodyVersionType[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(
    versions.length - 1
  );
  const [, setVersionQuery] = useQueryState(
    'version',
    parseAsInteger
      .withDefault(versions.length - 1)
      .withOptions({ shallow: false })
  );

  const [, setExpanded] = useQueryState(
    'expanded',
    parseAsBoolean.withDefault(false)
  );

  const handleVersionSelect = (index: number) => {
    setSelectedVersionIndex(index);
    setVersionQuery(index);
    setExpanded(true);
    setIsOpen(false);
  };

  const latestVersion = versions[selectedVersionIndex];

  const relativeTime = formatDistanceToNow(new Date(latestVersion.createdAt), {
    addSuffix: true,
  });

  return (
    <div className='relative'>
      <div
        className={`flex cursor-pointer flex-row items-center justify-center gap-2 bg-white px-2
          py-1 dark:bg-neutral-950`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className='dark:text-neutral-350 flex flex-col text-xs text-neutral-600'>
          <span className=''>
            {latestVersion.type === 'topic'
              ? 'discourse revision'
              : latestVersion.type === 'onchain'
                ? 'onchain revision'
                : 'offchain revision'}
          </span>
          <span className='font-bold'>{relativeTime}</span>
        </div>

        <Image
          src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/edit-icon-posted-time.svg`}
          alt={''}
          width={24}
          height={24}
        />
      </div>
      {isOpen && (
        <div
          className='ring-opacity-5 absolute right-0 z-[999] mt-2 w-48 bg-white py-1 ring-1
            ring-black focus:outline-none dark:bg-neutral-800'
        >
          {versions.map((version, index) => (
            <div
              key={index}
              className={`flex cursor-pointer justify-between px-4 py-2 text-sm hover:bg-gray-100
              dark:hover:bg-neutral-700 ${
              index === selectedVersionIndex ? 'font-semibold' : '' }`}
              onClick={() => handleVersionSelect(index)}
            >
              {version.type === 'topic'
                ? `Discourse Version ${index + 1}`
                : version.type === 'onchain'
                  ? `Onchain Version ${index + 1}`
                  : `Offchain Version ${index + 1}`}

              {index === selectedVersionIndex && (
                <CheckSvg
                  className='fill-neutral-800 dark:fill-neutral-200'
                  width={24}
                  height={24}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
