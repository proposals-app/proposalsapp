import { notFound } from 'next/navigation';
import { GroupWithDataType } from '../../actions';
import { extractEvents, TimelineEventType } from './actions';
import { GapEvent } from './GapEvent';
import { CommentsVolumeEvent } from './CommentsVolumeEvent';
import { VotesVolumeEvent } from './VotesVolumeEvent';
import { ResultEvent } from './ResultEvent';
import { BasicEvent } from './BasicEvent';
import { VotesFilterEnum } from '@/app/searchParams';

export async function Timeline({
  group,
  commentsFilter,
  votesFilter,
}: {
  group: GroupWithDataType;
  commentsFilter: boolean;
  votesFilter: VotesFilterEnum;
}) {
  if (!group) {
    notFound();
  }

  // Use the cached version of extractEvents
  const events = await extractEvents(group);

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  return (
    <div className='fixed right-0 top-0 flex h-screen w-80 flex-col items-end justify-start pl-4 pt-24'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        <div className='absolute bottom-5 left-[14px] top-5 w-0.5 translate-x-[0.5px] bg-gray-500' />
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
              event.type === TimelineEventType.ResultOngoing ||
              event.type === TimelineEventType.ResultEnded ||
              event.type === TimelineEventType.Gap;

            const resultNumber =
              event.type === TimelineEventType.ResultEnded ||
              event.type === TimelineEventType.ResultOngoing
                ? proposalOrderMap.get(event.proposal.id)
                : undefined;

            return (
              <div
                key={index}
                className='relative flex w-full items-center justify-start'
                style={{
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 0.2s ease-in-out',
                }}
              >
                {event.type === TimelineEventType.Gap ? (
                  <GapEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    gapSize={event.gapSize}
                    last={index == 0}
                  />
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
                ) : event.type === TimelineEventType.ResultOngoing ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
                    resultNumber={resultNumber!} // Pass the resultNumber
                    last={index == 0}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                  />
                ) : event.type === TimelineEventType.ResultEnded ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
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
    <div className='fixed right-0 top-0 flex h-screen w-80 flex-col items-end justify-start pl-4 pt-24'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        {/* Top SVG Placeholder */}
        <div className='bg-muted-foreground absolute left-[14px] top-5 w-0.5 translate-x-[0.5px]'>
          <svg
            width='21'
            height='21'
            viewBox='0 0 21 21'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            className='absolute -left-[10px] -top-[10px]'
          >
            <rect
              x='0.5'
              y='0.5'
              width='20'
              height='20'
              rx='10'
              fill='white'
              stroke='#D3D3D3'
            />
            <circle cx='10.5' cy='10.5' r='3' fill='#737373' />
          </svg>
        </div>

        {/* Vertical Line Placeholder */}
        <div className='bg-muted-foreground absolute bottom-5 left-[14px] top-5 w-0.5' />

        {/* Bottom SVG Placeholder */}
        <div className='bg-muted-foreground absolute bottom-5 left-[14px] w-0.5 translate-x-[0.5px]'>
          <svg
            width='21'
            height='21'
            viewBox='0 0 21 21'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            className='absolute -bottom-[10px] -left-[10px]'
          >
            <rect
              x='0.5'
              y='0.5'
              width='20'
              height='20'
              rx='10'
              fill='white'
              stroke='#D3D3D3'
            />
            <circle cx='10.5' cy='10.5' r='3' fill='#737373' />
          </svg>
        </div>
      </div>
    </div>
  );
}
