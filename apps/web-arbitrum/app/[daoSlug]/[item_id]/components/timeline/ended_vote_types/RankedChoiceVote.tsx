import { Selectable, Vote } from "@proposalsapp/db";
import { Proposal } from "../ResultEndedEvent";

interface RankedChoiceVoteProps {
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

export const RankedChoiceVote = ({
  proposal,
  votes,
}: RankedChoiceVoteProps) => {
  // Implement the UI for ranked-choice voting
  return (
    <div>
      <h3>Ranked Choice Vote</h3>
      <p>Total Votes: {votes.length}</p>
      {/* Add more UI elements as needed */}
    </div>
  );
};
