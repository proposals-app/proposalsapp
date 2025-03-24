'use client';

import { notFound } from 'next/navigation';
import {
  FeedEvent,
  GroupReturnType,
  ResultEvent as ResultEventType,
} from '../../../actions';
import Link from 'next/link';
import React, { useState, useRef, useEffect } from 'react';
import { ResultEventMobile } from './result-event-mobile';
import { BiChevronsUp, BiChevronsDown } from 'react-icons/bi';

enum TimelineEventType {
  ResultOngoingBasicVote = 'ResultOngoingBasicVote',
  ResultOngoingOtherVotes = 'ResultOngoingOtherVotes',
  ResultEndedBasicVote = 'ResultEndedBasicVote',
  ResultEndedOtherVotes = 'ResultEndedOtherVotes',
  Basic = 'Basic',
  CommentsVolume = 'CommentsVolume',
  VotesVolume = 'VotesVolume',
}

interface ResultsMobileProps {
  events: FeedEvent[];
  group: GroupReturnType;
}

export const ResultsMobile = ({ events, group }: ResultsMobileProps) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounce, setBounce] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBounce(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!group) {
    notFound();
  }

  // Filter for relevant events and reverse to get newest on top
  const resultEvents = (events
    ?.filter(
      (event) =>
        event.type === TimelineEventType.ResultOngoingBasicVote ||
        event.type === TimelineEventType.ResultOngoingOtherVotes ||
        event.type === TimelineEventType.ResultEndedBasicVote ||
        event.type === TimelineEventType.ResultEndedOtherVotes
    )
    .reverse() || []) as ResultEventType[];

  if (resultEvents.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group?.proposals?.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  return (
    <div className='fixed right-0 bottom-0 left-0 z-[5000] md:hidden'>
      <div
        ref={containerRef}
        className={`border-t border-neutral-200 bg-white p-2 shadow-md transition-all duration-300 ease-in-out dark:border-neutral-800 dark:bg-neutral-900 ${
          expanded
            ? 'max-h-[80vh] overflow-y-auto shadow-md'
            : 'max-h-fit overflow-hidden'
        }`}
      >
        <button
          onClick={toggleExpanded}
          className='mb-1 flex w-full items-center justify-center text-center text-sm font-bold'
          aria-label='Expand/Collapse Results'
        >
          {expanded ? (
            <BiChevronsDown size={24} />
          ) : (
            <BiChevronsUp
              className={bounce ? 'animate-bounce' : ''}
              size={24}
            />
          )}
        </button>
        <div className='flex flex-col-reverse'>
          {resultEvents.map((event, index) => {
            const resultNumber = proposalOrderMap.get(event.proposal.id) || 0;
            const isFirst = index === resultEvents.length - 1;
            const numBehind = resultEvents.length - 1 - index;

            return (
              <div
                key={index}
                className={`relative transition-all duration-300 ease-in-out`}
                style={{
                  scale: !expanded && !isFirst ? 0.95 : 1,
                  marginTop: !expanded && !isFirst ? '-20px' : 0,
                  zIndex: index,
                  opacity: !expanded ? Math.max(0, 1 - numBehind * 0.3) : 1,
                }}
              >
                {expanded ? (
                  <Link
                    href={`/${group.groupId}/vote/${resultNumber}`}
                    prefetch={true}
                  >
                    <ResultEventMobile
                      content={event.content}
                      timestamp={event.timestamp}
                      result={event.result}
                      resultNumber={resultNumber}
                      last={isFirst}
                      daoSlug={group.daoSlug}
                      groupId={group.group.id}
                      expanded={expanded}
                    />
                  </Link>
                ) : (
                  <ResultEventMobile
                    content={event.content}
                    timestamp={event.timestamp}
                    result={event.result}
                    resultNumber={resultNumber}
                    last={isFirst}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                    expanded={expanded}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
