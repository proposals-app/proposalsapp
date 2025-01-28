import { formatNumberWithSuffix } from '@/lib/utils';
import { Selectable, Vote } from '@proposalsapp/db';

interface HiddenVoteProps {
  votes: Selectable<Vote>[];
}

export function HiddenVote({ votes }: HiddenVoteProps) {
  const totalVotingPower = votes.reduce(
    (sum, vote) => sum + Number(vote.votingPower),
    0
  );

  return (
    <div className='flex-col items-center justify-between space-y-1'>
      <div className='flex h-4 w-full overflow-hidden rounded-md' />
      <div className='flex w-full justify-between'>
        <div className='text-sm font-bold'>Hidden Votes</div>
        <div className='text-sm'>
          {formatNumberWithSuffix(totalVotingPower)}
        </div>
      </div>
    </div>
  );
}
