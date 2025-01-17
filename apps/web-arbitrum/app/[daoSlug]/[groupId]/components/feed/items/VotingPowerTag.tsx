import { CombinedFeedItem } from "../Feed";
import { getVotingPower } from "../actions";
import { format, formatISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/ui/tooltip";
import { formatNumberWithSuffix } from "@/lib/utils";
import { unstable_cache } from "next/cache";

const getVotingPowerCached = unstable_cache(
  async (itemId: string, proposalIds: string[], topicIds: string[]) => {
    return await getVotingPower(itemId, proposalIds, topicIds);
  },
  ["voting-power"],
  { revalidate: 60 * 5, tags: ["voting-power"] },
);

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
    ? await getVotingPowerCached(item.id, proposalIds, topicIds)
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
    <div className="flex w-fit gap-4 rounded-lg border p-1 text-xs text-muted-foreground">
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
