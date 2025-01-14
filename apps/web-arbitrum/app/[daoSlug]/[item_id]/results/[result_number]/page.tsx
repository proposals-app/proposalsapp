import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroupWithData } from "../../actions";
import { Results } from "./components/Results";
import { Timeline } from "./components/timeline/Timeline";
import { Header } from "./components/Header";
import { Suspense } from "react";
import { LoadingVotes } from "./components/result/LoadingVotes";

export const experimental_ppr = true;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ daoSlug: string; item_id: string; result_number: string }>;
}) {
  const { daoSlug, item_id, result_number } = await params;

  // Static data fetching for SSR
  const group = await getGroupWithData(daoSlug, item_id);
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(result_number, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  const bodies = await getBodiesForGroup(group.group.id);
  const author = bodies?.[0];

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <Header
        authorName={author?.author_name || "Unknown"}
        authorPicture={author?.author_picture || ""}
        proposalName={proposal.name}
        daoSlug={daoSlug}
        itemId={item_id}
      />

      <div className="z-10 hidden lg:flex">
        <Timeline group={group} selectedResult={proposalIndex + 1} />
      </div>

      <div className={`flex w-full flex-grow pb-16 pl-[159px] pt-[104px]`}>
        <div className="h-full w-full pr-4">
          <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
            <Suspense fallback={<LoadingVotes />}>
              <Results proposal={proposal} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
