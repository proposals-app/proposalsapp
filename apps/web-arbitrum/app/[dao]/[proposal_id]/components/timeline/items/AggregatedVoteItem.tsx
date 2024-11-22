import { formatAddress } from "@/lib/utils";
import { AggregatedVotesContent } from "../types";

interface AggregatedVoteItemProps {
  content: AggregatedVotesContent;
  timestamp: Date;
}

export function AggregatedVoteItem({
  content,
  timestamp,
}: AggregatedVoteItemProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          {timestamp.toLocaleString()}
        </span>
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium">
          Aggregated Votes
        </span>
      </div>
      <p className="font-medium">Aggregated Votes on {content.proposalName}</p>
      <div className="mt-2">
        <p>Total Votes: {content.totalVotes}</p>
        <p>Total Voting Power: {content.totalVotingPower}</p>
        <div className="mt-2">
          {content.votes.map((vote, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>Choice: {vote.choice}</span>
              <span>Power: {vote.votingPower}</span>
              <span>Count: {vote.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
