import { notFound } from "next/navigation";
import { getBodiesForGroup, GroupDataType } from "../../actions";
import BodyVersion from "./BodyVersions";

interface DetailsBarProps {
  groupData: GroupDataType | null;
  daoParam: string;
  proposalIdParam: string;
}

export async function DetailsBar({
  groupData,
  daoParam,
  proposalIdParam,
}: DetailsBarProps) {
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

  const pathname = `/${daoParam}/${proposalIdParam}`;
  const searchParams = new URLSearchParams();

  return (
    <div className="flex min-w-64 flex-col gap-4 bg-gray-600 p-4">
      {bodies.map((body, index) => (
        <BodyVersion
          key={index}
          body={body}
          versionIndex={bodies.length - 1 - index}
          pathname={pathname}
          searchParams={searchParams}
        />
      ))}
    </div>
  );
}
