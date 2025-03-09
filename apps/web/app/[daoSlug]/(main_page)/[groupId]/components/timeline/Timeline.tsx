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
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

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

function aggregateVolumeEvents(events: Event[], level: number = 1): Event[] {
  if (!events || events.length <= 1) return events || [];

  // Group events by type for easier aggregation
  const volumeEvents: Event[] = [];
  const otherEvents: Event[] = [];

  events.forEach((event) => {
    if (
      event.type === TimelineEventType.CommentsVolume ||
      event.type === TimelineEventType.VotesVolume
    ) {
      volumeEvents.push(event);
    } else {
      otherEvents.push(event);
    }
  });

  // Skip if there are no volume events to aggregate
  if (volumeEvents.length <= 1) return events;

  // Calculate how many events to merge based on the level
  // Higher level means more aggressive aggregation
  const mergeCount = Math.min(Math.pow(2, level), volumeEvents.length);

  // Group volume events for aggregation
  const aggregatedVolumeEvents: Event[] = [];

  for (let i = 0; i < volumeEvents.length; i += mergeCount) {
    const chunk = volumeEvents.slice(i, i + mergeCount);

    if (chunk.length === 1) {
      // No need to aggregate a single event
      aggregatedVolumeEvents.push(chunk[0]);
    } else {
      // Group events by type
      const commentEvents = chunk.filter(
        (e) => e.type === TimelineEventType.CommentsVolume
      ) as CommentsVolumeEvent[];
      const voteEvents = chunk.filter(
        (e) => e.type === TimelineEventType.VotesVolume
      ) as VotesVolumeEvent[];

      // Aggregate comment events if any
      if (commentEvents.length > 0) {
        const aggregatedCommentEvent: CommentsVolumeEvent = {
          type: TimelineEventType.CommentsVolume,
          timestamp: new Date(
            Math.min(...commentEvents.map((e) => e.timestamp.getTime()))
          ),
          volume: commentEvents.reduce((sum, e) => sum + e.volume, 0),
          maxVolume: Math.max(...commentEvents.map((e) => e.maxVolume)),
          volumeType: 'comments',
        };
        aggregatedVolumeEvents.push(aggregatedCommentEvent);
      }

      // Aggregate vote events if any
      if (voteEvents.length > 0) {
        const aggregatedVoteEvent: VotesVolumeEvent = {
          type: TimelineEventType.VotesVolume,
          timestamp: new Date(
            Math.min(...voteEvents.map((e) => e.timestamp.getTime()))
          ),
          volume: voteEvents.reduce((sum, e) => sum + e.volume, 0),
          maxVolume: Math.max(...voteEvents.map((e) => e.maxVolume)),
          volumeType: 'votes',
          metadata: {
            votingPower: Math.max(
              ...voteEvents.map((e) => e.metadata?.votingPower || 0)
            ),
          },
        };
        aggregatedVolumeEvents.push(aggregatedVoteEvent);
      }
    }
  }

  // Merge and sort all events by timestamp
  const result = [...otherEvents, ...aggregatedVolumeEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  return result;
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
  const [aggregationLevel, setAggregationLevel] = useState(0);
  const [isFullyRendered, setIsFullyRendered] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track visibility check timing
  const lastVisibilityCheckRef = useRef(Date.now());
  const visibilityCheckThrottleRef = useRef(250); // ms

  const proposalOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    group.proposals.forEach((proposal, index) => {
      map.set(proposal.id, index + 1); // +1 to make it 1-based
    });
    return map;
  }, [group.proposals]);

  // Filter visible events based on filters
  const getVisibleEvents = useCallback(
    (events: Event[]) => {
      return events.filter(
        (event) =>
          (event.type === TimelineEventType.CommentsVolume && commentsFilter) ||
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
          event.type === TimelineEventType.Gap
      );
    },
    [commentsFilter, votesFilter]
  );

  // Check if end is visible and adjust aggregation level if needed
  const checkVisibility = useCallback(() => {
    if (
      !endRef.current ||
      !containerRef.current ||
      !rawEvents ||
      !isFullyRendered
    )
      return;

    // Throttle checks to avoid excessive performance impact
    const now = Date.now();
    if (
      now - lastVisibilityCheckRef.current <
      visibilityCheckThrottleRef.current
    ) {
      return;
    }
    lastVisibilityCheckRef.current = now;

    const containerRect = containerRef.current.getBoundingClientRect();
    const endRect = endRef.current.getBoundingClientRect();

    const isEndVisible = endRect.bottom <= containerRect.bottom;

    // Get visible count to make better decisions
    const visibleEventsCount = getVisibleEvents(displayEvents || []).length;

    if (!isEndVisible && aggregationLevel < 5 && visibleEventsCount > 5) {
      // Only increase aggregation if we have enough events to warrant it
      setAggregationLevel((prev) => prev + 1);
    } else if (
      isEndVisible &&
      aggregationLevel > 0 &&
      endRect.bottom < containerRect.bottom - 100
    ) {
      // End is visible with extra space, try to decrease aggregation
      setAggregationLevel((prev) => Math.max(0, prev - 1));
    }
  }, [
    rawEvents,
    displayEvents,
    aggregationLevel,
    isFullyRendered,
    getVisibleEvents,
  ]);

  // Fetch the raw events data
  useEffect(() => {
    const fetchEvents = async () => {
      const fetchedEvents = await getEvents_cached(group);
      setRawEvents(fetchedEvents);

      // Start animation after events are loaded
      setTimeout(() => {
        setAnimationStarted(true);
      }, 250); // Small delay to ensure DOM is ready
    };

    fetchEvents();
  }, [group]);

  // Process events based on current aggregation level
  useEffect(() => {
    if (!rawEvents) return;

    if (aggregationLevel === 0) {
      // Use raw events without aggregation
      setDisplayEvents(rawEvents);
    } else {
      // Apply aggregation at the current level
      const aggregated = aggregateVolumeEvents(rawEvents, aggregationLevel);
      setDisplayEvents(aggregated);
    }
  }, [rawEvents, aggregationLevel]);

  // Set up resize observer to check visibility when layout changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Add a small delay to ensure the DOM has updated
      setTimeout(checkVisibility, 50);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [checkVisibility]);

  // Setup scroll observer
  useEffect(() => {
    if (!containerRef.current) return;

    // Use IntersectionObserver for more efficient visibility detection
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        // When container visibility changes, check child visibility
        if (entries[0].isIntersecting) {
          setTimeout(checkVisibility, 50);
        }
      },
      { threshold: 0.1 }
    );

    intersectionObserver.observe(containerRef.current);

    return () => {
      intersectionObserver.disconnect();
    };
  }, [checkVisibility]);

  // Run initial visibility check when animation completes and events are displayed
  useEffect(() => {
    if (displayEvents && animationStarted) {
      // Mark as fully rendered after animation completes
      const timer = setTimeout(() => {
        setIsFullyRendered(true);
        checkVisibility();
      }, 1000); // Wait for animations to complete

      return () => clearTimeout(timer);
    }
  }, [displayEvents, animationStarted, checkVisibility]);

  // Check visibility periodically in case other checks fail
  useEffect(() => {
    if (displayEvents && isFullyRendered) {
      const intervalId = setInterval(checkVisibility, 2000);
      return () => clearInterval(intervalId);
    }
  }, [displayEvents, isFullyRendered, checkVisibility]);

  // Update check on filter changes
  useEffect(() => {
    if (isFullyRendered) {
      setTimeout(checkVisibility, 100);
    }
  }, [commentsFilter, votesFilter, isFullyRendered, checkVisibility]);

  if (!displayEvents) {
    return null;
  }

  return (
    <div
      ref={timelineRef}
      className='fixed top-0 right-0 flex h-full min-w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div
        ref={containerRef}
        className='relative h-full w-full overflow-hidden'
        data-aggregation-level={aggregationLevel} // For debugging purposes
      >
        <div
          className={`dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 origin-bottom
            translate-x-[1px] bg-neutral-800 transition-transform duration-1000 ease-in-out
            ${animationStarted ? 'scale-y-100' : 'scale-y-0'}`}
        />

        <div className='flex h-full flex-col justify-between'>
          {displayEvents.map((event, index, array) => {
            // Calculate the animation delay from bottom to top
            // The last item (bottom) should animate first
            let animationDelay = 0;
            if (displayEvents.length > 1) {
              animationDelay =
                ((displayEvents.length - 1 - index) /
                  (displayEvents.length - 1)) *
                700;
            }

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

            // Find the last visible element
            const visibleEvents = array.filter((e, i) => {
              // Use the same visibility calculation logic
              return (
                (e.type === TimelineEventType.CommentsVolume &&
                  commentsFilter) ||
                (e.type === TimelineEventType.VotesVolume &&
                  e.metadata?.votingPower &&
                  (votesFilter === VotesFilterEnum.ALL ||
                    (votesFilter === VotesFilterEnum.FIFTY_THOUSAND &&
                      e.metadata.votingPower > 50000) ||
                    (votesFilter === VotesFilterEnum.FIVE_HUNDRED_THOUSAND &&
                      e.metadata.votingPower > 500000) ||
                    (votesFilter === VotesFilterEnum.FIVE_MILLION &&
                      e.metadata.votingPower > 5000000))) ||
                e.type === TimelineEventType.Basic ||
                e.type === TimelineEventType.ResultOngoingBasicVote ||
                e.type === TimelineEventType.ResultOngoingOtherVotes ||
                e.type === TimelineEventType.ResultEndedBasicVote ||
                e.type === TimelineEventType.ResultEndedOtherVotes ||
                e.type === TimelineEventType.Gap
              );
            });

            const lastVisibleIndex = array.indexOf(
              visibleEvents[visibleEvents.length - 1]
            );
            const isLastVisible = index === lastVisibleIndex;

            return (
              <div
                key={`${event.type}-${index}-${event.timestamp.toString()}`}
                className={`transition-opacity duration-200 ease-in-out
                ${isVisible ? 'opacity-100' : 'h-0 overflow-hidden opacity-0'}`}
              >
                <div
                  className={`transform ${animationStarted ? 'translate-x-0' : 'translate-x-full'}
                  transition-all duration-500 ease-out`}
                  style={{
                    transitionDelay: `${animationDelay}ms`,
                    WebkitTransitionDelay: `${animationDelay}ms`,
                    msTransitionDelay: `${animationDelay}ms`,
                  }}
                  ref={isLastVisible && isVisible ? endRef : undefined}
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
