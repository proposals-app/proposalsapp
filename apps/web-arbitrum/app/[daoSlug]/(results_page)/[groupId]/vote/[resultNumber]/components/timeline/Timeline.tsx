import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { extractEvents, TimelineEventType } from './actions';
import {
  BasicEvent,
  CommentsVolumeEvent,
  GapEvent,
  VotesVolumeEvent,
} from './OtherEvents';
import { ResultEvent } from './ResultEvent';
import { GroupReturnType } from '@/app/[daoSlug]/(main_page)/[groupId]/actions';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg';

// Cache the extractEvents function
const getCachedEvents = unstable_cache(
  async (group: GroupReturnType) => {
    return await extractEvents(group);
  },
  [],
  { revalidate: 60 * 5, tags: ['extract-events'] }
);

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
  const events = await getCachedEvents(group);

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  // Get the current time
  const currentTime = new Date();

  // Check if the proposal end time is older than the current time
  const isProposalEnded = group.proposals.some(
    (proposal) => new Date(proposal.endAt) < currentTime
  );

  return (
    <div className='fixed top-24 left-28 z-20 flex h-screen w-44 flex-col items-end justify-start'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        {/* Conditionally render the top SVG */}
        {isProposalEnded && (
          <div
            className='absolute top-2 flex h-8 w-8 items-center justify-center rounded-xs border-2
              border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'
          >
            <TimelineEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          </div>
        )}

        <div
          className='dark:bg-neutral-350 absolute top-5 bottom-5 left-[15px] z-10 w-0.5
            bg-neutral-800'
        />

        {/* Bottom SVG */}
        <div
          className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border-2
            border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'
        >
          <TimelineEventIcon
            className='dark:fill-neutral-350 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        </div>

        <div className='flex h-full flex-col justify-between'>
          {events.map((event, index) => {
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
                {event.type === TimelineEventType.Gap ? (
                  <GapEvent />
                ) : event.type === TimelineEventType.CommentsVolume ? (
                  <CommentsVolumeEvent />
                ) : event.type === TimelineEventType.VotesVolume ? (
                  <VotesVolumeEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    volume={event.volume}
                  />
                ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
                  event.type === TimelineEventType.ResultOngoingOtherVotes ||
                  event.type === TimelineEventType.ResultEndedBasicVote ||
                  event.type === TimelineEventType.ResultEndedOtherVotes ? (
                  <ResultEvent
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
                ) : event.type === TimelineEventType.Basic ? (
                  <BasicEvent />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LoadingTimeline() {
  return (
    <div className='fixed top-24 left-28 z-20 flex h-screen w-44 flex-col items-end justify-start'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        {/* Top SVG Placeholder */}
        <div
          className='absolute top-2 flex h-8 w-8 items-center justify-center rounded-xs border-2
            border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'
        >
          <TimelineEventIcon
            className='dark:fill-neutral-350 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        </div>

        {/* Vertical Line Placeholder */}
        <div
          className='dark:bg-neutral-350 absolute top-2 bottom-4 left-[15px] z-10 w-0.5
            bg-neutral-800'
        />

        {/* Bottom SVG Placeholder */}
        <div
          className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border-2
            border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'
        >
          <TimelineEventIcon
            className='dark:fill-neutral-350 fill-neutral-800'
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
              className='h relative flex w-full items-center justify-start'
            >
              {/* Placeholder Event Content */}
              <div
                className='dark:border-neutral-650 z-20 flex h-[120px] flex-col gap-2 border
                  border-neutral-300 bg-white px-4 py-2 dark:bg-neutral-950'
              >
                <div className='h-4 w-20 rounded-sm bg-gray-300' />
                <div className='h-4 w-16 rounded-sm bg-gray-300' />
                <div className='h-4 w-20 rounded-sm bg-gray-300' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
