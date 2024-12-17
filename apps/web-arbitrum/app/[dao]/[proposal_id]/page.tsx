import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroupData } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { DetailsBar } from "./components/detailsbar/DetailsBar";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ dao: string; proposal_id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { dao, proposal_id } = await params;
  const groupData = await getGroupData(dao, proposal_id);
  if (!groupData) {
    notFound();
  }

  const bodies = await getBodiesForGroup(groupData.group.id);

  const defaultVersion = bodies ? bodies.length - 1 : 0;

  const resolvedSearchParams = await searchParams;
  let versionString = resolvedSearchParams.version;
  if (Array.isArray(versionString)) {
    versionString = versionString[0];
  }

  const version =
    parseInt(versionString ?? defaultVersion.toString()) ?? defaultVersion;

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <SideBar dao={groupData.dao} />
      <div className="flex flex-row pl-20">
        <Body bodies={bodies} version={version} />
        <DetailsBar
          groupData={groupData}
          daoParam={dao}
          proposalIdParam={proposal_id}
        />
      </div>
      {/* <TimelineView groupData={result} /> */}
    </div>
  );
}
