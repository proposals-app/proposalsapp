import { getOwnVotes, getVotes } from "../actions";
import Votes from "../components/votes";

export async function VotesWrapper({
  proposalId,
  choices,
  quorum,
}: {
  proposalId: string;
  choices: any[];
  quorum: number;
}) {
  let votes = await getVotes(proposalId);
  let ownVotes = await getOwnVotes(proposalId);

  return (
    <Votes
      votes={votes}
      ownVotes={ownVotes}
      choices={choices as any[]}
      quorum={quorum}
    />
  );
}
