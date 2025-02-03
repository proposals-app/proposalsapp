import { formatNumberWithSuffix } from '@/lib/utils';
import { Selectable, Vote } from '@proposalsapp/db';
import { useMemo } from 'react';
import { HiddenVote } from './HiddenVote';
import { ProposalWithMetadata } from '@/app/types';

interface SingleChoiceVoteProps {
  proposal: ProposalWithMetadata;
  votes: Selectable<Vote>[];
}

export const SingleChoiceVote = ({
  proposal,
  votes,
}: SingleChoiceVoteProps) => {
  const metadata =
    typeof proposal.metadata === 'string'
      ? JSON.parse(proposal.metadata)
      : proposal.metadata;

  const { winningChoice, winningPercentage, maxVotingPower } = useMemo(() => {
    if (metadata?.hiddenVote && metadata?.scoresState !== 'final') {
      return {
        winningChoice: 'Hidden',
        totalVotingPower: 0,
        winningPercentage: 0,
        maxVotingPower: 0,
      };
    }

    const sortedVotes = [...votes]
      .filter((vote) => vote.votingPower)
      .sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

    const processVote = (
      vote: Selectable<Vote>
    ): { choice: string; votingPower: number } => {
      const choiceIndex = vote.choice as number;
      const choiceText =
        (proposal.choices as string[])[choiceIndex] || 'Unknown';
      return {
        choice: choiceText,
        votingPower: Number(vote.votingPower),
      };
    };

    const processedVotes = sortedVotes.map(processVote);
    const totalVotingPower = processedVotes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    );

    // Group votes by choice
    const groupedVotes = processedVotes.reduce<Record<string, number>>(
      (acc, vote) => {
        if (!acc[vote.choice]) {
          acc[vote.choice] = 0;
        }
        acc[vote.choice] += vote.votingPower;
        return acc;
      },
      {}
    );

    // Find the winning choice
    let winningChoice = 'Unknown';
    let maxVotingPower = 0;

    for (const [choice, votingPower] of Object.entries(groupedVotes)) {
      if (votingPower > maxVotingPower) {
        maxVotingPower = votingPower;
        winningChoice = choice;
      }
    }

    const winningPercentage = (maxVotingPower / totalVotingPower) * 100;

    return {
      winningChoice,
      totalVotingPower,
      winningPercentage,
      maxVotingPower,
    };
  }, [votes, proposal.choices, metadata]);

  if (metadata?.hiddenVote && metadata?.scoresState !== 'final') {
    return <HiddenVote votes={votes} />;
  }

  return (
    <div className='flex-col items-center justify-between space-y-1'>
      <div className='border-neutral-350 flex h-4 w-full overflow-hidden border'>
        <div
          className='bg-for-600 h-full'
          style={{ width: `${winningPercentage}%` }}
        />
      </div>
      <div className='flex w-full justify-between'>
        <div className='truncate text-sm font-bold'>{winningChoice}</div>
        <div className='text-sm'>{formatNumberWithSuffix(maxVotingPower)}</div>
      </div>
    </div>
  );
};
