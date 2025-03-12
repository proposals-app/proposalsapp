'use client';

import { FeedFilterEnum, VotesFilterEnum } from '@/app/searchParams';
import { notFound } from 'next/navigation';
import { FeedEvent, GroupReturnType } from '../../actions';

import { BasicEvent } from './BasicEvent';
import { CommentsVolumeEvent } from './CommentsVolumeEvent';
import { GapEvent } from './GapEvent';
import { ResultEvent } from './ResultEvent';
import { VotesVolumeEvent } from './VotesVolumeEvent';
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  RefObject,
} from 'react';

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
  return [...otherEvents, ...aggregatedVolumeEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

// Custom hook to manage timeline events and visibility logic
function useTimelineEvents(
  events: FeedEvent[],
  group: GroupReturnType,
  feedFilter: FeedFilterEnum,
  votesFilter: VotesFilterEnum
) {
  const [state, setState] = useState({
    rawEvents: events,
    aggregationLevel: 0,
    animationStarted: false,
    isFullyRendered: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastVisibilityCheckRef = useRef(Date.now());
  const VISIBILITY_CHECK_THROTTLE = 50; // ms

  // Process events based on current aggregation level
  const displayEvents = useMemo(() => {
    if (!state.rawEvents) return null;

    if (state.aggregationLevel === 0) {
      return state.rawEvents;
    } else {
      return aggregateVolumeEvents(state.rawEvents, state.aggregationLevel);
    }
  }, [state.rawEvents, state.aggregationLevel]);

  // Create a map of proposal IDs to their display order
  const proposalOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    group!.proposals.forEach((proposal, index) => {
      map.set(proposal.id, index + 1); // +1 to make it 1-based
    });
    return map;
  }, [group]);

  // Filter visible events based on filters
  const isEventVisible = useCallback(
    (event: FeedEvent) => {
      if (
        event.type === TimelineEventType.CommentsVolume &&
        (feedFilter == FeedFilterEnum.COMMENTS ||
          feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES)
      ) {
        return true;
      }
      if (
        event.type === TimelineEventType.VotesVolume &&
        (feedFilter == FeedFilterEnum.VOTES ||
          feedFilter == FeedFilterEnum.COMMENTS_AND_VOTES)
      ) {
        if (!event.metadata?.votingPower) return false;

        switch (votesFilter) {
          case VotesFilterEnum.ALL:
            return true;
          case VotesFilterEnum.FIFTY_THOUSAND:
            return event.metadata.votingPower > 50000;
          case VotesFilterEnum.FIVE_HUNDRED_THOUSAND:
            return event.metadata.votingPower > 500000;
          case VotesFilterEnum.FIVE_MILLION:
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
        TimelineEventType.Gap,
      ].includes(event.type);
    },
    [feedFilter, votesFilter]
  );

  // Get filtered events for visibility checks
  const visibleEvents = useMemo(() => {
    return displayEvents?.filter(isEventVisible) || [];
  }, [displayEvents, isEventVisible]);

  // Check if end is visible and adjust aggregation level if needed
  const checkVisibility = useCallback(() => {
    if (
      !endRef.current ||
      !containerRef.current ||
      !state.rawEvents ||
      !state.isFullyRendered ||
      visibleEvents.length === 0
    )
      return;

    // Throttle checks to avoid excessive performance impact
    const now = Date.now();
    if (now - lastVisibilityCheckRef.current < VISIBILITY_CHECK_THROTTLE) {
      return;
    }
    lastVisibilityCheckRef.current = now;

    const containerRect = containerRef.current.getBoundingClientRect();
    const endRect = endRef.current.getBoundingClientRect();
    const isEndVisible = endRect.bottom <= containerRect.bottom;

    setState((prevState) => {
      // If end is not visible and we have enough events, increase aggregation
      if (
        !isEndVisible &&
        prevState.aggregationLevel < 5 &&
        visibleEvents.length > 5
      ) {
        return {
          ...prevState,
          aggregationLevel: prevState.aggregationLevel + 1,
        };
      }
      // If end is visible with extra space, decrease aggregation
      else if (
        isEndVisible &&
        prevState.aggregationLevel > 0 &&
        endRect.bottom < containerRect.bottom - 100
      ) {
        return {
          ...prevState,
          aggregationLevel: Math.max(0, prevState.aggregationLevel - 1),
        };
      }
      return prevState;
    });
  }, [state.rawEvents, state.isFullyRendered, visibleEvents.length]);

  // Handle container size changes
  const onResize = useCallback(
    (size: { width: number; height: number }, sizeIncreased: boolean) => {
      if (size.height > 0) {
        // If the size increased, try to decrease aggregation level
        if (sizeIncreased && state.aggregationLevel > 0) {
          setState((prevState) => ({
            ...prevState,
            aggregationLevel: Math.max(0, prevState.aggregationLevel - 1),
          }));
        }

        // Still check visibility with a slight delay to allow for DOM updates
        setTimeout(checkVisibility, 50);
      }
    },
    [checkVisibility, state.aggregationLevel]
  );

  // Setup resize observer
  useResizeObserver(containerRef as React.RefObject<HTMLElement>, onResize);

  // Fetch the raw events data
  useEffect(() => {
    setTimeout(() => {
      setState((prev) => ({ ...prev, animationStarted: true }));
    }, 250);
  }, [group, feedFilter, votesFilter]);

  // Setup intersection observer for the container
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

  // Run initial visibility check when animation completes
  useEffect(() => {
    if (state.rawEvents && state.animationStarted && !state.isFullyRendered) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, isFullyRendered: true }));
        checkVisibility();
      }, 1000); // Wait for animations to complete

      return () => clearTimeout(timer);
    }
  }, [
    state.rawEvents,
    state.animationStarted,
    state.isFullyRendered,
    checkVisibility,
  ]);

  // Update check on filter changes
  useEffect(() => {
    if (state.isFullyRendered) {
      setTimeout(checkVisibility, 100);
    }
  }, [feedFilter, votesFilter, state.isFullyRendered, checkVisibility]);

  return {
    state,
    displayEvents,
    visibleEvents,
    proposalOrderMap,
    isEventVisible,
    refs: {
      containerRef,
      timelineRef,
      endRef,
    },
  };
}

