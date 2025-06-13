import { Suspense } from 'react';
import { ActiveGroupItem } from './group-items/active-item';
import { InactiveGroupItem } from './group-items/inactive-item';
import { DiscussionGroupItem } from './group-items/discussion-item';
import { SkeletonGroupItemDetailed } from '../../../components/ui/skeleton';
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

// Wrapper component that handles rendering logic
export function GroupItemWrapper({ group }: GroupItemWrapperProps) {
  const currentTime = new Date();
  
  return (
    <Suspense fallback={<SkeletonGroupItemDetailed />}>
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
