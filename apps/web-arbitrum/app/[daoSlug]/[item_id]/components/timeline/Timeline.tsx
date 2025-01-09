import { notFound } from "next/navigation";
import { GroupWithDataType } from "../../actions";
import { extractEvents, TimelineEventType } from "./actions";
import { GapEvent } from "./GapEvent";
import { CommentsVolumeEvent } from "./CommentsVolumeEvent";
import { VotesVolumeEvent } from "./VotesVolumeEvent";
import { ResultOngoingEvent } from "./ResultOngoingEvent";
import { ResultEndedEvent } from "./ResultEndedEvent";
import { BasicEvent } from "./BasicEvent";

export async function Timeline({ group }: { group: GroupWithDataType }) {
  if (!group) {
    notFound();
  }

  const events = await extractEvents(group);

  return (
    <div className="fixed right-0 top-0 flex max-h-screen w-80 flex-col items-end justify-start gap-1 overflow-y-auto p-4 pt-24">
      {events.map((event, index) => (
        <div className="flex w-full items-center justify-start">
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
            />
          ) : event.type === TimelineEventType.ResultEnded ? (
            <ResultEndedEvent
              content={event.content}
              timestamp={event.timestamp}
              proposal={event.proposal}
              votes={event.votes}
            />
          ) : event.type === TimelineEventType.Basic ? (
            <BasicEvent
              content={event.content}
              timestamp={event.timestamp}
              url={event.url}
            />
          ) : (
            <></>
          )}
        </div>
      ))}
    </div>
  );
}

// Helper function to format the timestamp
function format(date: Date, formatString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
}
