import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { getFeed } from '../../(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { Suspense } from 'react';
import { ResultCard } from './results/result-card';
import Image from 'next/image';
import CommentsIcon from '@/public/assets/web/icons/discussion.svg';
import VotesIcon from '@/public/assets/web/icons/vote.svg';

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
    topicsCount: number;
    proposalsCount: number;
    votesCount: number;
    postsCount: number;
  };
}

export async function ActiveGroupItem({ group }: ActiveGroupItemProps) {
  const relativeTime = formatDistanceToNow(new Date(group.latestActivityAt), {
    addSuffix: true,
  });

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
      className='group block rounded-xs border border-neutral-200 bg-white p-2 hover:bg-neutral-200/50 sm:p-3 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:bg-neutral-800'
    >
      <div className='relative flex flex-col gap-1 sm:gap-2'>
        <div className='absolute right-0 flex min-h-5 min-w-5 items-center justify-center sm:min-h-6 sm:min-w-6'>
          <span className='bg-for-400 dark:bg-for-600 absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-75'></span>
          <span className='bg-for-400 dark:bg-for-600 relative inline-flex h-2 w-2 rounded-full'></span>
        </div>
        <div className='flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-0'>
          <div className='flex max-w-[60%] items-start gap-2 sm:max-w-3/4'>
            <div className='relative flex min-h-[32px] min-w-[32px] items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 sm:min-h-[40px] sm:min-w-[40px] dark:border-neutral-300'>
              <Image
                src={group.authorAvatarUrl}
                alt={group.authorName}
                className='h-full w-full object-cover'
                fill
                sizes='(min-width: 640px) 40px, 32px'
              />
            </div>
            <div>
              <h2 className='line-clamp-2 text-sm font-bold text-neutral-800 group-hover:text-neutral-900 sm:text-lg dark:text-neutral-200 dark:group-hover:text-neutral-50'>
                {group.name}
              </h2>
              <p className='text-xs text-neutral-600 sm:text-sm dark:text-neutral-400'>
                By {group.authorName}
              </p>
            </div>
          </div>
          <div className='relative flex w-full items-start self-end sm:w-auto'>
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
      </div>
    </Link>
  );
}
