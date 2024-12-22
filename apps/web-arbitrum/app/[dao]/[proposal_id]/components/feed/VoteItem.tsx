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

  const resultClass = `${result == Result.FOR ? "place-self-start bg-green-100 text-green-800" : ""} ${result == Result.AGAINST ? "ml-20 place-self-end bg-red-100 text-red-800" : ""} ${result == Result.ABSTAIN ? "place-self-center self-center bg-amber-100 text-amber-800" : ""} ${result == Result.UNKNOWN ? "place-self-center self-center bg-sky-100 text-sky-800" : ""}`;
  return (
    <div className={`${resultClass} w-2/3 rounded-lg border p-4 shadow-sm`}>
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
  UNKNOWN,
}
export const choiceToClass = (
  proposalChoices: string[],
  choiceIndex: number,
) => {
  try {
    switch (proposalChoices[choiceIndex].toLowerCase()) {
      case "for":
      case "yes":
      case "yae":
        return Result.FOR;
      case "against":
      case "no":
      case "nay":
        return Result.AGAINST;
      // Add additional cases for other choice patterns as needed
      default:
        return Result.ABSTAIN;
    }
  } catch {
    return Result.UNKNOWN;
  }
};
