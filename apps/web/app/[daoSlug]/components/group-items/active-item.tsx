import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getFeed } from '../../(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { Suspense } from 'react';
import { ResultCard } from './results/result-card';

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
}

interface ActiveGroupItemProps {
  group: {
    id: string;
    name: string;
    slug: string;
    authorName: string;
    authorAvatarUrl: string;
    latestActivityAt: Date;
    hasNewActivity: boolean;
    hasActiveProposal: boolean;
    commentsCount: number;
    proposalsCount: number;
  };
}

export async function ActiveGroupItem({ group }: ActiveGroupItemProps) {
  'use cache';

  // Make ActiveGroupItem async
  const relativeTime = formatDistanceToNow(new Date(group.latestActivityAt), {
    addSuffix: true,
  });

  // Fetch feed data on the server
  const feedData = await getFeed(
    group.id,
    FeedFilterEnum.VOTES,
    FromFilterEnum.ALL,
    true
  );

  const result =
    feedData?.events && feedData.events.length > 0 ? feedData.events[0] : null;

  return (
    <Link
      href={`/${group.slug}`}
      className={`block border border-neutral-200 bg-green-200 p-3 sm:p-4 dark:border-neutral-700 dark:bg-green-900`}
      prefetch={true}
    >
      <div className='flex flex-row justify-between gap-3 sm:gap-0'>
        <div>
          <h2 className='text-lg font-bold text-neutral-800 sm:text-xl dark:text-neutral-200'>
            {group.name}
          </h2>
          <div className='mt-2 flex flex-col gap-1 text-xs text-neutral-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:text-sm dark:text-neutral-400'>
            <span>By {group.authorName}</span>
            <span>Last activity {relativeTime}</span>
            <div className='flex items-center gap-2'>
              <span>{group.commentsCount} discussions</span>
              {group.proposalsCount > 0 && (
                <span>{group.proposalsCount} proposals</span>
              )}
            </div>
          </div>
        </div>
        <div className='flex h-32'>
          <Suspense>
            {result &&
              (result.type === TimelineEventType.ResultOngoingBasicVote ||
                result.type === TimelineEventType.ResultOngoingOtherVotes ||
                result.type === TimelineEventType.ResultEndedBasicVote ||
                result.type === TimelineEventType.ResultEndedOtherVotes) && (
                <ResultCard content={result.content} result={result.result} />
              )}
          </Suspense>
          <div className='flex items-center justify-between sm:flex-row sm:gap-2'>
            {group.hasNewActivity && <NewBadge />}
            <ArrowRight className='h-5 w-5 text-neutral-400 sm:h-6 sm:w-6 dark:text-neutral-500' />
          </div>
        </div>
      </div>
    </Link>
  );
}

const NewBadge = () => (
  <div className='border-neutral-350 dark:border-neutral-650 border bg-neutral-200 px-2 py-1 text-xs text-neutral-700 sm:text-sm dark:bg-neutral-700 dark:text-neutral-200'>
    New activity
  </div>
);
