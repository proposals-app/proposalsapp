import type { ProcessedVote } from '@/lib/results_processing';
import type { VotesWithVoters } from '../actions';

// One row per vote, with the voter details the table shows already joined in.
// Plain JSON (createdAt in ms) because large proposals have 100k+ rows and
// every byte per row is repeated that many times in the page payload.
export interface ResultsTableRow extends Pick<
  ProcessedVote,
  'id' | 'choice' | 'voterAddress' | 'votingPower' | 'relativeVotingPower'
> {
  createdAt: number;
  reason: string | null;
  voter: {
    ens: string | null;
    // null when the voter has no avatar and uses the generated default; the
    // client rebuilds that URL with defaultVoterAvatar().
    avatar: string | null;
    discourseUsername: string | null;
    latestVotingPower: number | null;
  } | null;
}

export function defaultVoterAvatar(voterAddress: string): string {
  return `https://api.dicebear.com/9.x/pixel-art/png?seed=${voterAddress}`;
}

export function buildResultsTableRows(
  processedVotes: readonly ProcessedVote[],
  votesWithVoters: VotesWithVoters
): ResultsTableRow[] {
  const voterByAddress = new Map(
    votesWithVoters.map((vote) => [vote.voterAddress, vote])
  );

  return processedVotes.map((vote) => {
    const voter = voterByAddress.get(vote.voterAddress);
    return {
      id: vote.id,
      choice: vote.choice,
      createdAt: vote.createdAt.getTime(),
      reason: vote.reason || null,
      voterAddress: vote.voterAddress,
      votingPower: vote.votingPower,
      relativeVotingPower: vote.relativeVotingPower,
      voter: voter
        ? {
            ens: voter.ens,
            avatar:
              voter.avatar === defaultVoterAvatar(vote.voterAddress)
                ? null
                : voter.avatar,
            discourseUsername: voter.discourseUsername,
            latestVotingPower: voter.latestVotingPower,
          }
        : null,
    };
  });
}
