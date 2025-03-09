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
import { useEffect, useRef, useState, useMemo } from 'react';

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
  volume: number;
  maxVolume: number;
  volumeType: 'comments';
}

interface VotesVolumeEvent extends BaseEvent {
  type: TimelineEventType.VotesVolume;
  volume: number;
  maxVolume: number;
  volumeType: 'votes';
  metadata: {
    votingPower: number;
  };
}

function aggregateVolumeEvents(events: Event[]): Event[] {
  if (!events || events.length <= 1) return events || [];

  const aggregatedEvents: Event[] = [];
  for (let i = 0; i < events.length; i++) {
    const currentEvent = events[i];
    if (
      (currentEvent.type === TimelineEventType.CommentsVolume ||
        currentEvent.type === TimelineEventType.VotesVolume) &&
      i + 1 < events.length
    ) {
      const nextEvent = events[i + 1];
      if (currentEvent.type === nextEvent.type) {
        if (currentEvent.type === TimelineEventType.CommentsVolume) {
          const aggregatedVolumeEvent: CommentsVolumeEvent = {
            type: TimelineEventType.CommentsVolume,
            timestamp:
              currentEvent.timestamp < nextEvent.timestamp
                ? currentEvent.timestamp
                : nextEvent.timestamp,
            volume:
              (currentEvent as CommentsVolumeEvent).volume +
              (nextEvent as CommentsVolumeEvent).volume,
            maxVolume: Math.max(
              (currentEvent as CommentsVolumeEvent).maxVolume,
              (nextEvent as CommentsVolumeEvent).maxVolume
            ),
            volumeType: 'comments',
          };
          aggregatedEvents.push(aggregatedVolumeEvent);
        } else if (currentEvent.type === TimelineEventType.VotesVolume) {
          const aggregatedVolumeEvent: VotesVolumeEvent = {
            type: TimelineEventType.VotesVolume,
            timestamp:
              currentEvent.timestamp < nextEvent.timestamp
                ? currentEvent.timestamp
                : nextEvent.timestamp,
            volume:
              (currentEvent as VotesVolumeEvent).volume +
              (nextEvent as VotesVolumeEvent).volume,
            maxVolume: Math.max(
              (currentEvent as VotesVolumeEvent).maxVolume,
              (nextEvent as VotesVolumeEvent).maxVolume
            ),
            volumeType: 'votes',
            metadata: {
              votingPower: (currentEvent as VotesVolumeEvent).metadata!
                .votingPower,
            },
          };
          aggregatedEvents.push(aggregatedVolumeEvent);
        }
        i++; // Skip the next event as it's aggregated
      } else {
        aggregatedEvents.push(currentEvent);
      }
    } else {
      aggregatedEvents.push(currentEvent);
    }
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

  const [rawEvents, setRawEvents] = useState<Event[] | null>(null);
  const [displayEvents, setDisplayEvents] = useState<Event[] | null>(null);
  const [animationStarted, setAnimationStarted] = useState(false);
  const [isEndVisible, setIsEndVisible] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const proposalOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    group.proposals.forEach((proposal, index) => {
      map.set(proposal.id, index + 1); // +1 to make it 1-based
    });
    return map;
  }, [group.proposals]);

  // Fetch the raw events data
  useEffect(() => {
    const fetchEvents = async () => {
      const fetchedEvents = await getEvents_cached(group);
      setRawEvents(fetchedEvents);

      // Start animation after events are loaded
      setTimeout(() => {
        setAnimationStarted(true);
      }, 100); // Small delay to ensure DOM is ready
    };

    fetchEvents();
  }, [group]);

  // Process raw events to determine display events based on visibility
  useEffect(() => {
    if (!rawEvents) return;

    if (isEndVisible) {
      // If the end is visible, show all events without aggregation
      setDisplayEvents(rawEvents);
    } else {
      // If the end is not visible, apply aggregation
      const aggregated = aggregateVolumeEvents(rawEvents);
      setDisplayEvents(aggregated);
    }
  }, [rawEvents, isEndVisible]);

  // // Set up the intersection observer for the end element
  // useEffect(() => {
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       const entry = entries[0];
  //       if (entry) {
  //         setIsEndVisible(entry.isIntersecting);
  //       }
  //     },
  //     {
  //       root: null,
  //       rootMargin: '0px',
  //       threshold: 0.1, // Detect when at least 10% is visible
  //     }
  //   );

  //   const node = endRef.current;
  //   if (node) {
  //     observer.observe(node);
  //   }

  //   return () => {
  //     if (node) {
  //       observer.unobserve(node);
  //     }
  //     observer.disconnect();
  //   };
  // }, [displayEvents]); // Re-run when displayEvents changes to ensure we observe the correct element

  if (!displayEvents) {
    return null;
  }

  return (
    <div
      ref={timelineRef}
      className='fixed top-0 right-0 flex h-full min-w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full w-full'>
        <div
          className={`dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 origin-bottom
            translate-x-[1px] bg-neutral-800 transition-transform duration-2000 ease-out
            ${animationStarted ? 'scale-y-100' : 'scale-y-0'}`}
        />

        <div className='flex h-full flex-col justify-between'>
          {displayEvents.map((event, index, array) => {
            // Calculate the animation delay from bottom to top
            // The last item (bottom) should animate first
            const animationDelay = (displayEvents.length - index - 1) * 16;

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

            // Set the end ref for the last visible element
            const isLastVisible = index === array.length - 1;

            return (
              <div
                key={`${event.type}-${index}-${event.timestamp.toString()}`}
                className={`transition-opacity duration-200 ease-in-out
                ${isVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                <div
                  className={`transform ${animationStarted ? 'translate-x-0' : 'translate-x-full'}
                  transition-all duration-500 ease-out`}
                  style={{
                    transitionDelay: `${animationDelay}ms`,
                    WebkitTransitionDelay: `${animationDelay}ms`,
                    msTransitionDelay: `${animationDelay}ms`,
                  }}
                  ref={isLastVisible ? endRef : undefined}
                >
                  {event.type === TimelineEventType.Gap ? (
                    <GapEvent />
                  ) : event.type === TimelineEventType.CommentsVolume ? (
                    <CommentsVolumeEvent
                      timestamp={event.timestamp}
                      width={event.volume / event.maxVolume}
                      last={index === 0}
                    />
                  ) : event.type === TimelineEventType.VotesVolume ? (
                    <VotesVolumeEvent
                      timestamp={event.timestamp}
                      width={event.volume / event.maxVolume}
                      last={index === 0}
                    />
                  ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
                    event.type === TimelineEventType.ResultOngoingOtherVotes ? (
                    <ResultEvent
                      content={event.content}
                      timestamp={event.timestamp}
                      result={event.result}
                      resultNumber={resultNumber!}
                      last={index === 0}
                      daoSlug={group.daoSlug}
                      groupId={group.group.id}
                    />
                  ) : event.type === TimelineEventType.ResultEndedBasicVote ||
                    event.type === TimelineEventType.ResultEndedOtherVotes ? (
                    <ResultEvent
                      content={event.content}
                      timestamp={event.timestamp}
                      result={event.result}
                      resultNumber={resultNumber!}
                      last={index === 0}
                      daoSlug={group.daoSlug}
                      groupId={group.group.id}
                    />
                  ) : event.type === TimelineEventType.Basic ? (
                    <BasicEvent
                      content={event.content}
                      timestamp={event.timestamp}
                      url={event.url}
                      last={index === 0}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
