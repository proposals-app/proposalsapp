import { formatNumberWithSuffix } from '@/lib/utils';
import { Selectable, Vote } from '@proposalsapp/db';
import { useMemo } from 'react';
import { HiddenVote } from './HiddenVote';
import { ProposalWithMetadata } from '@/app/types';

interface ApprovalVoteProps {
  proposal: ProposalWithMetadata;
  votes: Selectable<Vote>[];
}

export const ApprovalVote = ({ proposal, votes }: ApprovalVoteProps) => {
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

    // Process votes where each vote can approve multiple choices
    const voteCounts: { [choice: number]: number } = {};
    const choices = proposal.choices as string[];

    // Initialize vote counts
    choices.forEach((_, index) => {
      voteCounts[index] = 0;
    });

    // Process each vote
    votes.forEach((vote) => {
      const approvedChoices = Array.isArray(vote.choice)
        ? (vote.choice as number[])
        : [vote.choice as number];

      approvedChoices.forEach((choice) => {
        const choiceIndex = choice - 1; // Convert to 0-based index
        voteCounts[choiceIndex] =
          (voteCounts[choiceIndex] || 0) + Number(vote.votingPower);
      });
    });

    // Find the winning choice
    let winningChoice = 'Unknown';
    let maxVotingPower = 0;

    for (const [choice, votingPower] of Object.entries(voteCounts)) {
      if (votingPower > maxVotingPower) {
        maxVotingPower = votingPower;
        winningChoice = choices[Number(choice)] || 'Unknown';
      }
    }

    const totalVotingPower = Object.values(voteCounts).reduce(
      (sum, power) => sum + power,
      0
    );

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
    <div className='flex-col items-center justify-between space-y-1 text-black'>
      <div
        className='border-neutral-350 flex h-4 w-full overflow-hidden rounded-md border
          dark:border-neutral-300'
      >
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
