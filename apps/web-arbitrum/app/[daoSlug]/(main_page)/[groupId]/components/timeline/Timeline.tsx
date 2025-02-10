import { VotesFilterEnum } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { GroupReturnType } from '../../actions';
import { getEvents, TimelineEventType } from './actions';
import { BasicEvent } from './BasicEvent';
import { CommentsVolumeEvent } from './CommentsVolumeEvent';
import { GapEvent } from './GapEvent';
import { ResultEvent } from './ResultEvent';
import { VotesVolumeEvent } from './VotesVolumeEvent';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg'; // Import the SVG as a React component

export async function Timeline({
  group,
  commentsFilter,
  votesFilter,
}: {
  group: GroupReturnType;
  commentsFilter: boolean;
  votesFilter: VotesFilterEnum;
}) {
  if (!group) {
    notFound();
  }

  const events = await getEvents(group);

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  return (
    <div
      className='fixed top-0 right-0 flex h-screen w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full max-h-[840px] w-full'>
        <div
          className='dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 translate-x-[1px]
            bg-neutral-800'
        />
        <div className='flex h-full flex-col justify-between'>
          {events.map((event, index) => {
            // Determine visibility based on filters and metadata
            const isVisible =
              (event.type === TimelineEventType.CommentsVolume &&
                commentsFilter) ||
              (event.type === TimelineEventType.VotesVolume &&
                event.metadata?.votingPower &&
                (votesFilter === VotesFilterEnum.ALL ||
                  (votesFilter === VotesFilterEnum.FIFTY_THOUSAND &&
                    event.metadata.votingPower > 50000) ||
                  (votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND &&
                    event.metadata.votingPower > 500000) ||
                  (votesFilter === VotesFilterEnum.FIVE_MILLION &&
                    event.metadata.votingPower > 5000000))) ||
              event.type === TimelineEventType.Basic ||
              event.type === TimelineEventType.ResultOngoingBasicVote ||
              event.type === TimelineEventType.ResultOngoingOtherVotes ||
              event.type === TimelineEventType.ResultEndedBasicVote ||
              event.type === TimelineEventType.ResultEndedOtherVotes ||
              event.type === TimelineEventType.Gap;

            const resultNumber =
              event.type === TimelineEventType.ResultOngoingBasicVote ||
              event.type === TimelineEventType.ResultOngoingOtherVotes ||
              event.type === TimelineEventType.ResultEndedBasicVote ||
              event.type === TimelineEventType.ResultEndedOtherVotes
                ? proposalOrderMap.get(event.result.proposal.id)
                : undefined;

            return (
              <div
                key={index}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 0.2s ease-in-out',
                }}
              >
                {event.type === TimelineEventType.Gap ? (
                  <GapEvent />
                ) : event.type === TimelineEventType.CommentsVolume ? (
                  <CommentsVolumeEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    volume={event.volume}
                    last={index == 0}
                  />
                ) : event.type === TimelineEventType.VotesVolume ? (
                  <VotesVolumeEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    volume={event.volume}
                    last={index == 0}
                  />
                ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
                  event.type === TimelineEventType.ResultOngoingOtherVotes ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    result={event.result}
                    resultNumber={resultNumber!} // Pass the resultNumber
                    last={index == 0}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                  />
                ) : event.type === TimelineEventType.ResultEndedBasicVote ||
                  event.type === TimelineEventType.ResultEndedOtherVotes ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    result={event.result}
                    resultNumber={resultNumber!} // Pass the resultNumber
                    last={index == 0}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                  />
                ) : event.type === TimelineEventType.Basic ? (
                  <BasicEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    url={event.url}
                    last={index == 0}
                  />
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
    <div
      className='fixed top-0 right-0 flex h-screen w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full max-h-[840px] w-full'>
        <div
          className='absolute top-1 flex h-8 w-8 items-center justify-center rounded-xs border-2
            border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'
        >
          <TimelineEventIcon
            className='dark:fill-neutral-350 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        </div>

        <div
          className='dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 translate-x-[1px]
            bg-neutral-800'
        />

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
      </div>
    </div>
  );
}
