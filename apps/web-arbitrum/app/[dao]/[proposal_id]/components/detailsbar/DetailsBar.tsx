import { notFound } from "next/navigation";
import { getBodiesForGroup, GroupDataType } from "../../actions";
import BodyVersion from "./BodyVersions";
import { searchParamsCache, ViewType } from "@/app/searchParams";

interface DetailsBarProps {
  groupData: GroupDataType | null;
}

export async function DetailsBar({ groupData }: DetailsBarProps) {
  if (!groupData) {
    notFound();
  }

  const bodies = await getBodiesForGroup(groupData.group.id);

  if (!bodies || bodies.length === 0) {
    return <div className="w-full bg-gray-100 p-4">No bodies found.</div>;
  }

  bodies.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const view = searchParamsCache.get("view");

  if (view == ViewType.BODY)
    return (
      <div className="flex min-w-80 flex-col gap-4 p-4">
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
