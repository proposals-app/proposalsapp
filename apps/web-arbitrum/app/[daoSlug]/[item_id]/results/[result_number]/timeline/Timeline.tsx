import { notFound } from "next/navigation";
import { extractEvents, TimelineEventType } from "./actions";
import { ResultOngoingEvent } from "./ResultOngoingEvent";
import { ResultEndedEvent } from "./ResultEndedEvent";
import { GroupWithDataType } from "../../../actions";
import {
  BasicEvent,
  CommentsVolumeEvent,
  GapEvent,
  VotesVolumeEvent,
} from "./OtherEvents";

export async function Timeline({ group }: { group: GroupWithDataType }) {
  if (!group) {
    notFound();
  }

  const events = await extractEvents(group);

  // Map proposals to their chronological order
  const proposalOrderMap = new Map<string, number>();
  group.proposals.forEach((proposal, index) => {
    proposalOrderMap.set(proposal.id, index + 1); // +1 to make it 1-based
  });

  return (
    <div className="fixed left-20 top-0 flex h-screen w-80 flex-col items-end justify-start pl-4 pt-24">
      <div className="relative h-[calc(100vh-96px)] w-full">
        {/* Top SVG */}
        <div className="absolute left-[14px] top-5 w-0.5 bg-gray-300">
          <svg
            width="31"
            height="31"
            viewBox="0 0 31 31"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -left-[15px] -top-[15px]"
          >
            <rect
              x="0.5"
              y="0.5"
              width="30"
              height="30"
              rx="15"
              fill="white"
              stroke="#D3D3D3"
            />
            <circle cx="15.5" cy="15.5" r="3.5" fill="#737373" />
          </svg>
        </div>

        <div className="absolute bottom-5 left-[14px] top-5 w-0.5 bg-gray-300" />

        {/* Bottom SVG */}
        <div className="absolute bottom-5 left-[14px] w-0.5 bg-gray-300">
          <svg
            width="31"
            height="31"
            viewBox="0 0 31 31"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -bottom-[15px] -left-[15px]"
          >
            <rect
              x="0.5"
              y="0.5"
              width="30"
              height="30"
              rx="15"
              fill="white"
              stroke="#D3D3D3"
            />
            <circle cx="15.5" cy="15.5" r="3.5" fill="#737373" />
          </svg>
        </div>

        <div className="flex h-full flex-col justify-between">
          {events.map((event, index) => {
            // Add resultNumber for ResultEndedEvent and ResultOngoingEvent
            const resultNumber =
              event.type === TimelineEventType.ResultEnded ||
              event.type === TimelineEventType.ResultOngoing
                ? proposalOrderMap.get(event.proposal.id)
                : undefined;

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
                  <ResultOngoingEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
                    resultNumber={resultNumber!} // Pass the resultNumber
                  />
                ) : event.type === TimelineEventType.ResultEnded ? (
                  <ResultEndedEvent
                    content={event.content}
                    timestamp={event.timestamp}
                    proposal={event.proposal}
                    votes={event.votes}
                    resultNumber={resultNumber!} // Pass the resultNumber
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
