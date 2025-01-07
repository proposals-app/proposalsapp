import { notFound } from "next/navigation";
import { GroupWithDataType } from "../../actions";
import { extractEvents } from "./timeline_events";

export async function Timeline({ group }: { group: GroupWithDataType }) {
  if (!group) {
    notFound();
  }

  const events = await extractEvents(group);

  console.log(events);
  return (
    <div className="fixed right-0 top-0 flex h-full w-80 flex-col items-end justify-end bg-gray-200 p-4 pt-24 shadow-md">
      {events.map((event, index) => (
        <div
          key={index}
          className="flex w-full items-center justify-between gap-2"
          style={{
            marginTop: `${event.position * 95}%`, // Adjust as needed
          }}
        >
          <div className={`h-4 w-4 rounded-full bg-blue-500`} />
          <div className="w-full rounded-lg bg-white p-2 shadow-md">
            {event.content}
          </div>
        </div>
      ))}
    </div>
  );
}
