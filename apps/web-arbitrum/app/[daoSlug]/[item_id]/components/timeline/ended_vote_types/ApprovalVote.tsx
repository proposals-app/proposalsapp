import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";

interface ApprovalVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const ApprovalVote = ({ proposal, votes }: ApprovalVoteProps) => {
  // Implement the UI for approval voting
  return (
    <div>
      <h3>Approval Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
