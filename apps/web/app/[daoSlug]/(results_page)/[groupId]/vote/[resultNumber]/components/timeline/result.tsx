import { Proposal, Selectable } from '@proposalsapp/db-indexer';
import { format } from 'date-fns';
import Link from 'next/link';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import { TimelineEventType } from '@/lib/types';

interface ResultProps {
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
  [TimelineEventType.Discussion]: 'h-8',
  [TimelineEventType.Offchain]: 'h-8',
  [TimelineEventType.Onchain]: 'h-8',
} as const;

export function Result({
  eventType,
  proposal,
  resultNumber,
  selectedResult,
  groupId,
  last,
}: ResultProps) {
  const onchain = proposal.blockCreatedAt ? true : false;
  const voteType = onchain ? 'Onchain' : 'Offchain';

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.endAt);

  // Format dates
  const endDate = format(new Date(proposal.endAt), 'MMM d');

  const heightClass = EVENT_HEIGHT[eventType] || 'h-8';

  // Content to be rendered inside the div
  const eventContent = (
    <div className='relative z-20 flex items-center py-2'>
      <div
        className={`flex flex-col gap-1 py-1.5 ${last ? 'pl-5' : 'pl-3'} ${
          resultNumber == selectedResult
            ? 'w-32 border-t border-b border-l'
            : 'w-28 rounded-xs border'
        } dark:border-neutral-650 rounded-l-xs border-neutral-800 bg-white dark:bg-neutral-950 ${heightClass}`}
      >
        {onchain ? (
          <OnchainEventIcon
            className='dark:fill-neutral-350 absolute top-3 left-1 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
          />
        ) : (
          <OffchainEventIcon
            className='dark:fill-neutral-350 absolute top-3 left-1 fill-neutral-800'
            width={24}
            height={24}
            alt={'Timeline event'}
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
