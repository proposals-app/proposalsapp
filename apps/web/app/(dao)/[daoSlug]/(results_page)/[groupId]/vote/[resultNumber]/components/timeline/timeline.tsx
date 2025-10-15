import { notFound } from 'next/navigation';

import {
  getFeed,
  type GroupReturnType,
} from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import TimelineEventIcon from '@/public/assets/web/icons/timeline-event.svg';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { connection } from 'next/server';
import { ResultsMobile } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/timeline/mobile/timeline-mobile';
import { SkeletonTimeline } from '@/app/components/ui/skeleton';
import { TimelineEventType, type ResultEvent } from '@/lib/types';
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
      <div className='fixed left-28 top-24 z-20 hidden h-screen w-44 flex-col items-end justify-start sm:flex'>
        <div className='relative h-[calc(100vh-96px)] w-full'>
          {/* Conditionally render the top SVG */}
          {isProposalEnded && (
            <div className='rounded-xs absolute top-2 flex h-8 w-8 items-center justify-center border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
              <TimelineEventIcon
                className='fill-neutral-800 dark:fill-neutral-350'
                width={24}
                height={24}
                alt={'Timeline event'}
              />
            </div>
          )}

          <div className='absolute bottom-5 left-[15px] top-5 z-10 w-0.5 bg-neutral-800 dark:bg-neutral-350' />

          {/* Bottom SVG */}
          <div className='rounded-xs absolute bottom-1 flex h-8 w-8 items-center justify-center border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
            <TimelineEventIcon
              className='fill-neutral-800 dark:fill-neutral-350'
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
  return <SkeletonTimeline />;
}
