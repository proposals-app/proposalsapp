import { Proposal, Selectable } from '@proposalsapp/db';
import { format } from 'date-fns';
import Link from 'next/link';
import TimelineEventIcon from '@/public/assets/web/timeline_event.svg';
import TimelineEventActiveIcon from '@/public/assets/web/timeline_event_active.svg';

interface ResultEventProps {
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

export function ResultEvent({
  content,
  proposal,
  resultNumber,
  selectedResult,
  groupId,

  last,
}: ResultEventProps) {
  // Determine if the vote is onchain or offchain
  const isOnchain = content.includes('Onchain vote'); // Adjust this logic based on your data model
  const voteType = isOnchain ? 'Onchain' : 'Offchain';

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.endAt);

  // Format dates
  const endDate = format(new Date(proposal.endAt), 'MMM d');

  // Content to be rendered inside the div
  const eventContent = (
    <div className='relative z-20 flex items-center py-2'>
      <div
        className={`flex flex-col gap-1 py-1.5 ${last ? 'pl-5' : 'pl-3'} ${
          resultNumber == selectedResult
            ? 'w-32 border-t border-b border-l'
            : 'w-24 border'
          } border-neutral-800 bg-white`}
      >
        {isLive ? (
          <TimelineEventActiveIcon
            className='dark:fill-neutral-350 absolute top-3 left-2 fill-neutral-800'
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
            className='absolute top-[7px] left-[12.5px] z-10 h-[15px] max-h-[15px] w-0.5
              translate-x-[2.5px] bg-neutral-800'
          />
        )}
        <div className='ml-2 flex flex-col gap-2'>
          <div className='text-sm font-semibold'>{voteType}</div>

          <div className='text-foreground w-full text-sm'>
            {isLive ? (
              <div className='flex flex-col'>
                <span className='font-bold'>Live Voting</span>
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
      <Link href={`/${groupId}/results/${resultNumber}`}>{eventContent}</Link>
    );
  }

  // Otherwise, return the content as is
  return eventContent;
}
