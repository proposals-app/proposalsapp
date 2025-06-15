'use client';

import { formatDistanceToNow } from 'date-fns';
import { parseAsBoolean, parseAsInteger, useQueryState } from 'nuqs';
import React, { useState } from 'react';
import type { BodyVersionNoContentType } from '../../actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/app/components/ui/select';
import ChevronDown from '@/public/assets/web/icons/chevron-down.svg';
export function PostedRevisions({ versions }: { versions: BodyVersionNoContentType[] }) {
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
    <div className='relative w-[180px] bg-white p-2 dark:bg-neutral-950'>
      <Select value={selectedVersionIndex} onValueChange={handleVersionSelect}>
        <SelectTrigger
          aria-label='Select version'
          withChevron={false}
          className='w-full'
        >
          <div className='dark:text-neutral-350 flex flex-col items-start text-xs text-neutral-600'>
            <span className='truncate'>
              {latestVersion.type === 'topic'
                ? 'discourse revision'
                : latestVersion.type === 'onchain'
                  ? 'onchain revision'
                  : 'offchain revision'}
            </span>
            <span className='truncate font-bold'>{relativeTime}</span>
          </div>
          <ChevronDown className='ml-2 flex-shrink-0' />
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
