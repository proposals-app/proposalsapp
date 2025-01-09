import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";

interface BasicVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const BasicVote = ({ proposal, votes }: BasicVoteProps) => {
  // Implement the UI for basic voting
  return (
    <div>
      <h3>Basic Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
