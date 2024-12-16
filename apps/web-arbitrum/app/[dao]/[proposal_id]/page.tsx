import { notFound } from "next/navigation";
import TimelineView from "./components/timeline/TimelineView";
import { getGroupData, GroupDataType } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { DetailsBar } from "./components/detailsbar/DetailsBar";

export interface GroupDataProps {
  groupData: GroupDataType;
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ dao: string; proposal_id: string }>;
}) {
  const result = await getGroupData(
    (await params).dao,
    (await params).proposal_id,
  );
  if (!result) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <SideBar dao={result.dao} />
      <div className="flex flex-row pl-20">
        <Body groupData={result} />
        <DetailsBar />
      </div>
      {/* <TimelineView groupData={result} /> */}
    </div>
  );
}
