import { Proposal, Selectable } from "@proposalsapp/db";
import { CombinedFeedItem } from "./Feed";
import { getVotingPower } from "./actions";

export async function VotingPowerTag({
  item,
  proposalIds,
  topicIds,
}: {
  item: CombinedFeedItem;
  proposalIds?: string[];
  topicIds: number[];
}) {
  const votingPower = proposalIds?.length
    ? await getVotingPower(item.id, proposalIds, topicIds)
    : null;

  if (!votingPower) return <></>;

  if (!votingPower.initialVotingPower) return <></>;

  return (
    <div className="flex w-fit gap-4 rounded-lg border-2 border-gray-200 p-1 text-xs text-gray-500">
      {formatNumberWithSuffix(votingPower?.finalVotingPower)} ARB
      {votingPower.change && votingPower.change !== 0 && (
        <div className="flex items-center gap-2">
          <div>{votingPower.change.toFixed(0)} %</div>
          {votingPower.change > 0 ? <div>↑</div> : <div>↓</div>}
        </div>
      )}
    </div>
  );
}

const formatNumberWithSuffix = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}m`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  } else {
    return num.toFixed(2).toString();
  }
};
