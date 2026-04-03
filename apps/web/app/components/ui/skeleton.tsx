'use client';

import { Skeleton as RawSkeleton } from 'boneyard-js/react';
import * as React from 'react';
import type { ComponentProps } from 'react';
import { BoneyardShell } from '@/app/components/loading/boneyard-shell';
import { BONEYARD_NAMES } from '@/app/components/loading/boneyard-names';
import {
  ActiveGroupItemFixture,
  AggregateVoteItemFixture,
  ArbitrumSummaryHeaderFixture,
  BodyFixture,
  BodyHeaderFixture,
  DelegatesPageFixture,
  DiscussionGroupItemFixture,
  FeedFixture,
  GroupListFixture,
  GroupPageFixture,
  GroupsHeaderFixture,
  InactiveGroupItemFixture,
  InitiallyPostedFixture,
  MainPageFixture,
  MappingPageFixture,
  MenuBarBodyFixture,
  MenuBarCommentsFixture,
  MenuBarFullFixture,
  ModeToggleFixture,
  NavShellFixture,
  NonVotersTableFixture,
  OnboardingPageFixture,
  PostItemFixture,
  PostedRevisionsFixture,
  ProfilePageFixture,
  ResultsChartFixture,
  ResultsFixture,
  ResultsHeaderFixture,
  ResultsListBarsFixture,
  ResultsListFixture,
  ResultsPageFixture,
  ResultsTableFixture,
  ResultsTitleFixture,
  TimelineFixture,
  UniswapSummaryHeaderFixture,
  VoteItemFixture,
} from '@/app/components/loading/boneyard-real-fixtures';

function resolveDaoSlug() {
  if (typeof window === 'undefined') return 'arbitrum';

  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  if (hostname.startsWith('uniswap.') || pathname.includes('/uniswap')) {
    return 'uniswap';
  }

  return 'arbitrum';
}

function withBoneyard(
  name: string,
  fixture: React.ReactNode,
  className?: string
) {
  return <BoneyardShell name={name} fixture={fixture} className={className} />;
}

const SkeletonMainPage = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.mainPage, <MainPageFixture />, className)
);
SkeletonMainPage.displayName = 'SkeletonMainPage';

const SkeletonGroupPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.groupPage, <GroupPageFixture />, className)
);
SkeletonGroupPage.displayName = 'SkeletonGroupPage';

const SkeletonResultsPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.resultsPage, <ResultsPageFixture />, className)
);
SkeletonResultsPage.displayName = 'SkeletonResultsPage';

const SkeletonVPPage = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.chart, <ResultsChartFixture />, className)
);
SkeletonVPPage.displayName = 'SkeletonVPPage';

const SkeletonHeader = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) => {
    const daoSlug = resolveDaoSlug();

    return daoSlug === 'uniswap'
      ? withBoneyard(
          BONEYARD_NAMES.uniswapSummaryHeader,
          <UniswapSummaryHeaderFixture />,
          className
        )
      : withBoneyard(
          BONEYARD_NAMES.arbitrumSummaryHeader,
          <ArbitrumSummaryHeaderFixture />,
          className
        );
  }
);
SkeletonHeader.displayName = 'SkeletonHeader';

const HeaderSkeleton = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.groupsHeader, <GroupsHeaderFixture />, className)
);
HeaderSkeleton.displayName = 'HeaderSkeleton';

const SkeletonBodyHeader = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.bodyHeader, <BodyHeaderFixture />, className)
);
SkeletonBodyHeader.displayName = 'SkeletonBodyHeader';

const SkeletonResultsHeader = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.resultsHeader,
    <ResultsHeaderFixture />,
    className
  )
);
SkeletonResultsHeader.displayName = 'SkeletonResultsHeader';

const SkeletonBody = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.body, <BodyFixture />, className)
);
SkeletonBody.displayName = 'SkeletonBody';

const SkeletonMenuBar = React.forwardRef<
  HTMLDivElement,
  { className?: string; variant?: 'full' | 'body' | 'comments' }
>(({ className, variant = 'full' }, _ref) => {
  if (variant === 'body') {
    return withBoneyard(
      BONEYARD_NAMES.menuBarBody,
      <MenuBarBodyFixture />,
      className
    );
  }

  if (variant === 'comments') {
    return withBoneyard(
      BONEYARD_NAMES.menuBarComments,
      <MenuBarCommentsFixture />,
      className
    );
  }

  return withBoneyard(
    BONEYARD_NAMES.menuBarFull,
    <MenuBarFullFixture />,
    className
  );
});
SkeletonMenuBar.displayName = 'SkeletonMenuBar';

const SkeletonInitiallyPosted = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.initiallyPosted,
    <InitiallyPostedFixture />,
    className
  )
);
SkeletonInitiallyPosted.displayName = 'SkeletonInitiallyPosted';

const SkeletonPostedRevisions = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.postedRevisions,
    <PostedRevisionsFixture />,
    className
  )
);
SkeletonPostedRevisions.displayName = 'SkeletonPostedRevisions';

const SkeletonGroupList = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.groupList, <GroupListFixture />, className)
);
SkeletonGroupList.displayName = 'SkeletonGroupList';

const SkeletonActiveGroupItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.activeGroupItem,
    <ActiveGroupItemFixture />,
    className
  )
);
SkeletonActiveGroupItem.displayName = 'SkeletonActiveGroupItem';

const SkeletonInactiveGroupItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.inactiveGroupItem,
    <InactiveGroupItemFixture />,
    className
  )
);
SkeletonInactiveGroupItem.displayName = 'SkeletonInactiveGroupItem';

const SkeletonDiscussionGroupItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.discussionGroupItem,
    <DiscussionGroupItemFixture />,
    className
  )
);
SkeletonDiscussionGroupItem.displayName = 'SkeletonDiscussionGroupItem';

const SkeletonFeed = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.feed, <FeedFixture />, className)
);
SkeletonFeed.displayName = 'SkeletonFeed';

const SkeletonPostItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.postItem, <PostItemFixture />, className)
);
SkeletonPostItem.displayName = 'SkeletonPostItem';

const SkeletonVoteItemFeed = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.voteItemFeed, <VoteItemFixture />, className)
);
SkeletonVoteItemFeed.displayName = 'SkeletonVoteItemFeed';

const SkeletonAggregateVoteItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.aggregateVoteItem,
    <AggregateVoteItemFixture />,
    className
  )
);
SkeletonAggregateVoteItem.displayName = 'SkeletonAggregateVoteItem';

const SkeletonResults = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.resultsContent, <ResultsFixture />, className)
);
SkeletonResults.displayName = 'SkeletonResults';

const SkeletonResultsTitle = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.resultsTitle, <ResultsTitleFixture />, className)
);
SkeletonResultsTitle.displayName = 'SkeletonResultsTitle';

const SkeletonResultsList = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.resultsList, <ResultsListFixture />, className)
);
SkeletonResultsList.displayName = 'SkeletonResultsList';

const SkeletonResultsListBars = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.resultsListBars,
    <ResultsListBarsFixture />,
    className
  )
);
SkeletonResultsListBars.displayName = 'SkeletonResultsListBars';

const SkeletonResultsTable = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.resultsTable, <ResultsTableFixture />, className)
);
SkeletonResultsTable.displayName = 'SkeletonResultsTable';

const SkeletonNonVotersTable = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.nonVotersTable,
    <NonVotersTableFixture />,
    className
  )
);
SkeletonNonVotersTable.displayName = 'SkeletonNonVotersTable';

const SkeletonTimeline = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.timeline, <TimelineFixture />, className)
);
SkeletonTimeline.displayName = 'SkeletonTimeline';

const SkeletonChart = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.chart, <ResultsChartFixture />, className)
);
SkeletonChart.displayName = 'SkeletonChart';

const SkeletonActionBar = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.groupsHeader, <GroupsHeaderFixture />, className)
);
SkeletonActionBar.displayName = 'SkeletonActionBar';

const SkeletonGroupListWithControls = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.groupList, <GroupListFixture />, className)
);
SkeletonGroupListWithControls.displayName = 'SkeletonGroupListWithControls';

const SkeletonNavShell = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, _ref) =>
    withBoneyard(BONEYARD_NAMES.navShell, <NavShellFixture />, className)
);
SkeletonNavShell.displayName = 'SkeletonNavShell';

const SkeletonModeToggle = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.modeToggle, <ModeToggleFixture />, className)
);
SkeletonModeToggle.displayName = 'SkeletonModeToggle';

const SkeletonProfilePage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.profilePage, <ProfilePageFixture />, className)
);
SkeletonProfilePage.displayName = 'SkeletonProfilePage';

const SkeletonOnboardingPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.onboardingPage,
    <OnboardingPageFixture />,
    className
  )
);
SkeletonOnboardingPage.displayName = 'SkeletonOnboardingPage';

const SkeletonMappingPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(BONEYARD_NAMES.mappingPage, <MappingPageFixture />, className)
);
SkeletonMappingPage.displayName = 'SkeletonMappingPage';

const SkeletonDelegatesPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, _ref) =>
  withBoneyard(
    BONEYARD_NAMES.delegatesPage,
    <DelegatesPageFixture />,
    className
  )
);
SkeletonDelegatesPage.displayName = 'SkeletonDelegatesPage';

const LoadingHeader = SkeletonHeader;
const LoadingGroupList = SkeletonGroupListWithControls;

export {
  RawSkeleton as Skeleton,
  SkeletonMainPage,
  SkeletonGroupPage,
  SkeletonResultsPage,
  SkeletonVPPage,
  SkeletonHeader,
  SkeletonBodyHeader,
  SkeletonResultsHeader,
  HeaderSkeleton,
  SkeletonBody,
  SkeletonMenuBar,
  SkeletonInitiallyPosted,
  SkeletonPostedRevisions,
  SkeletonGroupList,
  SkeletonActiveGroupItem,
  SkeletonInactiveGroupItem,
  SkeletonDiscussionGroupItem,
  SkeletonFeed,
  SkeletonPostItem,
  SkeletonVoteItemFeed,
  SkeletonAggregateVoteItem,
  SkeletonResults,
  SkeletonResultsTitle,
  SkeletonResultsList,
  SkeletonResultsListBars,
  SkeletonResultsTable,
  SkeletonNonVotersTable,
  SkeletonTimeline,
  SkeletonChart,
  SkeletonActionBar,
  SkeletonGroupListWithControls,
  SkeletonNavShell,
  SkeletonModeToggle,
  SkeletonProfilePage,
  SkeletonOnboardingPage,
  SkeletonMappingPage,
  SkeletonDelegatesPage,
  LoadingHeader,
  LoadingGroupList,
};

export type SkeletonProps = ComponentProps<typeof RawSkeleton>;
