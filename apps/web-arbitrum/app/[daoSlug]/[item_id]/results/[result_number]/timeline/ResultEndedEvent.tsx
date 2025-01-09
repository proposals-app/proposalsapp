import { Selectable, Proposal, Vote } from "@proposalsapp/db";
import { format } from "date-fns";

interface ResultEndedEventProps {
  content: string;
  timestamp: Date;
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
  resultNumber: number;
}

export function ResultEndedEvent({
  content,
  timestamp,
  proposal,
}: ResultEndedEventProps) {
  // Determine if the vote is onchain or offchain
  const isOnchain = proposal.daoIndexerId !== null; // Adjust this logic based on your data model
  const voteType = isOnchain ? "Onchain" : "Offchain";

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.timeEnd);

  // Format dates
  const startDate = format(new Date(proposal.timeStart), "MMM d");
  const endDate = format(new Date(proposal.timeEnd), "MMM d");

  return (
    <div className="relative flex w-full items-center py-2">
      <div className="flex w-full flex-col gap-1 rounded-l-xl border bg-white px-4 py-2 pr-8">
        <div className="absolute left-3 top-5 h-[7px] w-[7px] rounded-full border border-white bg-gray-500" />

        <div className="ml-2 text-sm font-semibold">{voteType}</div>
        {isLive && <div className="text-sm text-gray-600">Live Voting</div>}
        <div className="ml-2 text-sm text-gray-600">
          {isLive ? (
            <>
              <span>{startDate}</span> - <span>{endDate}</span>
            </>
          ) : (
            <>
              <span>Ended {endDate}</span>
              <br />
              <span>Started {startDate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
