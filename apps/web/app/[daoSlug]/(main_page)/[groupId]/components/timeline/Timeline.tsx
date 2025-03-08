'use client';

import { VotesFilterEnum } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { GroupReturnType } from '../../actions';
import { getEvents_cached, Event } from './actions';
import { BasicEvent } from './BasicEvent';
import { CommentsVolumeEvent } from './CommentsVolumeEvent';
import { GapEvent } from './GapEvent';
import { ResultEvent } from './ResultEvent';
import { VotesVolumeEvent } from './VotesVolumeEvent';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg'; // Import the SVG as a React component
import { useEffect, useRef, useState, useMemo } from 'react';
import { format } from 'date-fns';

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
  Gap = 'Gap',
}

interface BaseEvent {
  type: TimelineEventType;
  timestamp: Date;
  metadata?: {
    votingPower?: number;
    commentCount?: number;
  };
}

interface CommentsVolumeEvent extends BaseEvent {
  type: TimelineEventType.CommentsVolume;
  content: string;
  volume: number;
  volumeType: 'comments';
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  content: string;
  volume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

const MAX_HEIGHT = 840;
const MIN_TIME_BETWEEN_EVENTS_AGGREGATION = 1000 * 60 * 60 * 24; // 1 day in milliseconds

function aggregateVolumeEvents(
  events: Event[],
  type: TimelineEventType.CommentsVolume | TimelineEventType.VotesVolume,
  timeWindow: number
): Event[] {
  const volumeEvents = events.filter((e) => e.type === type) as
    | CommentsVolumeEvent[]
    | VotesVolumeEvent[];

  if (volumeEvents.length <= 1) return volumeEvents;

  const aggregatedEvents: Event[] = [];
  let currentWindow: (CommentsVolumeEvent | VotesVolumeEvent)[] = [];
  let windowStart = volumeEvents[0].timestamp;

  const createAggregatedEvent = (
    windowEvents: (CommentsVolumeEvent | VotesVolumeEvent)[],
    lastTimestamp: Date
  ): CommentsVolumeEvent | VotesVolumeEvent => {
    const totalVolume = windowEvents.reduce((sum, e) => sum + e.volume, 0);
    const isComments = type === TimelineEventType.CommentsVolume;
    const firstTimestamp = windowEvents[0].timestamp;

    const aggregatedContent = `${windowEvents.length} ${isComments ? 'comment' : 'vote'} events from ${format(firstTimestamp, 'MMM d')} to ${format(lastTimestamp, 'MMM d')}`;

    if (isComments) {
      return {
        type: TimelineEventType.CommentsVolume,
        timestamp: lastTimestamp,
        content: aggregatedContent,
        volume: totalVolume / windowEvents.length, // Average volume
        volumeType: 'comments',
      } as CommentsVolumeEvent;
    } else {
      const totalVotingPower = windowEvents.reduce(
        (sum, e) => sum + (e.metadata?.votingPower || 0),
        0
      );

      return {
        type: TimelineEventType.VotesVolume,
        timestamp: lastTimestamp,
        content: aggregatedContent,
        volume: totalVolume / windowEvents.length, // Average volume
        volumeType: 'votes',
        metadata: {
          votingPower: totalVotingPower,
        },
      } as VotesVolumeEvent;
    }
  };

  volumeEvents.forEach((event) => {
    if (event.timestamp.getTime() - windowStart.getTime() <= timeWindow) {
      currentWindow.push(event);
    } else {
      if (currentWindow.length > 0) {
        const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
        aggregatedEvents.push(
          createAggregatedEvent(currentWindow, lastTimestamp)
        );
      }
      currentWindow = [event];
      windowStart = event.timestamp;
    }
  });

  if (currentWindow.length > 0) {
    const lastTimestamp = currentWindow[currentWindow.length - 1].timestamp;
    aggregatedEvents.push(createAggregatedEvent(currentWindow, lastTimestamp));
  }

  return aggregatedEvents;
}

export function Timeline({
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

  const [events, setEvents] = useState<Event[] | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const proposalOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    group.proposals.forEach((proposal, index) => {
      map.set(proposal.id, index + 1); // +1 to make it 1-based
    });
    return map;
  }, [group.proposals]);

  useEffect(() => {
    const fetchEvents = async () => {
      const fetchedEvents = await getEvents_cached(group);
      setEvents(fetchedEvents);
    };

    fetchEvents();
  }, [group]);

  useEffect(() => {
    if (!events || !timelineRef.current) return;

    if (timelineRef.current.offsetHeight > MAX_HEIGHT) {
      const commentVolumeEvents = events.filter(
        (event) => event.type === TimelineEventType.CommentsVolume
      );
      const voteVolumeEvents = events.filter(
        (event) => event.type === TimelineEventType.VotesVolume
      );
      const nonVolumeEvents = events.filter(
        (event) =>
          event.type !== TimelineEventType.CommentsVolume &&
          event.type !== TimelineEventType.VotesVolume
      );

      const aggregatedCommentEvents = aggregateVolumeEvents(
        commentVolumeEvents,
        TimelineEventType.CommentsVolume,
        MIN_TIME_BETWEEN_EVENTS_AGGREGATION
      );
      const aggregatedVoteEvents = aggregateVolumeEvents(
        voteVolumeEvents,
        TimelineEventType.VotesVolume,
        MIN_TIME_BETWEEN_EVENTS_AGGREGATION
      );

      const aggregatedEvents = [
        ...nonVolumeEvents,
        ...aggregatedCommentEvents,
        ...aggregatedVoteEvents,
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setEvents(aggregatedEvents);
    }
  }, [events]);

  if (!events) {
    return <LoadingTimeline />;
  }

  return (
    <div
      className='fixed top-0 right-0 flex h-screen w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full max-h-[840px] w-full' ref={timelineRef}>
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
