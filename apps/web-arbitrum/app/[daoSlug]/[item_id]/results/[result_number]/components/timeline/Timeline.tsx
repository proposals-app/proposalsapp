import { notFound } from "next/navigation";
import { extractEvents, TimelineEventType } from "./actions";
import { ResultEvent } from "./ResultEvent";
import {
  BasicEvent,
  CommentsVolumeEvent,
  GapEvent,
  VotesVolumeEvent,
} from "./OtherEvents";
import { GroupWithDataType } from "@/app/[daoSlug]/[item_id]/actions";

export async function Timeline({
  group,
  selectedResult,
}: {
  group: GroupWithDataType;
  selectedResult: number;
}) {
  if (!group) {
    notFound();
  }

  const events = await extractEvents(group);

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  // Get the current time
  const currentTime = new Date();

  // Check if the proposal end time is older than the current time
  const isProposalEnded = group.proposals.some(
    (proposal) => new Date(proposal.timeEnd) < currentTime,
  );

  return (
    <div className="fixed left-20 top-0 flex h-screen w-80 flex-col items-end justify-start pl-4 pt-24">
      <div className="relative h-[calc(100vh-96px)] w-full">
        {/* Conditionally render the top SVG */}
        {isProposalEnded && (
          <div className="absolute left-[14px] top-5 w-0.5 translate-x-[0.5px] bg-gray-300">
            <svg
              width="21"
              height="21"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -left-[10px] -top-[10px]"
            >
              <rect
                x="0.5"
                y="0.5"
                width="20"
                height="20"
                rx="10"
                fill="white"
                stroke="#D3D3D3"
              />
              <circle cx="10.5" cy="10.5" r="3" fill="#737373" />
            </svg>
          </div>
        )}

        <div className="absolute bottom-5 left-[14px] top-5 w-0.5 bg-gray-300" />

        {/* Bottom SVG */}
        <div className="absolute bottom-5 left-[14px] w-0.5 translate-x-[0.5px] bg-gray-300">
          <svg
            width="21"
            height="21"
            viewBox="0 0 21 21"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -bottom-[10px] -left-[10px]"
          >
            <rect
              x="0.5"
              y="0.5"
              width="20"
              height="20"
              rx="10"
              fill="white"
              stroke="#D3D3D3"
            />
            <circle cx="10.5" cy="10.5" r="3" fill="#737373" />
          </svg>
        </div>

        <div className="flex h-full flex-col justify-between">
          {events.map((event, index) => {
            // Add resultNumber for ResultEndedEvent and ResultOngoingEvent
            const resultNumber =
              event.type === TimelineEventType.ResultEnded ||
              event.type === TimelineEventType.ResultOngoing
                ? (proposalOrderMap.get(event.proposal.id) ?? 0)
                : 0;

            return (
              <div
                key={index}
                className="relative flex w-full items-center justify-start"
              >
                {event.type === TimelineEventType.Gap ? (
                  <GapEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    gapSize={event.gapSize}
                  />
                ) : event.type === TimelineEventType.CommentsVolume ? (
                  <CommentsVolumeEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    volume={event.volume}
                  />
                ) : event.type === TimelineEventType.VotesVolume ? (
                  <VotesVolumeEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    volume={event.volume}
                  />
                ) : event.type === TimelineEventType.ResultOngoing ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
                    resultNumber={resultNumber!}
                    selectedResult={selectedResult}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                  />
                ) : event.type === TimelineEventType.ResultEnded ? (
                  <ResultEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
                    resultNumber={resultNumber!}
                    selectedResult={selectedResult}
                    daoSlug={group.daoSlug}
                    groupId={group.group.id}
                  />
                ) : event.type === TimelineEventType.Basic ? (
                  <BasicEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    url={event.url}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
