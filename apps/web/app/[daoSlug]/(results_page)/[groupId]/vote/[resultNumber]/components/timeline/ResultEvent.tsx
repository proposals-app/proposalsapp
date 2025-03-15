import { Proposal, Selectable } from '@proposalsapp/db-indexer';
import { format } from 'date-fns';
import Link from 'next/link';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg';
import TimelineEventActiveIcon from '@/public/assets/web/timeline_event_active.svg';
import { unstable_ViewTransition as ViewTransition } from 'react';

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

interface ResultEventProps {
  eventType: TimelineEventType;
  content: string;
  timestamp: Date;
  proposal: Selectable<Proposal>;
  resultNumber: number;
  selectedResult: number;
  daoSlug: string;
  groupId: string;
  eventIndex: number;
  last: boolean;
}

const EVENT_HEIGHT = {
  [TimelineEventType.Basic]: 'h-8',
  [TimelineEventType.ResultEndedBasicVote]: 'h-[136px]',
  [TimelineEventType.ResultEndedOtherVotes]: 'h-[88px]',
  [TimelineEventType.ResultOngoingBasicVote]: 'h-[136px]',
  [TimelineEventType.ResultOngoingOtherVotes]: 'h-[88px]',
  [TimelineEventType.CommentsVolume]: 'h-1',
  [TimelineEventType.VotesVolume]: 'h-1',
  [TimelineEventType.Gap]: 'h-5',
} as const;

export function ResultEvent({
  eventType,
  content,
  proposal,
  resultNumber,
  selectedResult,
  groupId,
  last,
}: ResultEventProps) {
  const isOnchain = content.includes('Onchain vote'); // Adjust this logic based on your data model
  const voteType = isOnchain ? 'Onchain' : 'Offchain';

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.endAt);

  // Format dates
  const endDate = format(new Date(proposal.endAt), 'MMM d');

  const heightClass = EVENT_HEIGHT[eventType] || 'h-8';

  // Content to be rendered inside the div
  const eventContent = (
    <ViewTransition name={`timeline-result-${resultNumber}`}>
      <div className='relative z-20 flex items-center py-2'>
        <div
          className={`flex flex-col gap-1 py-1.5 ${last ? 'pl-5' : 'pl-3'} ${
            resultNumber == selectedResult
              ? 'w-32 border-t border-b border-l'
              : 'w-28 rounded-xs border'
            } dark:border-neutral-650 rounded-l-xs border-neutral-800 bg-white
            dark:bg-neutral-950 ${heightClass}`}
        >
          {isLive ? (
            <TimelineEventActiveIcon
              className='dark:fill-neutral-350 absolute top-3 left-1 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          ) : (
            <TimelineEventIcon
              className='dark:fill-neutral-350 absolute top-3 left-1 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          {!last && (
            <div
              className='dark:bg-neutral-350 absolute top-[7px] left-[12.5px] z-10 h-[15px] max-h-[15px]
                w-0.5 translate-x-[2.5px] bg-neutral-800'
            />
          )}
          <div className='ml-3 flex flex-col'>
            <div className='text-sm font-semibold'>{voteType}</div>

            <div className='text-foreground w-full text-sm'>
              {isLive ? (
                <div className='flex flex-col'>
                  <span className='font-bold'>Live Vote</span>
                  <div className='flex flex-col'>
                    <span>Ends </span>
                    <span className='font-bold'>{endDate}</span>
                  </div>
                </div>
              ) : (
                <div className='flex flex-col'>
                  <span>Ended </span>
                  <span className='font-bold'>{endDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ViewTransition>
  );

  // If resultNumber is not equal to selectedResult, wrap the content in a Link
  if (resultNumber !== selectedResult) {
    return (
      <Link href={`/${groupId}/vote/${resultNumber}`}>{eventContent}</Link>
    );
  }

  // Otherwise, return the content as is
  return eventContent;
}
