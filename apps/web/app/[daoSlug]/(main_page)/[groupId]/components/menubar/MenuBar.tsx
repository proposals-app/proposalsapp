'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { BodyViewBar } from './BodyViewBar';
import { CommentsViewBar } from './CommentsViewBar';
import { FullViewBar } from './FullViewBar';
import * as Select from '@radix-ui/react-select';
import CheckSvg from '@/public/assets/web/check.svg';
import React, { useState } from 'react';
import { VersionType } from '../../actions';
import ChevronDownSvg from '@/public/assets/web/chevron_down.svg';

// Optimized SelectItem component for Safari
export const SharedSelectItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; value: string }
>(({ children, value, ...props }, forwardedRef) => {
  return (
    <Select.Item
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm
        text-neutral-800 transition-colors will-change-transform outline-none
        hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
      {...props}
      ref={forwardedRef}
      value={value}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className='absolute right-2'>
        <CheckSvg
          className='fill-neutral-800 dark:fill-neutral-200'
          width={24}
          height={24}
        />
      </Select.ItemIndicator>
    </Select.Item>
  );
});
SharedSelectItem.displayName = 'SharedSelectItem';

// Safari-optimized SelectTrigger component for reuse
export const SelectTrigger = ({
  children,
  className = '',
  ...props
}: Select.SelectTriggerProps) => (
  <Select.Trigger
    className={`flex h-8 cursor-pointer items-center justify-between rounded-xs px-3 text-sm
      outline-none ${className}`}
    {...props}
  >
    {children}
    <Select.Icon>
      <ChevronDownSvg width={24} height={24} className='opacity-70' />
    </Select.Icon>
  </Select.Trigger>
);
SelectTrigger.displayName = 'SelectTrigger';

// Safari-optimized SelectContent component for reuse
export const SelectContent = ({
  children,
  className = '',
  ...props
}: Select.SelectContentProps) => (
  <Select.Content
    className={`dark:border-neutral-450 z-[999] translate-z-0 overflow-hidden rounded-xs border
      border-neutral-800 bg-white p-1 shadow-lg will-change-transform
      dark:bg-neutral-950 ${className}`}
    position='popper'
    sideOffset={5}
    sticky='always'
    {...props}
  >
    <Select.Viewport className='p-1'>{children}</Select.Viewport>
  </Select.Content>
);
SelectContent.displayName = 'SelectContent';

export const voteFilters = [
  {
    value: VotesFilterEnum.ALL,
    label: 'with any ARB',
  },
  {
    value: VotesFilterEnum.FIFTY_THOUSAND,
    label: 'above 50k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_HUNDRED_THOUSAND,
    label: 'above 500k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_MILLION,
    label: 'above 5m ARB',
  },
];

export const feedFilters = [
  {
    value: FeedFilterEnum.COMMENTS_AND_VOTES,
    label: 'Comments and Votes',
  },
  {
    value: FeedFilterEnum.COMMENTS,
    label: 'Only Comments',
  },
  {
    value: FeedFilterEnum.VOTES,
    label: 'Only Votes',
  },
];

export enum ViewEnum {
  BODY = 'body',
  FULL = 'full',
  COMMENTS = 'comments',
}

interface MenuBarProps {
  totalVersions: number;
  versionTypes: VersionType[];
  currentVersion: number;
  includesProposals: boolean;
}

export const MenuBar = ({
  totalVersions,
  versionTypes,
  currentVersion,
  includesProposals,
}: MenuBarProps) => {
  const [view, setView] = useState(ViewEnum.FULL);

  return (
    <div className='font-condensed flex w-full justify-center'>
      <FullViewBar
        view={view}
        setView={setView}
        includesProposals={includesProposals}
      />
      {view == ViewEnum.BODY && (
        <BodyViewBar
          totalVersions={totalVersions}
          versionTypes={versionTypes}
          currentVersion={currentVersion}
          view={view}
          setView={setView}
        />
      )}
      {view == ViewEnum.COMMENTS && (
        <CommentsViewBar
          view={view}
          setView={setView}
          includesProposals={includesProposals}
        />
      )}
    </div>
  );
};
