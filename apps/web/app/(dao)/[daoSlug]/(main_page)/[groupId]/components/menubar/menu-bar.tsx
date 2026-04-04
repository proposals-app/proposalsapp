'use client';

import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { BodyViewBar } from './body-view-bar';
import { CommentsViewBar } from './comments-view-bar';
import { FullViewBar } from './full-view-bar';
import React, { useState } from 'react';
import type { BodyVersionType } from '../../actions';
import { getDaoTokenSymbol } from '@/lib/dao-config';

export function getFromFilters(daoSlug: string) {
  const tokenSymbol = getDaoTokenSymbol(daoSlug);

  return [
    {
      value: FromFilterEnum.ALL,
      label: 'from everyone',
    },
    {
      value: FromFilterEnum.FIFTY_THOUSAND,
      label: `above 50k ${tokenSymbol}`,
    },
    {
      value: FromFilterEnum.FIVE_HUNDRED_THOUSAND,
      label: `above 500k ${tokenSymbol}`,
    },
    {
      value: FromFilterEnum.FIVE_MILLION,
      label: `above 5m ${tokenSymbol}`,
    },
    {
      value: FromFilterEnum.AUTHOR,
      label: 'from the author',
    },
  ];
}

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
  daoSlug: string;
  bodyVersions: BodyVersionType[];
  currentVersion: number;
  diff: boolean;
}

export const MenuBar = ({
  daoSlug,
  bodyVersions,
  currentVersion,
  diff,
}: MenuBarProps) => {
  const [view, setView] = useState(ViewEnum.FULL);

  const includesProposals = bodyVersions.some(
    (version) => version.type === 'onchain' || version.type === 'offchain'
  );

  return (
    <div className='z-40 flex w-full justify-center font-condensed'>
      <FullViewBar
        daoSlug={daoSlug}
        view={view}
        setView={setView}
        includesProposals={includesProposals}
      />

      {view == ViewEnum.BODY && (
        <BodyViewBar
          bodyVersions={bodyVersions}
          currentVersion={currentVersion}
          view={view}
          setView={setView}
          diff={diff}
          includesProposals={includesProposals}
        />
      )}
      {view == ViewEnum.COMMENTS && (
        <CommentsViewBar
          daoSlug={daoSlug}
          view={view}
          setView={setView}
          includesProposals={includesProposals}
        />
      )}
    </div>
  );
};
