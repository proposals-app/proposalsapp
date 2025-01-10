import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroupWithData } from "../../actions";
import { ProposalResult } from "./components/ProposalResult";
import { db } from "@proposalsapp/db";
import { Timeline } from "./components/timeline/Timeline";
import { Header } from "./components/Header";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ daoSlug: string; item_id: string; result_number: string }>;
}) {
  const { daoSlug, item_id, result_number } = await params;

  // Fetch the group data
  const group = await getGroupWithData(daoSlug, item_id);
  if (!group) {
    notFound();
  }

  // Extract the proposal based on the result_number
  const proposalIndex = parseInt(result_number, 10) - 1; // Convert to zero-based index
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  // Fetch the votes for the proposal
  const votes = await db
    .selectFrom("vote")
    .selectAll()
    .where("proposalId", "=", proposal.id)
    .execute();

  // Get the author information (assuming the first body is the author)
  const bodies = await getBodiesForGroup(group.group.id);
  const author = bodies?.[0];

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      {/* Sticky Header */}
      <Header
        authorName={author?.author_name || "Unknown"}
        authorPicture={author?.author_picture || ""}
        proposalName={proposal.name}
        daoSlug={daoSlug}
        itemId={item_id}
      />

      {/* Timeline on the left */}
      <div className="hidden lg:flex">
        <Timeline group={group} />
      </div>

      {/* Results on the right */}
      {/* <div className="flex w-full justify-between lg:pr-80">
        <div className="mx-auto flex w-2/3 flex-col justify-center pt-24">
          <ProposalResult proposal={proposal} votes={votes} />
        </div>
      </div> */}
    </div>
  );
}
