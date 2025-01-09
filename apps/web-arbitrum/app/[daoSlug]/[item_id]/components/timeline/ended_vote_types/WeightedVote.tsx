import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";

interface WeightedVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const WeightedVote = ({ proposal, votes }: WeightedVoteProps) => {
  // Implement the UI for weighted voting
  return (
    <div>
      <h3>Weighted Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
