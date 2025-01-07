import { notFound } from "next/navigation";
import { getGroupWithData, getTotalVersions } from "./actions";
import Body from "./components/body/Body";
import { SideBar } from "./components/SideBar";
import { searchParamsCache } from "@/app/searchParams";
import { MenuBar } from "./components/menubar/MenuBar";
import Feed from "./components/feed/Feed";
import { Timeline } from "./components/timeline/Timeline";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string; item_id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug, item_id } = await params;
  const group = await getGroupWithData(daoSlug, item_id);
  if (!group) {
    notFound();
  }

  const totalVersions = await getTotalVersions(group.group.id);

  const { version, comments, votes, diff, page } =
    await searchParamsCache.parse(searchParams);

  return (
    <div className="flex min-h-screen w-full flex-row bg-gray-100">
      <div className="hidden lg:flex">
        <SideBar dao={group.dao} daoSlug={daoSlug} />
      </div>

      <div className="flex w-full justify-between lg:pl-20 lg:pr-80">
        <div className="mx-auto flex w-[90%] flex-col justify-center md:w-3/4 lg:w-1/2">
          <Body group={group} version={version ?? 0} diff={diff} />

          <MenuBar totalVersions={totalVersions ?? 1} />

          <Feed
            group={group}
            commentsFilter={comments}
            votesFilter={votes}
            page={page ? Number(page) : 1}
          />
        </div>

        <div className="hidden lg:flex">
          <Timeline group={group} />
        </div>
      </div>
    </div>
  );
}
