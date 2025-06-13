import { Suspense } from 'react';
import { ActiveGroupItem } from './group-items/active-item';
import { InactiveGroupItem } from './group-items/inactive-item';
import { DiscussionGroupItem } from './group-items/discussion-item';
import { SkeletonActiveGroupItem, SkeletonInactiveGroupItem, SkeletonDiscussionGroupItem } from '../../../components/ui/skeleton';
import type { FeedData } from '../actions';

interface GroupItemWrapperProps {
  group: {
    id: string;
    name: string;
    slug: string;
    authorName: string;
    authorAvatarUrl: string;
    latestActivityAt: Date;
    hasNewActivity: boolean;
    hasActiveProposal: boolean;
    topicsCount: number;
    proposalsCount: number;
    votesCount: number;
    postsCount: number;
    activeFeedData: FeedData | null;
  };
}

// Get the appropriate skeleton component based on group type
function getSkeletonForGroup(group: GroupItemWrapperProps['group']) {
  if (group.hasActiveProposal) {
    return <SkeletonActiveGroupItem />;
  } else if (group.proposalsCount > 0) {
    return <SkeletonInactiveGroupItem />;
  } else {
    return <SkeletonDiscussionGroupItem />;
  }
}

// Wrapper component that handles rendering logic
export function GroupItemWrapper({ group }: GroupItemWrapperProps) {
  const currentTime = new Date();
  
  return (
    <Suspense fallback={getSkeletonForGroup(group)}>
      {group.hasActiveProposal ? (
        <ActiveGroupItem group={group} feedData={group.activeFeedData} currentTime={currentTime} />
      ) : group.proposalsCount > 0 ? (
        <InactiveGroupItem group={group} currentTime={currentTime} />
      ) : (
        <DiscussionGroupItem group={group} currentTime={currentTime} />
      )}
    </Suspense>
  );
}
