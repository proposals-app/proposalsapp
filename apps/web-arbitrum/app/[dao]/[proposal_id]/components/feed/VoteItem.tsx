import { Proposal, Selectable } from "@proposalsapp/db";
import { CombinedFeedItem, VoteFeedItem } from "./Feed";

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === "vote";
};

export const VoteItem = ({
  item,
  proposal,
}: {
  item: CombinedFeedItem;
  proposal?: Selectable<Proposal>;
}) => {
  if (!isVoteItem(item)) {
    return null;
  }

  const result = choiceToClass(
    (proposal?.choices ?? []) as string[],
    item.choice as number,
  );

  return (
    <div
      className={`w-2/3 rounded-lg border p-4 shadow-sm ${result == Result.FOR && "place-self-start bg-green-200 text-green-800"} ${result == Result.AGAINST && "ml-20 place-self-end bg-red-200 text-red-800"} ${result == Result.ABSTAIN && "place-self-center self-center bg-amber-100 text-amber-600"}`}
    >
      <h3>{item.timestamp.toLocaleString()}</h3>
      <h3>Vote by {item.voterAddress}</h3>
      <p>Voting Power: {item.votingPower?.toString()}</p>
      <p>Choice: {JSON.stringify(item.choice)}</p>
    </div>
  );
};

enum Result {
  FOR,
  ABSTAIN,
  AGAINST,
}
export const choiceToClass = (
  proposalChoices: string[],
  choiceIndex: number,
) => {
  switch (proposalChoices[choiceIndex].toLowerCase()) {
    case "for":
    case "yes":
    case "yae":
      return Result.FOR;
      break;
    case "against":
    case "no":
    case "nay":
      return Result.AGAINST;
      break;
    // Add additional cases for other choice patterns as needed
    default:
      return Result.ABSTAIN;
  }
};
