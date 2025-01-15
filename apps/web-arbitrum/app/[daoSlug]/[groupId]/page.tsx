import { notFound } from "next/navigation";
import { getGroupData, getTotalVersions } from "./actions";
import Body, { BodyLoading } from "./components/body/Body";
import { searchParamsCache } from "@/app/searchParams";
import { MenuBar } from "./components/menubar/MenuBar";
import Feed, { FeedLoading } from "./components/feed/Feed";
import { LoadingTimeline, Timeline } from "./components/timeline/Timeline";
import { Suspense } from "react";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, groupId } = await params;
  const group = await getGroupData(daoSlug, groupId);
  if (!group) {
    notFound();
  }

  const totalVersions = await getTotalVersions(groupId);

  const { version, comments, votes, diff, page } =
    await searchParamsCache.parse(searchParams);

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <div className="flex w-full justify-between lg:pr-80">
        <div className="mx-auto flex w-2/3 flex-col justify-center">
          <Suspense fallback={<BodyLoading />}>
            <Body group={group} version={version ?? 0} diff={diff} />
          </Suspense>

          <MenuBar totalVersions={totalVersions ?? 1} />

          <Suspense fallback={<FeedLoading />}>
            <Feed
              group={group}
              commentsFilter={comments}
              votesFilter={votes}
              page={page ? Number(page) : 1}
            />
          </Suspense>
        </div>

        <div className="hidden lg:flex">
          <Suspense fallback={<LoadingTimeline />}>
            <Timeline
              group={group}
              commentsFilter={comments}
              votesFilter={votes}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
