'use client';

import {
  TimelineEventType,
  type CommentsVolumeEvent,
  type FeedEvent,
  type VotesVolumeEvent,
} from '@/lib/types';
import type { GroupReturnType } from '../../actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { CommentsVolume } from './comments-volume';
import { VotesVolume } from './votes-volume';
import { Result } from './result';
import { Basic } from './basic';
import { notFound } from 'next/navigation';

/**
 * Aggregates volume events to reduce visual clutter based on a specified level
 */
function aggregateVolumeEvents(
  events: FeedEvent[],
  level: number = 1
): FeedEvent[] {
  if (!events || events.length <= 1) return events || [];

  // Group events by type for easier aggregation
  const volumeEvents: FeedEvent[] = [];
  const otherEvents: FeedEvent[] = [];

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
  const aggregatedVolumeEvents: FeedEvent[] = [];

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
        // Initialize aggregated arrays
        const aggregatedVolumes: number[] = Array(
          voteEvents[0].volumes.length
        ).fill(0);
        const colors: string[] = voteEvents[0].colors || [];

        // Sum up volumes for each choice
        voteEvents.forEach((event) => {
          event.volumes.forEach((vol, idx) => {
            if (idx < aggregatedVolumes.length) {
              aggregatedVolumes[idx] += vol;
            }
          });
        });

        const aggregatedVoteEvent: VotesVolumeEvent = {
          type: TimelineEventType.VotesVolume,
          timestamp: new Date(
            Math.min(...voteEvents.map((e) => e.timestamp.getTime()))
          ),
          volumes: aggregatedVolumes,
          colors,
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
  return [...otherEvents, ...aggregatedVolumeEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

// Custom hook to manage timeline events and visibility logic
function useTimelineEvents(
  events: FeedEvent[],
  group: GroupReturnType,
  feedFilter: FeedFilterEnum,
  fromFilter: FromFilterEnum
) {
  // Refs for DOM elements and visibility checking
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Use refs for state that shouldn't trigger re-renders on their own
  const animationStartedRef = useRef(false);
  const isFullyRenderedRef = useRef(false);
  const lastFiltersRef = useRef({ feedFilter, fromFilter });

  // State that requires re-renders
  const [aggregationLevel, setAggregationLevel] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0); // Used to force re-renders when needed

  // Create a map of proposal IDs to their display order (memoized once)
  const proposalOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    group?.proposals?.forEach((proposal, index) => {
      map.set(proposal.id, index + 1); // +1 to make it 1-based
    });
    return map;
  }, [group]);

  // Filter logic based on user-selected filters
  const isEventVisible = useCallback(
    (event: FeedEvent) => {
      if (
        event.type === TimelineEventType.CommentsVolume &&
        (feedFilter === FeedFilterEnum.COMMENTS ||
          feedFilter === FeedFilterEnum.COMMENTS_AND_VOTES)
      ) {
        return true;
      }

      if (
        event.type === TimelineEventType.VotesVolume &&
        (feedFilter === FeedFilterEnum.VOTES ||
          feedFilter === FeedFilterEnum.COMMENTS_AND_VOTES)
      ) {
        if (!event.metadata?.votingPower) return false;

        switch (fromFilter) {
          case FromFilterEnum.ALL:
            return true;
          case FromFilterEnum.FIFTY_THOUSAND:
            return event.metadata.votingPower > 50000;
          case FromFilterEnum.FIVE_HUNDRED_THOUSAND:
            return event.metadata.votingPower > 500000;
          case FromFilterEnum.FIVE_MILLION:
            return event.metadata.votingPower > 5000000;
          default:
            return false;
        }
      }

      // Always show these event types
      return [
        TimelineEventType.Basic,
        TimelineEventType.ResultOngoingBasicVote,
        TimelineEventType.ResultOngoingOtherVotes,
        TimelineEventType.ResultEndedBasicVote,
        TimelineEventType.ResultEndedOtherVotes,
        TimelineEventType.Discussion,
        TimelineEventType.Offchain,
        TimelineEventType.Onchain,
      ].includes(event.type);
    },
    [feedFilter, fromFilter]
  );

  // Process events based on current aggregation level (memoized)
  const displayEvents = useMemo(() => {
    if (!events) return null;

    return aggregationLevel === 0
      ? events
      : aggregateVolumeEvents(events, aggregationLevel);
  }, [events, aggregationLevel]);

  // Get filtered events based on visibility criteria (memoized)
  const visibleEvents = useMemo(() => {
    return displayEvents?.filter(isEventVisible) || [];
  }, [displayEvents, isEventVisible]);

  // Check if end is visible and adjust aggregation level if needed
  const checkVisibility = useCallback(() => {
    if (
      !endRef.current ||
      !containerRef.current ||
      !events ||
      !isFullyRenderedRef.current
    )
      return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const endRect = endRef.current.getBoundingClientRect();
    const isEndVisible = endRect.bottom <= containerRect.bottom;

    // If end is not visible and we have enough events, increase aggregation
    if (!isEndVisible && aggregationLevel < 5 && visibleEvents.length > 5) {
      setAggregationLevel((prev) => prev + 1);
    }
    // If end is visible with extra space, decrease aggregation
    else if (
      isEndVisible &&
      aggregationLevel > 0 &&
      endRect.bottom < containerRect.bottom - 100
    ) {
      setAggregationLevel((prev) => Math.max(0, prev - 1));
    }
  }, [events, aggregationLevel, visibleEvents.length]);

  // Handle container size changes
  const onResize = useCallback(
    (size: { width: number; height: number }, sizeIncreased: boolean) => {
      if (size.height > 0) {
        // If the size increased, try to decrease aggregation level
        if (sizeIncreased && aggregationLevel > 0) {
          setAggregationLevel((prev) => Math.max(0, prev - 1));
        }

        // Check visibility with a slight delay to allow for DOM updates
        setTimeout(checkVisibility, 50);
      }
    },
    [checkVisibility, aggregationLevel]
  );

  // Setup resize observer
  useResizeObserver(containerRef as React.RefObject<HTMLElement>, onResize);

  // Start animation after a slight delay
  useEffect(() => {
    const timer = setTimeout(() => {
      animationStartedRef.current = true;
      setForceUpdate((prev) => prev + 1);
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  // Setup intersection observer for checking visibility when scrolling
  useEffect(() => {
    if (!containerRef.current) return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(checkVisibility, 50);
        }
      },
      { threshold: 0.1 }
    );

    intersectionObserver.observe(containerRef.current);
    return () => intersectionObserver.disconnect();
  }, [checkVisibility]);

  // Mark timeline as fully rendered after animations complete
  useEffect(() => {
    if (events && animationStartedRef.current && !isFullyRenderedRef.current) {
      const timer = setTimeout(() => {
        isFullyRenderedRef.current = true;
        checkVisibility();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [events, checkVisibility, forceUpdate]);

  // Check if filters have changed and update accordingly
  useEffect(() => {
    const prevFilters = lastFiltersRef.current;

    // Only perform these actions if filters have actually changed
    if (
      prevFilters.feedFilter !== feedFilter ||
      prevFilters.fromFilter !== fromFilter
    ) {
      // Update the stored filters
      lastFiltersRef.current = { feedFilter, fromFilter };

      // Reset aggregation level when filters change to prevent visual glitches
      setAggregationLevel(0);

      // Schedule visibility check after DOM update
      if (isFullyRenderedRef.current) {
        setTimeout(checkVisibility, 100);
      }
    }
  }, [feedFilter, fromFilter, checkVisibility]);

  return {
    displayEvents,
    visibleEvents,
    proposalOrderMap,
    isEventVisible,
    aggregationLevel,
    animationStarted: animationStartedRef.current,
    refs: {
      containerRef,
      timelineRef,
      endRef,
    },
  };
}

// Create a memo-optimized component for timeline events
const TimelineEventItem = React.memo(
  function TimelineEventItem({
    event,
    index,
    isVisible,
    isLastVisible,
    animationStarted,
    animationDelay,
    resultNumber,
    group,
    endRef,
  }: {
    event: FeedEvent;
    index: number;
    isVisible: boolean;
    isLastVisible: boolean;
    animationStarted: boolean;
    animationDelay: number;
    resultNumber?: number;
    group: GroupReturnType;
    endRef: React.RefObject<HTMLDivElement | null>;
  }) {
    return (
      <div
        className={`transition-opacity duration-200 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className={`transform ${animationStarted ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-500 ease-out`}
          style={{
            transitionDelay: `${animationDelay}ms`,
            WebkitTransitionDelay: `${animationDelay}ms`,
            msTransitionDelay: `${animationDelay}ms`,
          }}
          ref={isLastVisible ? endRef : undefined}
        >
          {event.type === TimelineEventType.CommentsVolume ? (
            <CommentsVolume
              timestamp={event.timestamp}
              width={event.volume / event.maxVolume}
              last={index === 0}
              index={index}
            />
          ) : event.type === TimelineEventType.VotesVolume ? (
            <VotesVolume
              timestamp={event.timestamp}
              width={event.maxVolume}
              volumes={event.volumes}
              colors={event.colors}
              last={index === 0}
              index={index}
            />
          ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
            event.type === TimelineEventType.ResultOngoingOtherVotes ||
            event.type === TimelineEventType.ResultEndedBasicVote ||
            event.type === TimelineEventType.ResultEndedOtherVotes ? (
            <Result
              content={event.content}
              timestamp={event.timestamp}
              result={event.result}
              resultNumber={resultNumber!}
              daoSlug={group!.daoSlug}
              groupId={group!.group.id}
              live={event.live}
            />
          ) : event.type === TimelineEventType.Basic ||
            event.type === TimelineEventType.Discussion ||
            event.type === TimelineEventType.Onchain ||
            event.type === TimelineEventType.Offchain ? (
            <Basic
              content={event.content}
              timestamp={event.timestamp}
              url={event.url}
              type={event.type}
            />
          ) : null}
        </div>
      </div>
    );
  },
  // Optimize re-renders by comparing relevant props
  (prevProps, nextProps) => {
    return (
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.isLastVisible === nextProps.isLastVisible &&
      prevProps.animationStarted === nextProps.animationStarted &&
      prevProps.animationDelay === nextProps.animationDelay &&
      prevProps.index === nextProps.index &&
      prevProps.resultNumber === nextProps.resultNumber &&
      prevProps.event.type === nextProps.event.type
    );
  }
);

export function Timeline({
  events,
  group,
  feedFilter,
  fromFilter,
}: {
  events: FeedEvent[];
  group: GroupReturnType;
  feedFilter: FeedFilterEnum;
  fromFilter: FromFilterEnum;
}) {
  if (!group) {
    notFound();
  }

  const {
    displayEvents,
    visibleEvents,
    proposalOrderMap,
    isEventVisible,
    aggregationLevel,
    animationStarted,
    refs,
  } = useTimelineEvents(events, group, feedFilter, fromFilter);

  if (!displayEvents) {
    return null;
  }

  return (
    <div
      ref={refs.timelineRef}
      className='fixed top-0 right-0 hidden h-full min-w-96 flex-col items-end justify-start pt-24 pl-4 md:flex'
    >
      <div
        ref={refs.containerRef}
        className='relative h-full w-full'
        data-aggregation-level={aggregationLevel}
      >
        <div
          className={`dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 origin-bottom translate-x-[1px] bg-neutral-800 transition-transform duration-1000 ease-in-out ${animationStarted ? 'scale-y-100' : 'scale-y-0'}`}
        />

        <div className='flex h-full flex-col justify-between'>
          {displayEvents.map((event, index) => {
            // Calculate the animation delay from bottom to top
            // The last item (bottom) should animate first
            let animationDelay = 0;
            if (displayEvents.length > 1) {
              animationDelay =
                ((displayEvents.length - 1 - index) /
                  (displayEvents.length - 1)) *
                700;
            }

            const isVisible = isEventVisible(event);
            const isLastVisible =
              visibleEvents.length > 0 &&
              event === visibleEvents[visibleEvents.length - 1];

            const resultNumber =
              event.type === TimelineEventType.ResultOngoingBasicVote ||
              event.type === TimelineEventType.ResultOngoingOtherVotes ||
              event.type === TimelineEventType.ResultEndedBasicVote ||
              event.type === TimelineEventType.ResultEndedOtherVotes
                ? proposalOrderMap.get(event.result.proposal.id)
                : undefined;

            return (
              <TimelineEventItem
                key={`${event.type}-${index}-${event.timestamp.toString()}`}
                event={event}
                index={index}
                isVisible={isVisible}
                isLastVisible={isLastVisible}
                animationStarted={animationStarted}
                animationDelay={animationDelay}
                resultNumber={resultNumber}
                group={group}
                endRef={refs.endRef}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function useResizeObserver(
  ref: RefObject<HTMLElement>,
  callback: (
    _size: { width: number; height: number },
    _sizeIncreased: boolean
  ) => void
) {
  const prevSizeRef = useRef({ width: 0, height: 0 });
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const element = entries[0];
      if (element) {
        const newSize = {
          width: element.contentRect.width,
          height: element.contentRect.height,
        };

        // Only call callback if size actually changed
        if (
          newSize.width !== prevSizeRef.current.width ||
          newSize.height !== prevSizeRef.current.height
        ) {
          // Determine if the size increased
          const sizeIncreased =
            newSize.height > prevSizeRef.current.height ||
            newSize.width > prevSizeRef.current.width;

          prevSizeRef.current = newSize;
          callbackRef.current(newSize, sizeIncreased);
        }
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]); // Only depends on ref to avoid unnecessary cleanup/setup
}
