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
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg';
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
  const [originalEvents, setOriginalEvents] = useState<Event[] | null>(null);
  const [isEndVisible, setIsEndVisible] = useState(true); // Initially consider end as visible to show unmerged events

  const endRef = useRef<HTMLDivElement>(null);
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
      setOriginalEvents(fetchedEvents);
    };

    fetchEvents();
  }, [group]);

  useEffect(() => {
    if (!originalEvents) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio < 1) {
            console.log('endRef is not fully visible');
            setIsEndVisible(false);
          } else {
            console.log('endRef is fully visible');
            setIsEndVisible(true);
          }
        });
      },
      {
        threshold: 0,
      }
    );

    const node = endRef.current;
    if (node) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      if (node && observer.unobserve) observer.unobserve(node);
    };
  }, [originalEvents]);

  useEffect(() => {
    if (isEndVisible) {
      if (!originalEvents) return;
      // When endRef is visible, use original events to show all events
      setEvents(originalEvents);
    } else {
      if (!events) return;
      // When endRef is not visible, merge volume events
      const merged = mergeVolumeEvents(events);
      setEvents(merged);
    }
  }, [isEndVisible, originalEvents]);

  const mergeVolumeEvents = (eventsToMerge: Event[]): Event[] => {
    if (!eventsToMerge) return [];
    const mergedEventsArray: Event[] = [];
    let currentMergedCommentVolume: CommentsVolumeEvent | null = null;
    let currentMergedVotesVolume: VotesVolumeEvent | null = null;

    for (const event of eventsToMerge) {
      if (event.type === TimelineEventType.CommentsVolume) {
        if (currentMergedCommentVolume) {
          currentMergedCommentVolume.volume += event.volume;
          currentMergedCommentVolume.maxVolume = event.maxVolume;
          mergedEventsArray.push(currentMergedCommentVolume as Event);
          currentMergedCommentVolume = null;
        } else {
          currentMergedCommentVolume = { ...event };
        }
      } else if (event.type === TimelineEventType.VotesVolume) {
        if (currentMergedVotesVolume) {
          currentMergedVotesVolume.volume += event.volume;
          currentMergedVotesVolume.maxVolume += event.maxVolume;
          if (
            event.metadata?.votingPower &&
            currentMergedVotesVolume.metadata
          ) {
            currentMergedVotesVolume.metadata.votingPower = Math.max(
              currentMergedVotesVolume.metadata.votingPower || 0,
              event.metadata.votingPower
            );
          }
          mergedEventsArray.push(currentMergedVotesVolume as Event);
          currentMergedVotesVolume = null;
        } else {
          currentMergedVotesVolume = { ...event };
        }
      } else {
        if (currentMergedCommentVolume) {
          mergedEventsArray.push(currentMergedCommentVolume as Event);
          currentMergedCommentVolume = null;
        }
        if (currentMergedVotesVolume) {
          mergedEventsArray.push(currentMergedVotesVolume as Event);
          currentMergedVotesVolume = null;
        }
        mergedEventsArray.push(event);
      }
    }
    if (currentMergedCommentVolume) {
      mergedEventsArray.push(currentMergedCommentVolume as Event);
    }
    if (currentMergedVotesVolume) {
      mergedEventsArray.push(currentMergedVotesVolume as Event);
    }
    return mergedEventsArray;
  };

  if (!events) {
    return <LoadingTimeline />;
  }

  return (
    <div
      className='fixed top-0 right-0 flex h-full min-w-96 flex-col items-end justify-start pt-24
        pl-4'
    >
      <div className='relative h-full w-full'>
        <div
          className='dark:bg-neutral-350 absolute top-4 bottom-4 left-[14px] w-0.5 translate-x-[1px]
            bg-neutral-800'
        />

        <div className='flex h-full flex-col justify-between'>
          {events.map((event, index, array) => {
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
                ref={index == array.length - 1 ? endRef : undefined}
              >
                {event.type === TimelineEventType.Gap ? (
                  <GapEvent />
                ) : event.type === TimelineEventType.CommentsVolume ? (
                  <CommentsVolumeEvent
                    timestamp={event.timestamp}
                    width={event.volume / event.maxVolume}
                    last={index == 0}
                  />
                ) : event.type === TimelineEventType.VotesVolume ? (
                  <VotesVolumeEvent
                    timestamp={event.timestamp}
                    width={event.volume / event.maxVolume}
                    last={index == 0}
                  />
                ) : event.type === TimelineEventType.ResultOngoingBasicVote ||
                  event.type === TimelineEventType.ResultOngoingOtherVotes ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    result={event.result}
                    resultNumber={resultNumber!}
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
                    resultNumber={resultNumber!}
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
    <div className='fixed top-0 right-0 flex h-full w-96 flex-col items-end justify-start pt-24 pl-4'>
      <div className='relative h-full w-full'>
        <div
          className='absolute top-1 flex h-8 w-8 items-center justify-center rounded-xs border
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
          className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border
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
