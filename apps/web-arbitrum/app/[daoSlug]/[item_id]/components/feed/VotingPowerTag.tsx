import { Proposal, Selectable } from "@proposalsapp/db";
import { CombinedFeedItem } from "./Feed";
import { getVotingPower } from "./actions";
import { format, formatISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";

export async function VotingPowerTag({
  item,
  proposalIds,
  topicIds,
}: {
  item: CombinedFeedItem;
  proposalIds?: string[];
  topicIds: string[];
}) {
  const votingPower = proposalIds?.length
    ? await getVotingPower(item.id, proposalIds, topicIds)
    : null;

  if (!votingPower) return <></>;

  if (!votingPower.initialVotingPower) return <></>;

  const utcStartTime = format(
    formatISO(votingPower.startTime),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  const utcEndTime = format(
    formatISO(votingPower.endTime),
    "MMMM do, yyyy 'at' HH:mm:ss 'UTC'",
  );

  return (
    <div className="flex w-fit gap-4 rounded-lg border-2 border-gray-200 p-1 text-xs text-gray-500">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex gap-2">
              {formatNumberWithSuffix(votingPower?.finalVotingPower)} ARB
              {votingPower.change && votingPower.change !== 0 && (
                <div className="flex items-center gap-1">
                  <div>{votingPower.change.toFixed(2)} %</div>
                  {votingPower.change > 0 ? <div>↑</div> : <div>↓</div>}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {utcStartTime} to
              <br />
              {utcEndTime}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
