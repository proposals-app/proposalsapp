'use client';
import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { BodyViewBar } from './BodyViewBar';
import { CommentsViewBar } from './CommentsViewBar';
import { FullViewBar } from './FullViewBar';
import * as Select from '@radix-ui/react-select';
import CheckSvg from '@/public/assets/web/check.svg';
import React from 'react';
import { VersionType } from '../../actions';

export const SharedSelectItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; value: string }
>(({ children, value, ...props }, forwardedRef) => {
  return (
    <Select.Item
      className='relative flex h-[35px] cursor-pointer items-center pr-10 pl-2 text-sm
        text-neutral-800 transition-colors outline-none hover:bg-neutral-100
        dark:text-neutral-200 dark:hover:bg-neutral-800'
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

export const voteFilters = [
  {
    value: VotesFilterEnum.ALL,
    label: 'All votes',
  },
  {
    value: VotesFilterEnum.FIFTY_THOUSAND,
    label: 'Votes +50k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_HUNDRED_THOUSAND,
    label: 'Votes +500k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_MILLION,
    label: 'Votes +5m ARB',
  },
];

interface MenuBarProps {
  totalVersions: number;
  versionTypes: VersionType[];
  currentVersion: number;
}

export const MenuBar = ({
  totalVersions,
  versionTypes,
  currentVersion,
}: MenuBarProps) => {
  const [view] = useQueryState(
    'view',
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum)).withDefault(
      ViewEnum.FULL
    )
  );

  return (
    <div className='font-condensed flex w-full justify-center'>
      <FullViewBar />
      {view == ViewEnum.BODY && (
        <BodyViewBar
          totalVersions={totalVersions}
          versionTypes={versionTypes}
          currentVersion={currentVersion}
        />
      )}
      {view == ViewEnum.COMMENTS && <CommentsViewBar />}
    </div>
  );
};
