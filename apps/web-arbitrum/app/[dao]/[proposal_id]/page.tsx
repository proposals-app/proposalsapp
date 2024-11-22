import { notFound } from "next/navigation";
import TimelineView from "./components/timeline/TimelineView";
import { getGroupData } from "./actions";

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
    <div className="w-full">
      <TimelineView initialData={result} />
    </div>
  );
}
