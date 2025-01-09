import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";

interface SingleChoiceVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const SingleChoiceVote = ({
  proposal,
  votes,
}: SingleChoiceVoteProps) => {
  // Implement the UI for single-choice voting
  return (
    <div>
      <h3>Single Choice Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
