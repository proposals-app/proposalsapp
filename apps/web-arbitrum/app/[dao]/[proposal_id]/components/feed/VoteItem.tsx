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

  return (
    <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
      <h3>{item.timestamp.toLocaleString()}</h3>
      <h3>Vote by {item.voterAddress}</h3>
      <p>Voting Power: {item.votingPower?.toString()}</p>
      <p>Choice: {JSON.stringify(item.choice)}</p>
    </div>
  );
};
