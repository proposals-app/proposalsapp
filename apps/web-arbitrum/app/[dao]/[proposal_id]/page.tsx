import { getProposalAndGroup, getGroupDetails } from "./actions";
import { notFound } from "next/navigation";
import TimelineView from "./components/timeline/TimelineView";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ dao: string; proposal_id: string }>;
}) {
  const result = await getProposalAndGroup(
    (await params).dao,
    (await params).proposal_id,
  );
  if (!result) {
    notFound();
  }

  const groupDetails = await getGroupDetails(result.group?.id ?? "");

  return (
    <div className="w-full">
      <TimelineView initialData={{ result, groupDetails }} />
    </div>
  );
}
