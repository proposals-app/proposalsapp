'use client';

import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useState } from 'react';
import { useQueryState, parseAsInteger, parseAsBoolean } from 'nuqs';
import { BodyVersionType } from '../../actions';
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/app/components/ui/select';

// Helper component to display the time with a tooltip
export function PostedRevisions({ versions }: { versions: BodyVersionType[] }) {
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

  const handleVersionSelect = (index: string | number) => {
    const versionIndex = Number(index);
    setSelectedVersionIndex(versionIndex);
    setVersionQuery(versionIndex);
    setExpanded(true);
  };

  const latestVersion = versions[selectedVersionIndex];

  const relativeTime = formatDistanceToNow(new Date(latestVersion.createdAt), {
    addSuffix: true,
  });

  return (
    <div className='relative bg-white px-4 py-1 dark:bg-neutral-950'>
      <Select value={selectedVersionIndex} onValueChange={handleVersionSelect}>
        <SelectTrigger aria-label='Select version' withChevron={false}>
          <div className='dark:text-neutral-350 flex flex-col items-start text-xs text-neutral-600'>
            {' '}
            {/* Added items-start here */}
            <span>
              {latestVersion.type === 'topic'
                ? 'discourse revision'
                : latestVersion.type === 'onchain'
                  ? 'onchain revision'
                  : 'offchain revision'}
            </span>
            <span className='font-bold'>{relativeTime}</span>
          </div>
          <Image
            className='pl-1'
            src={`${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/edit-icon-posted-time.svg`}
            alt={''}
            width={24}
            height={24}
          />
        </SelectTrigger>
        <SelectContent>
          {versions.map((version, index) => (
            <SelectItem key={index} value={index}>
              {version.type === 'topic'
                ? `Discourse Version ${index + 1}`
                : version.type === 'onchain'
                  ? `Onchain Version ${index + 1}`
                  : `Offchain Version ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
