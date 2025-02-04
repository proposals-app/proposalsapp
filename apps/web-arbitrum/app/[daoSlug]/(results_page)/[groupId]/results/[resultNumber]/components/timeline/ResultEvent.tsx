import { Proposal, Selectable } from '@proposalsapp/db';
import { format } from 'date-fns';
import Link from 'next/link';

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
  daoSlug,
  groupId,
  eventIndex,
  last,
}: ResultEventProps) {
  // Determine if the vote is onchain or offchain
  const isOnchain = content.includes('Onchain vote'); // Adjust this logic based on your data model
  const voteType = isOnchain ? 'Onchain' : 'Offchain';

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.endAt);

  // Format dates
  const startDate = format(new Date(proposal.startAt), 'MMM d');
  const endDate = format(new Date(proposal.endAt), 'MMM d');

  // Content to be rendered inside the div
  const eventContent = (
    <div className='relative flex items-center py-2'>
      <div
        className={`flex flex-col gap-1 px-4 py-2 pr-8 ${
          resultNumber == selectedResult
            ? 'w-36 rounded-l-xl border-t border-b border-l'
            : 'w-28 rounded-xl border'
          } border-neutral-300 bg-white`}
      >
        {eventIndex == 0 && resultNumber == selectedResult && (
          <div className='absolute top-2 -right-2 h-2 w-10 border-t border-neutral-300 bg-white' />
        )}
        <div
          className='absolute top-5 left-3 z-20 h-[7px] w-[7px] -translate-x-[0.5px] rounded-full
            bg-neutral-500'
        />
        {!last && (
          <div
            className='absolute top-[7px] left-[11.5px] z-10 h-[15px] max-h-[15px] w-0.5
              translate-x-[2.5px] bg-neutral-500'
          />
        )}
        <div className='ml-2 text-sm font-semibold'>{voteType}</div>
        {isLive && <div className='text-foreground text-sm'>Live Voting</div>}
        <div className='text-foreground ml-2 text-sm'>
          {isLive ? (
            <>
              <span>{startDate}</span> - <span>{endDate}</span>
            </>
          ) : (
            <>
              <span>Ended {endDate}</span>
              <br />
              <span>Started {startDate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // If resultNumber is not equal to selectedResult, wrap the content in a Link
  if (resultNumber !== selectedResult) {
    return (
      <Link href={`/${daoSlug}/${groupId}/results/${resultNumber}`}>
        {eventContent}
      </Link>
    );
  }

  // Otherwise, return the content as is
  return eventContent;
}
