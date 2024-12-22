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

  const className = choiceToClass(
    (proposal?.choices ?? []) as string[],
    item.choice as number,
  );

  return (
    <div
      className={`w-2/3 rounded-lg border bg-white p-4 shadow-sm ${className}`}
    >
      <h3>{item.timestamp.toLocaleString()}</h3>
      <h3>Vote by {item.voterAddress}</h3>
      <p>Voting Power: {item.votingPower?.toString()}</p>
      <p>Choice: {JSON.stringify(item.choice)}</p>
    </div>
  );
};

export const choiceToClass = (
  proposalChoices: string[],
  choiceIndex: number,
) => {
  let className = "";

  switch (proposalChoices[choiceIndex].toLowerCase()) {
    case "for":
    case "yes":
    case "yae":
      className = "bg-green-200 text-green-800 place-self-start";
      break;
    case "against":
    case "no":
    case "nay":
      className = "bg-red-200 text-red-800 ml-20 place-self-end";
      break;
    // Add additional cases for other choice patterns as needed
    default:
      className = "bg-amber-100 text-gray-600 self-center place-self-center";
  }

  return className;
};
