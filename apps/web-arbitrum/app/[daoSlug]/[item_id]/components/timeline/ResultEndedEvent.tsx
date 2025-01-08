import { Selectable, Proposal, Vote } from "@proposalsapp/db";

interface ResultEndedEventProps {
  content: string;
  timestamp: Date;
  proposal: Selectable<Proposal>;
  votes: Selectable<Vote>[];
}

export function ResultEndedEvent({
  content,
  timestamp,
  proposal,
  votes,
}: ResultEndedEventProps) {
  return (
    <div className="w-full rounded-lg bg-white p-1 shadow-md">
      <div>{content}</div>
      <div className="text-sm text-gray-600">Votes: {votes.length}</div>
    </div>
  );
}
