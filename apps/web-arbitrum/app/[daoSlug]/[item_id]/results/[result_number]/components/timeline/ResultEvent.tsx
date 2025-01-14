import { Selectable, Proposal, Vote } from "@proposalsapp/db";
import { format } from "date-fns";
import Link from "next/link";

interface ResultEventProps {
  content: string;
  timestamp: Date;
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
  resultNumber: number;
  selectedResult: number;
  daoSlug: string;
  groupId: string;
  eventIndex: number;
}

export function ResultEvent({
  content,
  timestamp,
  proposal,
  resultNumber,
  selectedResult,
  daoSlug,
  groupId,
  eventIndex,
}: ResultEventProps) {
  // Determine if the vote is onchain or offchain
  const isOnchain = content.includes("Onchain vote"); // Adjust this logic based on your data model
  const voteType = isOnchain ? "Onchain" : "Offchain";

  // Determine if the vote is live or ended
  const isLive = new Date() < new Date(proposal.timeEnd);

  // Format dates
  const startDate = format(new Date(proposal.timeStart), "MMM d");
  const endDate = format(new Date(proposal.timeEnd), "MMM d");

  // Content to be rendered inside the div
  const eventContent = (
    <div className="relative flex items-center py-2">
      <div
        className={`flex flex-col gap-1 ${
          resultNumber == selectedResult
            ? "w-36 rounded-l-xl border-b border-l border-t"
            : "w-28 rounded-xl border"
        } border-gray-400 bg-white px-4 py-2 pr-8`}
      >
        {eventIndex == 0 && resultNumber == selectedResult && (
          <div className="absolute -right-2 top-2 h-2 w-10 border-t border-gray-400 bg-white"></div>
        )}
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

  // If resultNumber is not equal to selectedResult, wrap the content in a Link
  if (resultNumber !== selectedResult) {
    return (
      <Link href={`/${daoSlug}/${groupId}/results/${resultNumber}`}>
        {eventContent}
      </Link>
    );
  }

  // Otherwise, return the content as is
  return eventContent;
}
