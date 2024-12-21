import { CombinedFeedItem, VoteFeedItem } from "./Feed";

const isVoteItem = (item: CombinedFeedItem): item is VoteFeedItem => {
  return item.type === "vote";
};

export const VoteItem = ({ content }: { content: CombinedFeedItem }) => {
  if (!isVoteItem(content)) {
    return null;
  }

  return (
    <div>
      <h3>{content.timestamp.toLocaleString()}</h3>
      <h3>Vote by {content.voterAddress}</h3>
      <p>Voting Power: {content.votingPower?.toString()}</p>
      <p>Choice: {JSON.stringify(content.choice)}</p>
    </div>
  );
};
