import { notFound } from "next/navigation";
import { getBodiesForGroup, GroupType } from "../../actions";
import BodyVersion from "./BodyVersions";
import { searchParamsCache, ViewEnum } from "@/app/searchParams";

interface DetailsBarProps {
  group: GroupType | null;
}

export async function DetailsBar({ group }: DetailsBarProps) {
  if (!group) {
    notFound();
  }

  const bodies = await getBodiesForGroup(group.group.id);

  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  bodies.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const view = searchParamsCache.get("view");

  if (view == ViewEnum.BODY)
    return (
      <div className="flex min-w-80 flex-col gap-4 bg-red-300 p-4">
        {bodies.map((body, index) => (
          <BodyVersion
            key={index}
            body={body}
            version={bodies.length - 1 - index}
          />
        ))}
      </div>
    );
  else return <div className="flex min-w-80 flex-col gap-4 p-4">Timeline</div>;
}
