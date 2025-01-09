import { Selectable, Proposal, Vote } from "@proposalsapp/db";

interface ResultOngoingEventProps {
  content: string;
  timestamp: Date;
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export function ResultOngoingEvent({
  content,
  timestamp,
  proposal,
  votes,
}: ResultOngoingEventProps) {
  return (
    <div className="relative flex w-full items-center py-2">
      <div className="flex w-full flex-col rounded-l-xl border bg-white px-4 py-2">
        <div className="absolute left-3 top-5 h-[7px] w-[7px] rounded-full border border-white bg-gray-500" />
        <div className="ml-4 text-sm">{content}</div>
        <div className="ml-4 text-sm text-gray-600">Votes: {votes.length}</div>
      </div>
    </div>
  );
}
