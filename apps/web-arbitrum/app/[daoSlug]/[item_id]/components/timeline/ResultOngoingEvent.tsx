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
    <div className="w-full rounded-lg bg-white p-1 shadow-md">
      <div>{content}</div>
      <div className="text-sm text-gray-600">Votes: {votes.length}</div>
    </div>
  );
}