// Create a separate component for timeline events to improve readability
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
          event.type === TimelineEventType.ResultOngoingOtherVotes ||
          event.type === TimelineEventType.ResultEndedBasicVote ||
          event.type === TimelineEventType.ResultEndedOtherVotes ? (
          <ResultEvent
            content={event.content}
            timestamp={event.timestamp}
            result={event.result}
            resultNumber={resultNumber!}
            last={index === 0}
            daoSlug={group!.daoSlug}
            groupId={group!.group.id}
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
}

export function Timeline({
  events,
  group,
  feedFilter,
  votesFilter,
}: {
  events: FeedEvent[];
  group: GroupReturnType;
  feedFilter: FeedFilterEnum;
  votesFilter: VotesFilterEnum;
}) {
  if (!group) {
    notFound();
  }

  const {
    state,
    displayEvents,
    visibleEvents,
    proposalOrderMap,
    isEventVisible,
    refs,
  } = useTimelineEvents(events, group, feedFilter, votesFilter);

  if (!displayEvents) {
    return null;
  }

  return (
    <div
      ref={refs.timelineRef}
      className='fixed top-0 right-0 flex h-full min-w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div
        ref={refs.containerRef}
        className='relative h-full w-full overflow-hidden'
        data-aggregation-level={state.aggregationLevel}
      >
        <div
          className={`dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 origin-bottom
            translate-x-[1px] bg-neutral-800 transition-transform duration-1000 ease-in-out
            ${state.animationStarted ? 'scale-y-100' : 'scale-y-0'}`}
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
                animationStarted={state.animationStarted}
                animationDelay={animationDelay}
                resultNumber={resultNumber}
                group={group!}
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
    size: { width: number; height: number },
    sizeIncreased: boolean
  ) => void
) {
  const prevSizeRef = useRef({ width: 0, height: 0 });

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
          callback(newSize, sizeIncreased);
        }
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, callback]);
}
