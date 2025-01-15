import { notFound } from "next/navigation";
import { getBodiesForGroup, getGroupData } from "../../actions";
import { Results, ResultsLoading } from "./components/Results";
import { LoadingTimeline, Timeline } from "./components/timeline/Timeline";
import { Header } from "./components/Header";
import { Suspense } from "react";
import { getAuthor } from "./actions";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ daoSlug: string; groupId: string; resultNumber: string }>;
}) {
  const { daoSlug, groupId, resultNumber } = await params;

  const group = await getGroupData(daoSlug, groupId);
  if (!group) {
    notFound();
  }

  const proposalIndex = parseInt(resultNumber, 10) - 1;
  const proposal = group.proposals[proposalIndex];

  if (!proposal) {
    notFound();
  }

  const bodies = await getAuthor(group.group.id);
  const author = bodies?.[0];

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <Header
        authorName={author?.author_name || "Unknown"}
        authorPicture={author?.author_picture || ""}
        proposalName={proposal.name}
        daoSlug={daoSlug}
        itemId={groupId}
      />

      <div className="z-10 hidden lg:flex">
        <Suspense fallback={<LoadingTimeline />}>
          <Timeline group={group} selectedResult={proposalIndex + 1} />
        </Suspense>
      </div>

      <div className={`flex w-full flex-grow pb-16 pl-[159px] pt-[104px]`}>
        <div className="h-full w-full pr-4">
          <div className="flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-lg border border-gray-400 bg-white p-6">
            <Suspense fallback={<ResultsLoading />}>
              <Results proposal={proposal} daoSlug={daoSlug} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
