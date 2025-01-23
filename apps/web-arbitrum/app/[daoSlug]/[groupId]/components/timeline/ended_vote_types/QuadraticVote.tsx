import { Selectable, Vote } from '@proposalsapp/db';
import { ProposalWithMetadata } from '../actions';

interface QuadraticVoteProps {
  proposal: ProposalWithMetadata;
  votes: Selectable<Vote>[];
}

export const QuadraticVote = ({ votes }: QuadraticVoteProps) => {
  // Implement the UI for quadratic voting
  return (
    <div>
      <h3>Quadratic Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
