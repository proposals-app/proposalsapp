import { formatAddress } from "@/lib/utils";
import { VoteContent } from "../types";

interface VoteItemProps {
  content: VoteContent & {
    choiceNames?: Record<string, string>;
  };
  timestamp: Date;
}

export function VoteItem({ content, timestamp }: VoteItemProps) {
  const formatChoice = (choice: string | string[]) => {
    const choices = Array.isArray(choice) ? choice : [choice];
    return choices.map((c) => content.choiceNames?.[c] || c).join(" + ");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          {timestamp.toLocaleString()}
        </span>
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium">
          Vote
        </span>
      </div>
      <p className="font-medium">Vote on {content.proposalName}</p>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <span className="font-medium">
            {formatAddress(content.voterAddress)}
          </span>
          <span className="ml-2 text-sm text-gray-600">
            Power: {content.votingPower}
          </span>
        </div>
        <div className="text-sm">Votes: {formatChoice(content.choice)}</div>
      </div>
      {content.reason && (
        <p className="mt-2 text-sm text-gray-600">Reason: {content.reason}</p>
      )}
    </div>
  );
}
