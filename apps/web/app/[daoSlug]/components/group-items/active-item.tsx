import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight, Activity } from 'lucide-react';
import { getFeed } from '../../(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { Suspense } from 'react';
import { ResultCard } from './results/result-card';
import Image from 'next/image';

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
      className={`block border border-green-700 bg-green-50 p-4 transition hover:bg-green-100 sm:p-5 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900`}
      prefetch={true}
    >
      <div className='flex flex-col gap-4 sm:gap-5'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex min-h-10 min-w-10 items-center justify-center overflow-hidden border-2 border-neutral-700 sm:min-h-12 sm:min-w-12 dark:border-neutral-300'>
              <Image
                src={group.authorAvatarUrl}
                alt={group.authorName}
                width={48}
                height={48}
                className='h-full w-full object-cover'
              />
            </div>
            <div>
              <h2 className='text-lg font-bold text-neutral-800 sm:text-xl dark:text-neutral-200'>
                {group.name}
              </h2>
              <p className='text-sm text-neutral-600 dark:text-neutral-400'>
                By {group.authorName}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {group.hasNewActivity && <NewBadge />}
            <div className='flex h-8 w-8 items-center justify-center bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200'>
              <Activity className='h-4 w-4' />
            </div>
          </div>
        </div>

        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
          <div className='order-2 mt-3 flex flex-wrap gap-3 text-xs sm:order-1 sm:mt-0 sm:text-sm'>
            <span className='bg-neutral-200 px-2 py-1 dark:bg-neutral-700'>
              Last activity {relativeTime}
            </span>
            <span className='bg-neutral-200 px-2 py-1 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'>
              {group.commentsCount} discussions
            </span>
            {group.proposalsCount > 0 && (
              <span className='bg-neutral-200 px-2 py-1 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'>
                {group.proposalsCount} proposals
              </span>
            )}
          </div>

          <div className='order-1 flex sm:order-2'>
            <Suspense>
              {result &&
                (result.type === TimelineEventType.ResultOngoingBasicVote ||
                  result.type === TimelineEventType.ResultOngoingOtherVotes ||
                  result.type === TimelineEventType.ResultEndedBasicVote ||
                  result.type === TimelineEventType.ResultEndedOtherVotes) && (
                  <ResultCard content={result.content} result={result.result} />
                )}
            </Suspense>
          </div>
        </div>

        <div className='flex justify-end'>
          <div className='flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400'>
            View active proposal <ArrowRight className='h-4 w-4' />
          </div>
        </div>
      </div>
    </Link>
  );
}

const NewBadge = () => (
  <div className='animate-pulse bg-green-700 px-3 py-1 text-xs font-medium text-white sm:text-sm'>
    New activity
  </div>
);
