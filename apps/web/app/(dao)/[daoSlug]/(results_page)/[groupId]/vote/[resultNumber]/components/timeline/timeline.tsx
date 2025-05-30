import { notFound } from 'next/navigation';

import {
  getFeed,
  GroupReturnType,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import TimelineEventIcon from '@/public/assets/web/icons/timeline-event.svg';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { connection } from 'next/server';
import { ResultsMobile } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/timeline/mobile/timeline-mobile';
import { ResultEvent, TimelineEventType } from '@/lib/types';
import { Basic, CommentsVolume, VotesVolume } from './other';
import { Result } from './result';

export async function Timeline({
  group,
  selectedResult,
}: {
  group: GroupReturnType;
  selectedResult: number;
}) {
  if (!group) {
    notFound();
  }

  // Use the cached version of extractEvents
  const feed = await getFeed(
    group.group.id,
    FeedFilterEnum.COMMENTS_AND_VOTES,
    FromFilterEnum.ALL
  );

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  await connection();
  // Get the current time
  const currentTime = new Date();

  // Check if the proposal end time is older than the current time
  const isProposalEnded = group.proposals.every(
    (proposal) => new Date(proposal.endAt) < currentTime
  );

  const mobileResultEvents: ResultEvent[] =
    (feed.events?.filter((event) =>
      event.type.includes('Result')
    ) as ResultEvent[]) || [];

  return (
    <div>
      <ResultsMobile events={mobileResultEvents} group={group} />
      <div className='fixed top-24 left-28 z-20 hidden h-screen w-44 flex-col items-end justify-start sm:flex'>
        <div className='relative h-[calc(100vh-96px)] w-full'>
          {/* Conditionally render the top SVG */}
          {isProposalEnded && (
            <div className='absolute top-2 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
              <TimelineEventIcon
                className='dark:fill-neutral-350 fill-neutral-800'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            </div>
          )}

          <div className='dark:bg-neutral-350 absolute top-5 bottom-5 left-[15px] z-10 w-0.5 bg-neutral-800' />

          {/* Bottom SVG */}
          <div className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
            <TimelineEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          </div>

          <div className='flex h-full flex-col justify-between'>
            {feed.events.map((event, index) => {
              // Add resultNumber for ResultEndedEvent and ResultOngoingEvent
              const resultNumber =
                event.type === TimelineEventType.ResultEndedBasicVote ||
                event.type === TimelineEventType.ResultOngoingBasicVote ||
                event.type === TimelineEventType.ResultEndedOtherVotes ||
                event.type === TimelineEventType.ResultOngoingOtherVotes
                  ? (proposalOrderMap.get(event.proposal.id) ?? 0)
                  : 0;

              return (
                <div
                  key={index}
                  className='relative flex w-full items-center justify-start'
                >
                  {event.type === TimelineEventType.CommentsVolume ? (
                    <CommentsVolume />
                  ) : event.type === TimelineEventType.VotesVolume ? (
                    <VotesVolume />
                  ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
                    event.type === TimelineEventType.ResultOngoingOtherVotes ||
                    event.type === TimelineEventType.ResultEndedBasicVote ||
                    event.type === TimelineEventType.ResultEndedOtherVotes ? (
                    <Result
                      eventType={event.type}
                      content={event.content}
                      timestamp={event.timestamp}
                      proposal={event.proposal}
                      resultNumber={resultNumber!}
                      selectedResult={selectedResult}
                      daoSlug={group.daoSlug}
                      groupId={group.group.id}
                      eventIndex={index}
                      last={index == 0}
                    />
                  ) : event.type === TimelineEventType.Basic ||
                    event.type === TimelineEventType.Discussion ||
                    event.type === TimelineEventType.Offchain ||
                    event.type === TimelineEventType.Onchain ? (
                    <Basic />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingTimeline() {
  return (
    <div className='fixed top-24 left-28 z-20 hidden h-screen w-44 flex-col items-end justify-start sm:flex'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        {/* Top SVG Placeholder */}
        <div className='absolute top-2 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800'>
          <TimelineEventIcon
            className='fill-neutral-400 dark:fill-neutral-500'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        </div>

        {/* Vertical Line Placeholder */}
        <div className='absolute top-2 bottom-4 left-[15px] z-10 w-0.5 bg-neutral-300 dark:bg-neutral-600' />

        {/* Bottom SVG Placeholder */}
        <div className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800'>
          <TimelineEventIcon
            className='fill-neutral-400 dark:fill-neutral-500'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        </div>

        {/* Placeholder Items */}
        <div className='flex h-full flex-col gap-16 pt-2'>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className='relative flex w-full items-center justify-start'
            >
              {/* Placeholder Event Content */}
              <div className='z-20 flex h-[120px] w-28 flex-col gap-2 rounded-l-xs border border-neutral-200 bg-white px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800'>
                <div className='h-4 w-20 animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
                <div className='h-4 w-16 animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
                <div className='h-4 w-20 animate-pulse rounded-sm bg-neutral-300 dark:bg-neutral-700' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
