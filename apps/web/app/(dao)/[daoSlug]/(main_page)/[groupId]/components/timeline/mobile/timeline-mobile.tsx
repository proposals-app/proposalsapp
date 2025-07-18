'use client';

import { notFound } from 'next/navigation';
import type { GroupReturnType } from '../../../actions';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { ResultEventMobile } from './result-mobile';
import { BiChevronsDown, BiChevronsUp } from 'react-icons/bi';
import type { ResultEvent } from '@/lib/types';

interface ResultsMobileProps {
  events: ResultEvent[];
  group: GroupReturnType;
}

export const ResultsMobile = ({ events, group }: ResultsMobileProps) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounce, setBounce] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBounce(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!group) {
    notFound();
  }

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group?.proposals?.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  if (!events.length) {
    return null;
  }

  return (
    <div className='fixed right-0 bottom-0 left-0 z-40 md:hidden'>
      <div
        ref={containerRef}
        className={`border-t border-neutral-200 bg-white p-2 shadow-md transition-all duration-300 ease-in-out dark:border-neutral-800 dark:bg-neutral-900 ${
          expanded
            ? 'max-h-[80vh] overflow-y-auto shadow-md'
            : 'max-h-22 overflow-hidden'
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
        <div className='flex flex-col'>
          {events.map((event, index) => {
            const resultNumber = proposalOrderMap.get(event.proposal.id) || 0;
            // correctly identify the first element after reverse (newest event)
            const isFirst = index === 0;
            const numBehind = index;

            return (
              <div
                key={index}
                className={`relative transition-all duration-300 ease-in-out`}
                style={{
                  scale:
                    !expanded && !isFirst
                      ? Math.max(0, 1 - numBehind * 0.05)
                      : 1,
                  marginTop: !expanded && !isFirst ? '-20px' : 0,
                  zIndex: events.length - index,
                  opacity:
                    !expanded && !isFirst
                      ? Math.max(0, 1 - numBehind * 0.3)
                      : 1,
                }}
              >
                {expanded ? (
                  <Link href={`/${group.groupId}/vote/${resultNumber}`}>
                    <ResultEventMobile
                      content={event.content}
                      timestamp={event.timestamp}
                      result={event.result}
                      resultNumber={resultNumber}
                      last={isFirst}
                      daoSlug={group.daoSlug}
                      groupId={group.group.id}
                      expanded={expanded}
                      live={event.live}
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
                    live={event.live}
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
