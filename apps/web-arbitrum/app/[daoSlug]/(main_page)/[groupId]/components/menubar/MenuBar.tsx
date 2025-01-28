'use client';
import { ViewEnum, VotesFilterEnum } from '@/app/searchParams';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { BodyViewBar } from './BodyViewBar';
import { CommentsViewBar } from './CommentsViewBar';
import { FullViewBar } from './FullViewBar';

export const voteFilters = [
  {
    value: VotesFilterEnum.ALL,
    label: 'No Filter',
  },
  {
    value: VotesFilterEnum.FIFTY_THOUSAND,
    label: 'Votes > 50k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_HUNDRED_THOUSAND,
    label: 'Votes > 500k ARB',
  },
  {
    value: VotesFilterEnum.FIVE_MILLION,
    label: 'Votes > 5m ARB',
  },
];

export const MenuBar = ({ totalVersions }: { totalVersions: number }) => {
  const [view] = useQueryState(
    'view',
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum)).withDefault(
      ViewEnum.FULL
    )
  );

  return (
    <div className='flex w-full justify-center'>
      <FullViewBar />
      {view == ViewEnum.BODY && <BodyViewBar totalVersions={totalVersions} />}
      {view == ViewEnum.COMMENTS && <CommentsViewBar />}
    </div>
  );
};
