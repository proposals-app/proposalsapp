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
    <div className="fixed right-0 top-0 flex min-h-screen min-w-80 flex-col justify-end bg-gray-400">
      {events.map((event) => (
        <div className="my-2 flex bg-white p-2">{event.content}</div>
      ))}
    </div>
  );
}
