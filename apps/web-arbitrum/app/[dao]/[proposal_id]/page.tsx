import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroup } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { DetailsBar } from "./components/detailsbar/DetailsBar";
import { searchParamsCache } from "@/app/searchParams";
import { StickyHeader } from "./components/StickyHeader";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ dao: string; proposal_id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dao, proposal_id } = await params;
  const group = await getGroup(dao, proposal_id);
  if (!group) {
    notFound();
  }

  const bodies = await getBodiesForGroup(group.group.id);

  const defaultVersion = bodies ? bodies.length - 1 : 0;

  const { version } = await searchParamsCache.parse(searchParams);

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <SideBar dao={group.dao} />
      <StickyHeader
        bodies={bodies}
        group={group}
        version={version ?? defaultVersion}
      />
      <div className="flex flex-row pl-20">
        <div className="flex flex-col">
          <Body bodies={bodies} version={version ?? defaultVersion} />
          <div>comments</div>
        </div>
        <DetailsBar group={group} />
      </div>
    </div>
  );
}
