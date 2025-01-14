import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroupWithData } from "../../actions";
import ProposalResult from "./components/ProposalResult";
import { Timeline } from "./components/timeline/Timeline";
import { Header } from "./components/Header";
import { Suspense } from "react";
import { LoadingVotes } from "./components/result/LoadingVotes";

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
      <div className="z-10 hidden lg:flex">
        <Timeline group={group} selectedResult={proposalIndex + 1} />{" "}
      </div>

      {/* Results on the right */}
      <div className={`flex w-full flex-grow pb-16 pl-[159px] pt-[104px]`}>
        <div className="h-full w-full pr-4">
          <Suspense fallback={<LoadingVotes />}>
            <ProposalResult proposal={proposal} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
