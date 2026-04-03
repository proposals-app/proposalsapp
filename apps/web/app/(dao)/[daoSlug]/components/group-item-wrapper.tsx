'use client';

import { ActiveGroupItem } from './group-items/active-item';
import { InactiveGroupItem } from './group-items/inactive-item';
import { DiscussionGroupItem } from './group-items/discussion-item';
import type { FeedData } from '../actions';

interface GroupItemWrapperProps {
  renderedAtMs: number;
  group: {
    id: string;
    name: string;
    slug: string;
    authorName: string;
    authorAvatarUrl: string;
    latestActivityAtMs: number;
    hasNewActivity: boolean;
    hasActiveProposal: boolean;
    topicsCount: number;
    proposalsCount: number;
    votesCount: number;
    postsCount: number;
    activeFeedData: FeedData | null;
  };
}

// Wrapper component that handles rendering logic
export function GroupItemWrapper({
  group,
  renderedAtMs,
}: GroupItemWrapperProps) {
  const currentTime = new Date(renderedAtMs);

  if (group.hasActiveProposal) {
    return (
      <ActiveGroupItem
        group={group}
        feedData={group.activeFeedData}
        currentTime={currentTime}
      />
    );
  }

  if (group.proposalsCount > 0) {
    return <InactiveGroupItem group={group} currentTime={currentTime} />;
  }

  return <DiscussionGroupItem group={group} currentTime={currentTime} />;
}
